// Cloudflare Worker entry point
// Handles /api/* routes, /images/* for R2 assets, falls through to static assets for everything else

interface Env {
  ASSETS: Fetcher;
  CLASS09_CMS?: KVNamespace;
  IMAGES?: R2Bucket;
  ADMIN_SECRET: string;
}

// --- Crypto helpers ---

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  return expected === signature;
}

async function createToken(email: string, role: string, secret: string): Promise<string> {
  const payload = JSON.stringify({ email, role, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const payloadB64 = btoa(payload);
  const sig = await hmacSign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

async function verifyToken(token: string, secret: string): Promise<{ email: string; role: string } | null> {
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return null;
    const valid = await hmacVerify(payloadB64, sig, secret);
    if (!valid) return null;
    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp < Date.now()) return null;
    return { email: payload.email, role: payload.role || 'admin' };
  } catch {
    return null;
  }
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Helpers ---

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function writeLog(kv: KVNamespace, action: string, email: string, detail?: string) {
  const ts = Date.now();
  const key = `log:${ts}:${Math.random().toString(36).slice(2, 6)}`;
  const entry = { ts, action, email, detail: detail || '' };
  await kv.put(key, JSON.stringify(entry), { expirationTtl: 90 * 24 * 3600 }); // keep 90 days
}

// --- Main handler ---

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Serve images from R2
    if (url.pathname.startsWith('/images/')) {
      return handleImages(request, env, url);
    }

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status === 404) {
      const notFoundUrl = new URL('/404.html', request.url);
      const notFoundReq = new Request(notFoundUrl.toString(), { headers: request.headers });
      const notFoundRes = await env.ASSETS.fetch(notFoundReq);
      if (notFoundRes.status === 200) {
        return new Response(notFoundRes.body, {
          status: 404,
          headers: notFoundRes.headers,
        });
      }
    }
    return assetResponse;
  },
};

