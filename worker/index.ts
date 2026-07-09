// Cloudflare Worker entry point
// Handles /api/* routes, falls through to static assets for everything else

interface Env {
  ASSETS: Fetcher;
  CLASS09_CMS?: KVNamespace;
  ADMIN_SECRET: string; // env variable for admin password hash
}

// Simple JWT-like token (base64 encoded JSON with expiry)
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

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // API routes
    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }

    // Fall through to static assets
    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  try {
    if (!env.CLASS09_CMS) {
      return json({ error: 'CMS 尚未配置，请先绑定 KV namespace' }, 503);
    }

    const path = url.pathname.replace('/api/', '');

    // POST /api/login
    if (path === 'login' && request.method === 'POST') {
      const { email, password } = await request.json() as any;
      // Check against stored admin credentials
      const storedHash = await env.CLASS09_CMS.get(`admin:${email}`);
      if (!storedHash) return json({ error: '账号不存在' }, 401);

      const inputHash = await sha256(password);
      if (inputHash !== storedHash) return json({ error: '密码错误' }, 401);

      const token = createToken(email, env.ADMIN_SECRET);
      return json({ token, email });
    }

    // All other routes require auth
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return json({ error: '未登录' }, 401);
    const user = verifyToken(token, env.ADMIN_SECRET);
    if (!user) return json({ error: '登录已过期' }, 401);

    // GET /api/moments - list all moments
    if (path === 'moments' && request.method === 'GET') {
      const data = await env.CLASS09_CMS.get('moments', 'json');
      return json(data || []);
    }

    // PUT /api/moments - save all moments
    if (path === 'moments' && request.method === 'PUT') {
      const body = await request.json();
      await env.CLASS09_CMS.put('moments', JSON.stringify(body));
      return json({ ok: true });
    }

    // GET /api/honors - list all honors
    if (path === 'honors' && request.method === 'GET') {
      const data = await env.CLASS09_CMS.get('honors', 'json');
      return json(data || []);
    }

    // PUT /api/honors - save all honors
    if (path === 'honors' && request.method === 'PUT') {
      const body = await request.json();
      await env.CLASS09_CMS.put('honors', JSON.stringify(body));
      return json({ ok: true });
    }

    // GET /api/quotes - list all quotes
    if (path === 'quotes' && request.method === 'GET') {
      const data = await env.CLASS09_CMS.get('quotes', 'json');
      return json(data || []);
    }

    // PUT /api/quotes - save quotes
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
