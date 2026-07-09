// Cloudflare Worker entry point
// Handles /api/* routes, /images/* for R2 assets, falls through to static assets for everything else

interface Env {
  ASSETS: Fetcher;
  CLASS09_CMS?: KVNamespace;
  IMAGES?: R2Bucket;
  ADMIN_SECRET: string;
}

function createToken(email: string, secret: string): string {
  const payload = { email, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  return btoa(JSON.stringify(payload)) + '.' + btoa(secret.slice(0, 8));
}

function verifyToken(token: string, secret: string): { email: string } | null {
  try {
    const [payloadB64, sigB64] = token.split('.');
    if (btoa(secret.slice(0, 8)) !== sigB64) return null;
    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp < Date.now()) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

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

    return env.ASSETS.fetch(request);
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
      const storedHash = await env.CLASS09_CMS.get(`admin:${email}`);
      if (!storedHash) return json({ error: '账号不存在' }, 401);
      const inputHash = await sha256(password);
      if (inputHash !== storedHash) return json({ error: '密码错误' }, 401);
      const token = createToken(email, env.ADMIN_SECRET);
      return json({ token, email });
    }

    // Public read-only endpoints (no auth required)
    if (request.method === 'GET') {
      if (path === 'moments') {
        const data = await env.CLASS09_CMS.get('moments', 'json');
        return json(data || []);
      }
      if (path === 'honors') {
        const data = await env.CLASS09_CMS.get('honors', 'json');
        return json(data || []);
      }
      if (path === 'quotes') {
        const data = await env.CLASS09_CMS.get('quotes', 'json');
        return json(data || []);
      }
    }

    // All write routes require auth
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return json({ error: '未登录' }, 401);
    const user = verifyToken(token, env.ADMIN_SECRET);
    if (!user) return json({ error: '登录已过期' }, 401);

    // POST /api/upload — upload image to R2
    if (path === 'upload' && request.method === 'POST') {
      if (!env.IMAGES) return json({ error: 'R2 存储桶未配置' }, 503);
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const key = formData.get('key') as string | null;
      if (!file || !key) return json({ error: '缺少 file 或 key 参数' }, 400);

      // Validate file type
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowed.includes(file.type)) {
        return json({ error: '仅支持 jpg/png/webp/gif 格式' }, 400);
      }
      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        return json({ error: '文件大小不能超过 10MB' }, 400);
      }

      await env.IMAGES.put(key, file.stream(), {
        httpMetadata: { contentType: file.type },
      });

      const imageUrl = `/images/${key}`;
      return json({ ok: true, url: imageUrl, key });
    }

    if (path === 'moments' && request.method === 'PUT') {
      const body = await request.json();
      await env.CLASS09_CMS.put('moments', JSON.stringify(body));
      return json({ ok: true });
    }

    if (path === 'honors' && request.method === 'PUT') {
      const body = await request.json();
      await env.CLASS09_CMS.put('honors', JSON.stringify(body));
      return json({ ok: true });
    }

    if (path === 'quotes' && request.method === 'PUT') {
      const body = await request.json();
      await env.CLASS09_CMS.put('quotes', JSON.stringify(body));
      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e: any) {
    return json({ error: 'Internal error', message: e?.message || String(e) }, 500);
  }
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