async function handleImages(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.IMAGES) {
    return new Response('Image storage not configured', { status: 503 });
  }
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const key = url.pathname.replace('/images/', '');
  if (!key) return new Response('Not found', { status: 404 });

  const object = await env.IMAGES.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  object.writeHttpMetadata(headers);

  return new Response(object.body, { headers });
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  try {
    if (!env.CLASS09_CMS) {
      return json({ error: 'CMS 尚未配置，请先绑定 KV namespace' }, 503);
    }

    const path = url.pathname.replace('/api/', '');

    // POST /api/login (public)
    if (path === 'login' && request.method === 'POST') {
      const { email, password } = await request.json() as any;
      const stored = await env.CLASS09_CMS.get(`admin:${email}`);
      if (!stored) return json({ error: '账号不存在' }, 401);

      // Support both old format (plain hash) and new format (JSON with role)
      let storedHash: string;
      let role = 'admin';
      try {
        const parsed = JSON.parse(stored);
        storedHash = parsed.hash;
        role = parsed.role || 'admin';
      } catch {
        storedHash = stored; // legacy: plain hash string
      }

      const inputHash = await sha256(password);
      if (inputHash !== storedHash) return json({ error: '密码错误' }, 401);
      const token = await createToken(email, role, env.ADMIN_SECRET);
      await writeLog(env.CLASS09_CMS, 'login', email);
      return json({ token, email, role });
    }

    // POST /api/register (public — requires valid invite code)
    if (path === 'register' && request.method === 'POST') {
      const { code, email, password } = await request.json() as any;
      if (!code || !email || !password) return json({ error: '邀请码、邮箱和密码均不能为空' }, 400);
      const inviteRaw = await env.CLASS09_CMS.get(`invite:${code.toUpperCase()}`);
      if (!inviteRaw) return json({ error: '邀请码无效或已过期' }, 400);
      const invite = JSON.parse(inviteRaw);
      // Check if email already exists
      const existing = await env.CLASS09_CMS.get(`admin:${email}`);
      if (existing) return json({ error: '该邮箱已注册' }, 400);
      const hash = await sha256(password);
      await env.CLASS09_CMS.put(`admin:${email}`, JSON.stringify({ hash, role: invite.role || 'editor' }));
      // Delete used invite
      await env.CLASS09_CMS.delete(`invite:${code.toUpperCase()}`);
      const token = await createToken(email, invite.role || 'editor', env.ADMIN_SECRET);
      await writeLog(env.CLASS09_CMS, 'register', email, `via invite ${code} (${invite.role})`);
      return json({ ok: true, token, email, role: invite.role || 'editor' });
    }

    // Public read-only endpoints
    if (request.method === 'GET') {
      if (path === 'moments') {
        const data = await env.CLASS09_CMS.get('moments', 'json') as any[] | null;
        const showAll = url.searchParams.get('all') === '1';
        if (showAll) {
          const authHeader = request.headers.get('Authorization');
          const tk = authHeader?.replace('Bearer ', '');
          if (tk) {
            const u = await verifyToken(tk, env.ADMIN_SECRET);
            if (u) return json(data || []);
          }
        }
        const published = (data || []).filter((m: any) => m.status !== 'draft');
        return json(published);
      }
      if (path.startsWith('moments/') && !path.includes('/publish') && !path.includes('/unpublish')) {
        const slug = path.replace('moments/', '');
        const data = await env.CLASS09_CMS.get('moments', 'json') as any[] | null;
        const moment = (data || []).find((m: any) => m.slug === slug);
        if (!moment) return json({ error: '未找到该时刻' }, 404);
        if (moment.status === 'draft') {
          const authHeader = request.headers.get('Authorization');
          const tk = authHeader?.replace('Bearer ', '');
          if (tk) {
            const u = await verifyToken(tk, env.ADMIN_SECRET);
            if (u) return json(moment);
          }
          return json({ error: '未找到该时刻' }, 404);
        }
        return json(moment);
      }
      if (path === 'honors') {
        const data = await env.CLASS09_CMS.get('honors', 'json') as any[] | null;
        const showAll = url.searchParams.get('all') === '1';
        if (showAll) {
          const authHeader = request.headers.get('Authorization');
          const tk = authHeader?.replace('Bearer ', '');
          if (tk) {
            const u = await verifyToken(tk, env.ADMIN_SECRET);
            if (u) return json(data || []);
          }
        }
        const published = (data || []).filter((m: any) => m.status !== 'draft');
        return json(published);
      }
      if (path === 'quotes') {
        const data = await env.CLASS09_CMS.get('quotes', 'json');
        return json(data || []);
      }
      // GET /api/logs — admin only
      if (path === 'logs') {
        const authHeader = request.headers.get('Authorization');
        const tk = authHeader?.replace('Bearer ', '');
        if (!tk) return json({ error: '未登录' }, 401);
        const u = await verifyToken(tk, env.ADMIN_SECRET);
        if (!u) return json({ error: '登录已过期' }, 401);
        if (u.role !== 'admin') return json({ error: '权限不足' }, 403);
        const list = await env.CLASS09_CMS.list({ prefix: 'log:', limit: 50 });
        const logs = [];
        for (const k of list.keys) {
          const val = await env.CLASS09_CMS.get(k.name, 'json');
          if (val) logs.push(val);
        }
        logs.sort((a: any, b: any) => b.ts - a.ts);
        return json(logs);
      }
    }

    // All write routes require auth
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return json({ error: '未登录' }, 401);
    const user = await verifyToken(token, env.ADMIN_SECRET);
    if (!user) return json({ error: '登录已过期' }, 401);

    // POST /api/upload — upload image to R2
    if (path === 'upload' && request.method === 'POST') {
      if (!env.IMAGES) return json({ error: 'R2 存储桶未配置' }, 503);
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const key = formData.get('key') as string | null;
      if (!file || !key) return json({ error: '缺少 file 或 key 参数' }, 400);

      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowed.includes(file.type)) {
        return json({ error: '仅支持 jpg/png/webp/gif 格式' }, 400);
      }
      if (file.size > 10 * 1024 * 1024) {
        return json({ error: '文件大小不能超过 10MB' }, 400);
      }

      await env.IMAGES.put(key, file.stream(), {
        httpMetadata: { contentType: file.type },
      });

      await writeLog(env.CLASS09_CMS, 'upload', user.email, key);
      const imageUrl = `/images/${key}`;
      return json({ ok: true, url: imageUrl, key });
    }

    // DELETE /api/images/:key — delete image from R2 (admin only)
    if (path.startsWith('images/') && request.method === 'DELETE') {
      if (user.role !== 'admin') return json({ error: '仅站长可删除图片' }, 403);
      if (!env.IMAGES) return json({ error: 'R2 存储桶未配置' }, 503);
      const key = path.replace('images/', '');
      await env.IMAGES.delete(key);
      await writeLog(env.CLASS09_CMS, 'delete_image', user.email, key);
      return json({ ok: true });
    }

    if (path === 'moments' && request.method === 'PUT') {
      const body = await request.json();
      await env.CLASS09_CMS.put('moments', JSON.stringify(body));
      await writeLog(env.CLASS09_CMS, 'update_moments', user.email);
      return json({ ok: true });
    }

    // PUT /api/moments/:slug/publish — admin publishes a draft
    if (path.startsWith('moments/') && path.endsWith('/publish') && request.method === 'PUT') {
      if (user.role !== 'admin') return json({ error: '仅站长可发布内容' }, 403);
      const slug = path.replace('moments/', '').replace('/publish', '');
      const data = await env.CLASS09_CMS.get('moments', 'json') as any[] | null;
      const updated = (data || []).map((m: any) => m.slug === slug ? { ...m, status: 'published' } : m);
      await env.CLASS09_CMS.put('moments', JSON.stringify(updated));
      await writeLog(env.CLASS09_CMS, 'publish_moment', user.email, slug);
      return json({ ok: true });
    }

    // PUT /api/moments/:slug/unpublish — admin sets back to draft
    if (path.startsWith('moments/') && path.endsWith('/unpublish') && request.method === 'PUT') {
      if (user.role !== 'admin') return json({ error: '仅站长可下架内容' }, 403);
      const slug = path.replace('moments/', '').replace('/unpublish', '');
      const data = await env.CLASS09_CMS.get('moments', 'json') as any[] | null;
      const updated = (data || []).map((m: any) => m.slug === slug ? { ...m, status: 'draft' } : m);
      await env.CLASS09_CMS.put('moments', JSON.stringify(updated));
      await writeLog(env.CLASS09_CMS, 'unpublish_moment', user.email, slug);
      return json({ ok: true });
    }

    if (path === 'honors' && request.method === 'PUT') {
      const body = await request.json();
      await env.CLASS09_CMS.put('honors', JSON.stringify(body));
      await writeLog(env.CLASS09_CMS, 'update_honors', user.email);
      return json({ ok: true });
    }

    if (path === 'quotes' && request.method === 'PUT') {
      const body = await request.json();
      await env.CLASS09_CMS.put('quotes', JSON.stringify(body));
      await writeLog(env.CLASS09_CMS, 'update_quotes', user.email);
      return json({ ok: true });
    }

    // POST /api/invite — admin generates invite code
    if (path === 'invite' && request.method === 'POST') {
      if (user.role !== 'admin') return json({ error: '仅站长可生成邀请码' }, 403);
      const { role: inviteRole, note } = await request.json() as any;
      const role = ['admin', 'editor'].includes(inviteRole) ? inviteRole : 'editor';
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      const invite = { code, role, note: note || '', createdBy: user.email, createdAt: Date.now() };
      await env.CLASS09_CMS.put(`invite:${code}`, JSON.stringify(invite), { expirationTtl: 7 * 24 * 3600 }); // 7 days
      await writeLog(env.CLASS09_CMS, 'create_invite', user.email, `${code} (${role})`);
      return json({ ok: true, code, role });
    }

    // GET /api/invites — admin views active invites
    if (path === 'invites' && request.method === 'GET') {
      if (user.role !== 'admin') return json({ error: '权限不足' }, 403);
      const list = await env.CLASS09_CMS.list({ prefix: 'invite:', limit: 20 });
      const invites = [];
      for (const k of list.keys) {
        const val = await env.CLASS09_CMS.get(k.name, 'json');
        if (val) invites.push(val);
      }
      return json(invites);
    }

    // DELETE /api/invite/:code — admin revokes an invite
    if (path.startsWith('invite/') && request.method === 'DELETE') {
      if (user.role !== 'admin') return json({ error: '仅站长可撤销邀请码' }, 403);
      const code = path.replace('invite/', '');
      await env.CLASS09_CMS.delete(`invite:${code}`);
      await writeLog(env.CLASS09_CMS, 'revoke_invite', user.email, code);
      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e: any) {
    return json({ error: 'Internal error', message: e?.message || String(e) }, 500);
  }
}
