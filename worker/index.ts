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

    // POST /api/bootstrap_admin (one-shot, protected by ADMIN_SECRET)
    // Creates or FORCE-PROMOTES an account in KV. Supports optional role (admin | editor, default admin).
    if (path === 'bootstrap_admin' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization') || '';
      const provided = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (provided !== env.ADMIN_SECRET) {
        return json({ error: 'Forbidden' }, 403);
      }
      const { email, password, role: reqRole } = (await request.json()) as any;
      if (!email || !password) return json({ error: '缺少 email 或 password' }, 400);
      const role = ['admin', 'editor'].includes(reqRole) ? reqRole : 'admin';
      const key = `admin:${email}`;
      const hash = await sha256(password);
      const record = JSON.stringify({ hash, role });
      await env.CLASS09_CMS.put(key, record);
      await writeLog(env.CLASS09_CMS, 'bootstrap_admin', email, `account seeded/promoted as ${role}`);
      return json({ ok: true, email, role });
    }

    // POST /api/login (public)
    if (path === 'login' && request.method === 'POST') {
      const { email, password } = await request.json() as any;
      const stored = await env.CLASS09_CMS.get(`admin:${email}`);
      const genericError = '邮箱或密码错误';
      if (!stored) return json({ error: genericError }, 401);

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
      if (inputHash !== storedHash) return json({ error: genericError }, 401);
      // Update login stats (async, don't block response)
      const now = Date.now();
      let loginCount = 1;
      try { const u = JSON.parse(stored); loginCount = (u.loginCount || 0) + 1; } catch {}
      env.CLASS09_CMS.put(`admin:${email}`, JSON.stringify({ ...JSON.parse(stored), hash: storedHash, role, loginCount, lastLogin: now })).catch(() => {});
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
      const userRecord = { hash, role: invite.role || 'editor', inviteCode: code, createdAt: Date.now(), loginCount: 0, lastLogin: null as number | null };
      await env.CLASS09_CMS.put(`admin:${email}`, JSON.stringify(userRecord));
      // Mark invite as used (keep for tracking, don't delete)
      invite.usedBy = email;
      invite.usedAt = Date.now();
      await env.CLASS09_CMS.put(`invite:${code}`, JSON.stringify(invite), { expirationTtl: 7 * 24 * 3600 });
      const token = await createToken(email, invite.role || 'editor', env.ADMIN_SECRET);
      await writeLog(env.CLASS09_CMS, 'register', email, `via invite ${code} (${invite.role})`);
      return json({ ok: true, token, email, role: invite.role || 'editor' });
    }

    // POST /api/capsule (public — anyone can seal a letter; contents are NEVER readable until open date)
    if (path === 'capsule' && request.method === 'POST') {
      const { author, text } = await request.json() as any;
      if (!text || !text.trim()) return json({ error: '信的内容不能为空' }, 400);
      if (text.length > 5000) return json({ error: '信件内容过长（上限 5000 字）' }, 400);
      const list = await env.CLASS09_CMS.get('capsule_letters', 'json') as any[] | null;
      const letters = list || [];
      letters.push({
        id: `letter-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        author: (author || '匿名').toString().slice(0, 40),
        text: text.toString(),
        createdAt: Date.now(),
      });
      await env.CLASS09_CMS.put('capsule_letters', JSON.stringify(letters));
      await writeLog(env.CLASS09_CMS, 'seal_letter', author || '匿名', `第 ${letters.length} 封`);
      return json({ ok: true, count: letters.length });
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
      // GET /api/capsule — PUBLIC returns only count + openDate, NEVER letter contents
      if (path === 'capsule') {
        const list = await env.CLASS09_CMS.get('capsule_letters', 'json') as any[] | null;
        const meta = await env.CLASS09_CMS.get('capsule_meta', 'json') as any | null;
        return json({
          count: (list || []).length,
          openDate: meta?.openDate || '2032-06-30',
          title: meta?.title || '写给 2032 年毕业的我',
          intro: meta?.intro || '每个小朋友都写下一封信，装进这枚时光胶囊。它会一直沉睡，直到 2032 年夏天毕业那天，才被一封封开启。',
        });
      }
      // GET /api/teacher — teacher letters (published only; ?all=1 + token for drafts)
      if (path === 'teacher') {
        const data = await env.CLASS09_CMS.get('teacher', 'json') as any[] | null;
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
      // GET /api/teacher_avatar — global teacher portrait URL (public)
      if (path === 'teacher_avatar') {
        const url_ = (await env.CLASS09_CMS.get('teacher_avatar')) || '';
        return json({ avatar: url_ });
      }
      // GET /api/music — background music config
      if (path === 'music') {
        const data = await env.CLASS09_CMS.get('music', 'json');
        return json(data || null);
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

      const allowed = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'audio/mpeg', 'audio/m4a', 'audio/x-m4a', 'audio/ogg', 'audio/wav', 'audio/wave', 'audio/x-wav',
      ];
      if (!allowed.includes(file.type)) {
        return json({ error: '仅支持 jpg/png/webp/gif 图片或 m4a/ogg/wav 音频格式' }, 400);
      }
      const isAudio = file.type.startsWith('audio/');
      const maxSize = isAudio ? 10 * 1024 * 1024 : 2 * 1024 * 1024;
      if (file.size > maxSize) {
        return json({ error: isAudio ? '音频文件不能超过 10MB' : '图片文件不能超过 2MB，请先压缩后再上传' }, 400);
      }
      // Sanitize key: only allow safe characters, prevent path traversal
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_.\/-]*$/.test(key) || key.includes('..') || key.startsWith('/')) {
        return json({ error: '文件路径包含不安全字符' }, 400);
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
      if (user.role !== 'admin') return json({ error: '仅站长可覆写数据集' }, 403);
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
      if (user.role !== 'admin') return json({ error: '仅站长可覆写数据集' }, 403);
      const body = await request.json();
      await env.CLASS09_CMS.put('honors', JSON.stringify(body));
      await writeLog(env.CLASS09_CMS, 'update_honors', user.email);
      return json({ ok: true });
    }

    if (path === 'quotes' && request.method === 'PUT') {
      if (user.role !== 'admin') return json({ error: '仅站长可覆写数据集' }, 403);
      const body = await request.json();
      await env.CLASS09_CMS.put('quotes', JSON.stringify(body));
      await writeLog(env.CLASS09_CMS, 'update_quotes', user.email);
      return json({ ok: true });
    }

    // PUT /api/teacher — overwrite teacher letters array
    if (path === 'teacher' && request.method === 'PUT') {
      if (user.role !== 'admin') return json({ error: '仅站长可覆写数据集' }, 403);
      const body = await request.json();
      await env.CLASS09_CMS.put('teacher', JSON.stringify(body));
      await writeLog(env.CLASS09_CMS, 'update_teacher', user.email);
      return json({ ok: true });
    }

    // PUT /api/teacher_avatar — update global teacher portrait URL
    if (path === 'teacher_avatar' && request.method === 'PUT') {
      if (user.role !== 'admin') return json({ error: '仅站长可修改头像' }, 403);
      const { avatar } = (await request.json()) as any;
      if (typeof avatar !== 'string') return json({ error: 'avatar 必须是字符串' }, 400);
      await env.CLASS09_CMS.put('teacher_avatar', avatar);
      await writeLog(env.CLASS09_CMS, 'update_teacher_avatar', user.email, avatar ? 'set' : 'cleared');
      return json({ ok: true, avatar });
    }

    // PUT /api/music — overwrite background music config
    if (path === 'music' && request.method === 'PUT') {
      if (user.role !== 'admin') return json({ error: '仅站长可修改背景音乐' }, 403);
      const body = await request.json();
      await env.CLASS09_CMS.put('music', JSON.stringify(body));
      await writeLog(env.CLASS09_CMS, 'update_music', user.email);
      return json({ ok: true });
    }

    // PUT /api/capsule_meta — overwrite capsule metadata (title/intro/openDate)
    if (path === 'capsule_meta' && request.method === 'PUT') {
      if (user.role !== 'admin') return json({ error: '仅站长可修改胶囊设置' }, 403);
      const body = await request.json();
      await env.CLASS09_CMS.put('capsule_meta', JSON.stringify(body));
      await writeLog(env.CLASS09_CMS, 'update_capsule_meta', user.email);
      return json({ ok: true });
    }

    // POST /api/invite — admin generates invite code
    if (path === 'invite' && request.method === 'POST') {
      if (user.role !== 'admin') return json({ error: '仅站长可生成邀请码' }, 403);
      const { role: inviteRole, note } = await request.json() as any;
      const role = ['admin', 'editor'].includes(inviteRole) ? inviteRole : 'editor';
      const bytes = crypto.getRandomValues(new Uint8Array(4));
      const code = Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 6).toUpperCase();
      const invite = { code, role, note: note || '', createdBy: user.email, createdAt: Date.now() };
      await env.CLASS09_CMS.put(`invite:${code}`, JSON.stringify(invite), { expirationTtl: 7 * 24 * 3600 }); // 7 days
      await writeLog(env.CLASS09_CMS, 'create_invite', user.email, `${code} (${role})`);
      return json({ ok: true, code, role });
    }

    // GET /api/invites — admin views active invites with user login stats
    if (path === 'invites' && request.method === 'GET') {
      if (user.role !== 'admin') return json({ error: '权限不足' }, 403);
      const list = await env.CLASS09_CMS.list({ prefix: 'invite:', limit: 50 });
      const invites = [];
      for (const k of list.keys) {
        const val = await env.CLASS09_CMS.get(k.name, 'json');
        if (!val) continue;
        const invite: any = val;
        // If used, look up user record for login stats
        if (invite.usedBy) {
          const userData = await env.CLASS09_CMS.get(`admin:${invite.usedBy}`, 'json') as any;
          if (userData) {
            invite.userLoginCount = userData.loginCount || 0;
            invite.userLastLogin = userData.lastLogin || null;
          }
        }
        invites.push(invite);
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

    // --- Trash / Recycle Bin (admin only) ---

    // POST /api/trash — save an item to trash (any authenticated user)
    if (path === 'trash' && request.method === 'POST') {
      const body = await request.json();
      const { type, slug, data, name } = body as any;
      if (!type || !data) return json({ error: '缺少 type 或 data' }, 400);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const item = {
        type, slug: slug || '', name: name || '',
        data, deleted_by: user.email, deleted_at: Date.now(),
      };
      await env.CLASS09_CMS.put(`trash:${id}`, JSON.stringify(item));
      await writeLog(env.CLASS09_CMS, 'trash_item', user.email, `${id} (${type}: ${name})`);
      return json({ ok: true, id });
    }

    // GET /api/trash — list all trashed items
    if (path === 'trash' && request.method === 'GET') {
      const list = await env.CLASS09_CMS.list({ prefix: 'trash:', limit: 100 });
      const items = [];
      for (const k of list.keys) {
        const val = await env.CLASS09_CMS.get(k.name, 'json');
        if (val) items.push({ id: k.name.replace('trash:', ''), ...val });
      }
      items.sort((a, b) => (b.deleted_at || 0) - (a.deleted_at || 0));
      return json(items);
    }

    // PUT /api/trash/:id — restore an item
    if (path.startsWith('trash/') && request.method === 'PUT') {
      const id = path.replace('trash/', '');
      const key = `trash:${id}`;
      const item = await env.CLASS09_CMS.get(key, 'json') as any;
      if (!item) return json({ error: '记录不存在或已过期' }, 404);

      // Restore based on type
      if (item.type === 'moment_photo') {
        const moments = await env.CLASS09_CMS.get('moments', 'json') as any[] || [];
        const m = moments.find((x: any) => x.slug === item.slug);
        if (m) {
          m.photos = m.photos || [];
          m.photos.push(item.data);
          m.count = m.photos.length;
          await env.CLASS09_CMS.put('moments', JSON.stringify(moments));
        }
      } else if (item.type === 'moment') {
        const moments = await env.CLASS09_CMS.get('moments', 'json') as any[] || [];
        moments.push(item.data);
        await env.CLASS09_CMS.put('moments', JSON.stringify(moments));
      } else if (item.type === 'honor') {
        const honors = await env.CLASS09_CMS.get('honors', 'json') as any[] || [];
        honors.push(item.data);
        await env.CLASS09_CMS.put('honors', JSON.stringify(honors));
      } else if (item.type === 'teacher_letter') {
        const letters = await env.CLASS09_CMS.get('teacher', 'json') as any[] || [];
        letters.push(item.data);
        await env.CLASS09_CMS.put('teacher', JSON.stringify(letters));
      } else {
        // Unknown type — do NOT delete the trash record, so data is never lost silently
        return json({ error: `暂不支持恢复该类型（${item.type}），记录已保留` }, 400);
      }

      await env.CLASS09_CMS.delete(key);
      await writeLog(env.CLASS09_CMS, 'restore_trash', user.email, `${id} (${item.type})`);
      return json({ ok: true });
    }

    // DELETE /api/trash/:id — permanently delete a trashed item
    if (path.startsWith('trash/') && request.method === 'DELETE') {
      if (user.role !== 'admin') return json({ error: '仅站长可彻底删除' }, 403);
      const id = path.replace('trash/', '');
      const key = `trash:${id}`;
      const item = await env.CLASS09_CMS.get(key, 'json') as any;
      if (!item) return json({ error: '记录不存在' }, 404);
      await env.CLASS09_CMS.delete(key);
      await writeLog(env.CLASS09_CMS, 'perm_delete_trash', user.email, `${id} (${item.type})`);
      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e: any) {
    return json({ error: 'Internal error', message: e?.message || String(e) }, 500);
  }
}
