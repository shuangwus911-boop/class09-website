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
  const payload = JSON.stringify({ email, role, iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const payloadB64 = btoa(payload);
  const sig = await hmacSign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

async function verifyToken(token: string, secret: string): Promise<{ email: string; role: string; iat: number } | null> {
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return null;
    const valid = await hmacVerify(payloadB64, sig, secret);
    if (!valid) return null;
    const payload = JSON.parse(atob(payloadB64));
    if (payload.exp < Date.now()) return null;
    return { email: payload.email, role: payload.role || 'admin', iat: payload.iat || 0 };
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

type Account = { hash: string; role: string; [k: string]: any };

// 早期账号直接存的是纯 sha256 字符串，没有 JSON 外壳
function parseAccount(raw: string): Account {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return { role: 'admin', ...parsed };
  } catch {}
  return { hash: raw, role: 'admin' };
}

type AuthUser = { email: string; role: string; account: Account };

// token 是无状态签名，删号 / 降级 / 改密都不会让它自动失效，所以每次请求都回查账号。
async function authenticate(request: Request, env: Env): Promise<{ user: AuthUser } | { error: Response }> {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { error: json({ error: '未登录' }, 401) };
  const payload = await verifyToken(token, env.ADMIN_SECRET);
  if (!payload) return { error: json({ error: '登录已过期' }, 401) };
  const raw = await env.CLASS09_CMS.get(`admin:${payload.email}`);
  if (!raw) return { error: json({ error: '账号已被移除，请联系站长' }, 401) };
  const account = parseAccount(raw);
  if (account.pwChangedAt && payload.iat < account.pwChangedAt) {
    return { error: json({ error: '密码已修改，请重新登录' }, 401) };
  }
  return { user: { email: payload.email, role: account.role || 'admin', account } };
}

// 草稿可见性也必须回查账号：只验签的话，删号 / 改密之后的旧 token 还能翻到未发布内容。
async function canSeeDrafts(request: Request, env: Env): Promise<boolean> {
  if (!request.headers.get('Authorization')) return false;
  return 'user' in (await authenticate(request, env));
}

// 时光胶囊：孩子姓名 + 8 位生日 = 这封信属于谁。生日只做归属标识，不当凭证用，
// 所以查询接口永远只回元信息、不回正文。
function isValidBirthday(v: string): boolean {
  if (!/^\d{8}$/.test(v)) return false;
  const y = +v.slice(0, 4), m = +v.slice(4, 6), d = +v.slice(6, 8);
  const now = new Date().getFullYear();
  return y >= 2010 && y <= now && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

function matchKeyOf(child: string, birthday: string): string {
  return `${child.replace(/\s+/g, '').toLowerCase()}|${birthday}`;
}

// 后台童言三个框全留空也会提交 {text:'',who:'',date:''}，落库前删掉，前台才不会渲染空卡片。
function sanitizeMoment(m: any): any {
  if (m && m.quote && !String(m.quote.text || '').trim()) {
    const { quote, ...rest } = m;
    return rest;
  }
  return m;
}

function sanitizeMoments(list: any): any {
  if (!Array.isArray(list)) return list;
  return list.map(sanitizeMoment);
}

// 相册 / 荣耀 / 寄语原来各自整数组存一个 KV 键，两个人同时保存时后写的会把先写的
// 改动整段盖掉。改成一条一个键，各自只动自己那条。
type SplitSpec = { name: string; legacyKey: string; prefix: string; idOf: (x: any) => string };

const SPLIT: Record<'moments' | 'honors' | 'teacher', SplitSpec> = {
  moments: { name: 'moments', legacyKey: 'moments', prefix: 'moment:', idOf: (x) => x?.slug },
  honors: { name: 'honors', legacyKey: 'honors', prefix: 'honor:', idOf: (x) => x?.id },
  teacher: { name: 'teacher', legacyKey: 'teacher', prefix: 'letter:', idOf: (x) => x?.id },
};

// split_v1:* 标记迁移已完成。有了它，就算之后条目被全部删空也不会再从旧数组键复活。
// 旧键一律保留不删，出问题还能回滚。
async function ensureSplit(kv: KVNamespace, spec: SplitSpec): Promise<void> {
  const marker = `split_v1:${spec.name}`;
  if (await kv.get(marker)) return;
  const legacy = (await kv.get(spec.legacyKey, 'json')) as any[] | null;
  if (Array.isArray(legacy)) {
    for (let i = 0; i < legacy.length; i++) {
      const id = spec.idOf(legacy[i]);
      if (!id) continue;
      await kv.put(`${spec.prefix}${id}`, JSON.stringify({ ...legacy[i], order: i }), { metadata: { order: i } });
    }
  }
  await kv.put(marker, String(Date.now()));
}

async function listSplit(kv: KVNamespace, spec: SplitSpec): Promise<any[]> {
  await ensureSplit(kv, spec);
  const found: { name: string; order: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = (await kv.list({ prefix: spec.prefix, cursor })) as any;
    for (const k of page.keys) found.push({ name: k.name, order: k.metadata?.order ?? 0 });
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  found.sort((a, b) => a.order - b.order);
  const items = await Promise.all(found.map((k) => kv.get(k.name, 'json')));
  return items.filter(Boolean) as any[];
}

async function getSplitItem(kv: KVNamespace, spec: SplitSpec, id: string): Promise<any | null> {
  await ensureSplit(kv, spec);
  return (await kv.get(`${spec.prefix}${id}`, 'json')) as any | null;
}

async function putSplitItem(kv: KVNamespace, spec: SplitSpec, item: any, order?: number): Promise<string | null> {
  const id = spec.idOf(item);
  if (!id) return null;
  const key = `${spec.prefix}${id}`;
  let ord = order;
  if (ord === undefined) {
    const existing = (await kv.get(key, 'json')) as any;
    // 新条目排到最后：时间戳一定大于迁移时写下的下标
    ord = existing?.order ?? item.order ?? Date.now();
  }
  await kv.put(key, JSON.stringify({ ...item, order: ord }), { metadata: { order: ord } });
  return id;
}

// 整表保存只做 upsert + 重排，绝不按提交上来的数组删键。
// 删除必须走各自的 DELETE 路由，这样别人刚新增的条目不会被一次陈旧的整表保存抹掉。
async function upsertSplitAll(kv: KVNamespace, spec: SplitSpec, list: any[]): Promise<void> {
  await ensureSplit(kv, spec);
  for (let i = 0; i < list.length; i++) {
    await putSplitItem(kv, spec, list[i], i);
  }
}

// 一封信一个 key（不是一个大数组），并发封存才不会互相覆盖。
// 前缀用冒号，避免撞上 capsule_meta / capsule_letters 这类下划线键。
const CAPSULE_PREFIX = 'capsule:';

type LetterMeta = { child: string; matchKey: string; author: string; sealedAt: number; chars: number };

async function listLetters(kv: KVNamespace): Promise<{ key: string; meta: LetterMeta }[]> {
  const out: { key: string; meta: LetterMeta }[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: CAPSULE_PREFIX, cursor }) as any;
    for (const k of page.keys) out.push({ key: k.name, meta: (k.metadata || {}) as LetterMeta });
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out;
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

      const account = parseAccount(stored);
      const role = account.role || 'admin';
      const inputHash = await sha256(password);
      if (inputHash !== account.hash) return json({ error: genericError }, 401);
      // Update login stats (async, don't block response)
      env.CLASS09_CMS.put(`admin:${email}`, JSON.stringify({
        ...account,
        role,
        loginCount: (account.loginCount || 0) + 1,
        lastLogin: Date.now(),
      })).catch(() => {});
      const token = await createToken(email, role, env.ADMIN_SECRET);
      await writeLog(env.CLASS09_CMS, 'login', email);
      return json({ token, email, role });
    }

    // POST /api/register (public — requires valid invite code)
    if (path === 'register' && request.method === 'POST') {
      const { code, email, password } = await request.json() as any;
      if (!code || !email || !password) return json({ error: '邀请码、邮箱和密码均不能为空' }, 400);
      // 读写必须用同一个规范化后的 code，否则已用标记会写到另一个键上
      const normCode = String(code).trim().toUpperCase();
      const inviteRaw = await env.CLASS09_CMS.get(`invite:${normCode}`);
      if (!inviteRaw) return json({ error: '邀请码无效或已过期' }, 400);
      const invite = JSON.parse(inviteRaw);
      if (invite.usedBy) return json({ error: '该邀请码已被使用，请向站长索取新的邀请码' }, 400);
      // Check if email already exists
      const existing = await env.CLASS09_CMS.get(`admin:${email}`);
      if (existing) return json({ error: '该邮箱已注册' }, 400);
      const hash = await sha256(password);
      const userRecord = { hash, role: invite.role || 'editor', inviteCode: normCode, createdAt: Date.now(), loginCount: 0, lastLogin: null as number | null };
      await env.CLASS09_CMS.put(`admin:${email}`, JSON.stringify(userRecord));
      // Mark invite as used (keep for tracking, don't delete)
      invite.usedBy = email;
      invite.usedAt = Date.now();
      await env.CLASS09_CMS.put(`invite:${normCode}`, JSON.stringify(invite), { expirationTtl: 7 * 24 * 3600 });
      const token = await createToken(email, invite.role || 'editor', env.ADMIN_SECRET);
      await writeLog(env.CLASS09_CMS, 'register', email, `via invite ${normCode} (${invite.role})`);
      return json({ ok: true, token, email, role: invite.role || 'editor' });
    }

    // POST /api/capsule (public — anyone can seal a letter; contents are NEVER readable until open date)
    if (path === 'capsule' && request.method === 'POST') {
      const { author, text, child, birthday } = await request.json() as any;
      const childName = (child || '').toString().trim().slice(0, 20);
      if (!childName) return json({ error: '请填写孩子姓名' }, 400);
      const bd = (birthday || '').toString().trim();
      if (!isValidBirthday(bd)) return json({ error: '生日请填 8 位数字，如 20180315' }, 400);
      if (!text || !text.trim()) return json({ error: '信的内容不能为空' }, 400);
      if (text.length > 5000) return json({ error: '信件内容过长（上限 5000 字）' }, 400);
      const matchKey = matchKeyOf(childName, bd);
      const authorName = (author || '匿名').toString().slice(0, 40);
      const body = text.toString();
      const sealedAt = Date.now();
      const id = `${sealedAt}-${crypto.randomUUID().slice(0, 8)}`;
      const letterKey = `${CAPSULE_PREFIX}${id}`;
      await env.CLASS09_CMS.put(letterKey, JSON.stringify({
        id,
        child: childName,
        birthday: bd,
        matchKey,
        author: authorName,
        text: body,
        createdAt: sealedAt,
      }), { metadata: { child: childName, matchKey, author: authorName, sealedAt, chars: body.length } });
      // list 是最终一致的，刚写的这封可能还没出现在结果里，所以排除自己再加一
      const others = await listLetters(env.CLASS09_CMS);
      const count = others.filter(l => l.key !== letterKey).length + 1;
      const mine = others.filter(l => l.key !== letterKey && l.meta.matchKey === matchKey).length + 1;
      await writeLog(env.CLASS09_CMS, 'seal_letter', authorName, `${childName} · 全班第 ${count} 封`);
      return json({ ok: true, count, child: childName, mine });
    }

    // Public read-only endpoints
    if (request.method === 'GET') {
      if (path === 'moments') {
        const data = await listSplit(env.CLASS09_CMS, SPLIT.moments);
        const showAll = url.searchParams.get('all') === '1';
        if (showAll && await canSeeDrafts(request, env)) return json(data);
        const published = data.filter((m: any) => m.status !== 'draft');
        return json(published);
      }
      if (path.startsWith('moments/') && !path.includes('/publish') && !path.includes('/unpublish')) {
        const slug = path.replace('moments/', '');
        const moment = await getSplitItem(env.CLASS09_CMS, SPLIT.moments, slug);
        if (!moment) return json({ error: '未找到该时刻' }, 404);
        if (moment.status === 'draft') {
          if (await canSeeDrafts(request, env)) return json(moment);
          return json({ error: '未找到该时刻' }, 404);
        }
        return json(moment);
      }
      if (path === 'honors') {
        const data = await listSplit(env.CLASS09_CMS, SPLIT.honors);
        const showAll = url.searchParams.get('all') === '1';
        if (showAll && await canSeeDrafts(request, env)) return json(data);
        const published = data.filter((m: any) => m.status !== 'draft');
        return json(published);
      }
      if (path === 'quotes') {
        const data = await env.CLASS09_CMS.get('quotes', 'json');
        return json(data || []);
      }
      // GET /api/capsule — PUBLIC returns only count + openDate, NEVER letter contents
      if (path === 'capsule') {
        const letters = await listLetters(env.CLASS09_CMS);
        const meta = await env.CLASS09_CMS.get('capsule_meta', 'json') as any | null;
        return json({
          count: letters.length,
          openDate: meta?.openDate || '2031-06-30',
          title: meta?.title || '写给 2031 年毕业的我',
          intro: meta?.intro || '每个小朋友都写下一封信，装进这枚时光胶囊。它会一直沉睡，直到 2031 年夏天毕业那天，才被一封封开启。',
        });
      }
      // GET /api/capsule/lookup?child=&birthday= — 家长自查：只回元信息，绝不回正文
      if (path === 'capsule/lookup') {
        const childName = (url.searchParams.get('child') || '').trim().slice(0, 20);
        const bd = (url.searchParams.get('birthday') || '').trim();
        if (!childName) return json({ error: '请填写孩子姓名' }, 400);
        if (!isValidBirthday(bd)) return json({ error: '生日请填 8 位数字，如 20180315' }, 400);
        const key = matchKeyOf(childName, bd);
        const all = await listLetters(env.CLASS09_CMS);
        const mine = all
          .filter(l => l.meta.matchKey === key)
          .map(l => ({ sealedAt: l.meta.sealedAt, chars: l.meta.chars, author: l.meta.author || '匿名' }))
          .sort((a, b) => a.sealedAt - b.sealedAt);
        return json({ child: childName, count: mine.length, letters: mine });
      }
      // GET /api/teacher — teacher letters (published only; ?all=1 + token for drafts)
      if (path === 'teacher') {
        const data = await listSplit(env.CLASS09_CMS, SPLIT.teacher);
        const showAll = url.searchParams.get('all') === '1';
        if (showAll && await canSeeDrafts(request, env)) return json(data);
        const published = data.filter((m: any) => m.status !== 'draft');
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
        const logAuth = await authenticate(request, env);
        if ('error' in logAuth) return logAuth.error;
        if (logAuth.user.role !== 'admin') return json({ error: '权限不足' }, 403);
        // KV list 按 UTF-8 升序返回，日志键是 log:<时间戳>，直接 limit:50 拿到的是最早 50 条。
        // 先游标列全量键名（不取值），取末尾 50 个再读值。
        const keys: string[] = [];
        let cursor: string | undefined;
        do {
          const page = await env.CLASS09_CMS.list({ prefix: 'log:', cursor }) as any;
          for (const k of page.keys) keys.push(k.name);
          cursor = page.list_complete ? undefined : page.cursor;
        } while (cursor);
        const logs = [];
        for (const name of keys.slice(-50)) {
          const val = await env.CLASS09_CMS.get(name, 'json');
          if (val) logs.push(val);
        }
        logs.sort((a: any, b: any) => b.ts - a.ts);
        return json(logs);
      }
    }

    // All write routes require auth
    const auth = await authenticate(request, env);
    if ('error' in auth) return auth.error;
    const user = auth.user;

    // 编辑与站长同权。站长专属仅限：操作日志、班主任头像、背景音乐、胶囊设置、邀请码。

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
      const maxSize = isAudio ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        return json({ error: isAudio ? '音频文件不能超过 10MB' : '图片文件不能超过 5MB，请先压缩后再上传' }, 400);
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

    // DELETE /api/images/:key — delete image from R2
    if (path.startsWith('images/') && request.method === 'DELETE') {
      if (!env.IMAGES) return json({ error: 'R2 存储桶未配置' }, 503);
      const key = path.replace('images/', '');
      await env.IMAGES.delete(key);
      await writeLog(env.CLASS09_CMS, 'delete_image', user.email, key);
      return json({ ok: true });
    }

    if (path === 'moments' && request.method === 'PUT') {
      const body = await request.json();
      if (!Array.isArray(body)) return json({ error: 'moments 必须是数组' }, 400);
      await upsertSplitAll(env.CLASS09_CMS, SPLIT.moments, sanitizeMoments(body));
      await writeLog(env.CLASS09_CMS, 'update_moments', user.email);
      return json({ ok: true });
    }

    // PUT /api/moments/:slug/publish — publish a draft
    if (path.startsWith('moments/') && path.endsWith('/publish') && request.method === 'PUT') {
      const slug = path.replace('moments/', '').replace('/publish', '');
      const moment = await getSplitItem(env.CLASS09_CMS, SPLIT.moments, slug);
      if (!moment) return json({ error: '未找到该时刻' }, 404);
      await putSplitItem(env.CLASS09_CMS, SPLIT.moments, { ...moment, status: 'published' });
      await writeLog(env.CLASS09_CMS, 'publish_moment', user.email, slug);
      return json({ ok: true });
    }

    // PUT /api/moments/:slug/unpublish — set back to draft
    if (path.startsWith('moments/') && path.endsWith('/unpublish') && request.method === 'PUT') {
      const slug = path.replace('moments/', '').replace('/unpublish', '');
      const moment = await getSplitItem(env.CLASS09_CMS, SPLIT.moments, slug);
      if (!moment) return json({ error: '未找到该时刻' }, 404);
      await putSplitItem(env.CLASS09_CMS, SPLIT.moments, { ...moment, status: 'draft' });
      await writeLog(env.CLASS09_CMS, 'unpublish_moment', user.email, slug);
      return json({ ok: true });
    }

    // PUT /api/moments/:slug — 只落库这一条，别人同时改别的时刻不会被覆盖
    if (path.startsWith('moments/') && request.method === 'PUT') {
      const slug = path.replace('moments/', '');
      const body = (await request.json()) as any;
      if (!body || body.slug !== slug) return json({ error: 'slug 与路径不一致' }, 400);
      await ensureSplit(env.CLASS09_CMS, SPLIT.moments);
      await putSplitItem(env.CLASS09_CMS, SPLIT.moments, sanitizeMoment(body));
      await writeLog(env.CLASS09_CMS, 'update_moment', user.email, slug);
      return json({ ok: true });
    }

    // DELETE /api/moments/:slug — 删除必须单独调用，整表保存不再按提交的数组删键
    if (path.startsWith('moments/') && request.method === 'DELETE') {
      const slug = path.replace('moments/', '');
      await ensureSplit(env.CLASS09_CMS, SPLIT.moments);
      await env.CLASS09_CMS.delete(`${SPLIT.moments.prefix}${slug}`);
      await writeLog(env.CLASS09_CMS, 'delete_moment', user.email, slug);
      return json({ ok: true });
    }

    if (path === 'honors' && request.method === 'PUT') {
      const body = await request.json();
      if (!Array.isArray(body)) return json({ error: 'honors 必须是数组' }, 400);
      await upsertSplitAll(env.CLASS09_CMS, SPLIT.honors, body);
      await writeLog(env.CLASS09_CMS, 'update_honors', user.email);
      return json({ ok: true });
    }

    // PUT /api/honors/:id — 单条落库
    if (path.startsWith('honors/') && request.method === 'PUT') {
      const id = path.replace('honors/', '');
      const body = (await request.json()) as any;
      if (!body || body.id !== id) return json({ error: 'id 与路径不一致' }, 400);
      await ensureSplit(env.CLASS09_CMS, SPLIT.honors);
      await putSplitItem(env.CLASS09_CMS, SPLIT.honors, body);
      await writeLog(env.CLASS09_CMS, 'update_honor', user.email, id);
      return json({ ok: true });
    }

    // DELETE /api/honors/:id
    if (path.startsWith('honors/') && request.method === 'DELETE') {
      const id = path.replace('honors/', '');
      await ensureSplit(env.CLASS09_CMS, SPLIT.honors);
      await env.CLASS09_CMS.delete(`${SPLIT.honors.prefix}${id}`);
      await writeLog(env.CLASS09_CMS, 'delete_honor', user.email, id);
      return json({ ok: true });
    }

    if (path === 'quotes' && request.method === 'PUT') {
      const body = await request.json();
      await env.CLASS09_CMS.put('quotes', JSON.stringify(body));
      await writeLog(env.CLASS09_CMS, 'update_quotes', user.email);
      return json({ ok: true });
    }

    // PUT /api/teacher — upsert 全部寄语（不按提交数组删键）
    if (path === 'teacher' && request.method === 'PUT') {
      const body = await request.json();
      if (!Array.isArray(body)) return json({ error: 'teacher 必须是数组' }, 400);
      await upsertSplitAll(env.CLASS09_CMS, SPLIT.teacher, body);
      await writeLog(env.CLASS09_CMS, 'update_teacher', user.email);
      return json({ ok: true });
    }

    // PUT /api/teacher/:id — 单条落库
    if (path.startsWith('teacher/') && request.method === 'PUT') {
      const id = path.replace('teacher/', '');
      const body = (await request.json()) as any;
      if (!body || body.id !== id) return json({ error: 'id 与路径不一致' }, 400);
      await ensureSplit(env.CLASS09_CMS, SPLIT.teacher);
      await putSplitItem(env.CLASS09_CMS, SPLIT.teacher, body);
      await writeLog(env.CLASS09_CMS, 'update_letter', user.email, id);
      return json({ ok: true });
    }

    // DELETE /api/teacher/:id
    if (path.startsWith('teacher/') && request.method === 'DELETE') {
      const id = path.replace('teacher/', '');
      await ensureSplit(env.CLASS09_CMS, SPLIT.teacher);
      await env.CLASS09_CMS.delete(`${SPLIT.teacher.prefix}${id}`);
      await writeLog(env.CLASS09_CMS, 'delete_letter', user.email, id);
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
      const code = decodeURIComponent(path.replace('invite/', '')).trim().toUpperCase();
      const raw = await env.CLASS09_CMS.get(`invite:${code}`);
      const usedBy = raw ? (JSON.parse(raw).usedBy || '') : '';
      await env.CLASS09_CMS.delete(`invite:${code}`);
      await writeLog(env.CLASS09_CMS, 'revoke_invite', user.email, code);
      // 删邀请码不影响已经注册出来的账号，要收回权限得去「账号」页删号
      return json({ ok: true, usedBy });
    }

    // --- 账号管理（站长专属）---

    // GET /api/accounts — list all accounts (never returns password hashes)
    if (path === 'accounts' && request.method === 'GET') {
      if (user.role !== 'admin') return json({ error: '权限不足' }, 403);
      const keys: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await env.CLASS09_CMS.list({ prefix: 'admin:', cursor }) as any;
        for (const k of page.keys) keys.push(k.name);
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      const accounts = [];
      for (const name of keys) {
        const raw = await env.CLASS09_CMS.get(name);
        if (!raw) continue;
        const a = parseAccount(raw);
        accounts.push({
          email: name.replace('admin:', ''),
          role: a.role || 'admin',
          loginCount: a.loginCount || 0,
          lastLogin: a.lastLogin || null,
          createdAt: a.createdAt || null,
          inviteCode: a.inviteCode || '',
          isSelf: name.replace('admin:', '') === user.email,
        });
      }
      accounts.sort((x, y) => (y.lastLogin || 0) - (x.lastLogin || 0));
      return json(accounts);
    }

    // PUT /api/accounts/:email — change role
    if (path.startsWith('accounts/') && request.method === 'PUT') {
      if (user.role !== 'admin') return json({ error: '仅站长可修改账号' }, 403);
      const email = decodeURIComponent(path.replace('accounts/', ''));
      const { role: newRole } = await request.json() as any;
      if (!['admin', 'editor'].includes(newRole)) return json({ error: '角色只能是 admin 或 editor' }, 400);
      // 禁止改自己 → 能被改的站长必然不是唯一的，不会把站长清空
      if (email === user.email) return json({ error: '不能修改自己的角色' }, 400);
      const raw = await env.CLASS09_CMS.get(`admin:${email}`);
      if (!raw) return json({ error: '账号不存在' }, 404);
      const a = parseAccount(raw);
      await env.CLASS09_CMS.put(`admin:${email}`, JSON.stringify({ ...a, role: newRole }));
      await writeLog(env.CLASS09_CMS, 'update_account_role', user.email, `${email} → ${newRole}`);
      return json({ ok: true });
    }

    // DELETE /api/accounts/:email — remove an account (revokes its sessions too)
    if (path.startsWith('accounts/') && request.method === 'DELETE') {
      if (user.role !== 'admin') return json({ error: '仅站长可删除账号' }, 403);
      const email = decodeURIComponent(path.replace('accounts/', ''));
      if (email === user.email) return json({ error: '不能删除自己的账号' }, 400);
      const raw = await env.CLASS09_CMS.get(`admin:${email}`);
      if (!raw) return json({ error: '账号不存在' }, 404);
      const a = parseAccount(raw);
      const { hash, ...meta } = a;
      // 留档但不进共享回收站：GET /api/trash 对编辑也开放，会泄露其他人的邮箱
      await env.CLASS09_CMS.put(`removed_account:${Date.now()}`, JSON.stringify({
        email, ...meta, deleted_by: user.email, deleted_at: Date.now(),
      }));
      await env.CLASS09_CMS.delete(`admin:${email}`);
      await writeLog(env.CLASS09_CMS, 'delete_account', user.email, email);
      return json({ ok: true });
    }

    // POST /api/password — 自助改密，改完所有旧 token 立即失效
    if (path === 'password' && request.method === 'POST') {
      const { oldPassword, newPassword } = await request.json() as any;
      if (!oldPassword || !newPassword) return json({ error: '请填写原密码和新密码' }, 400);
      if (String(newPassword).length < 8) return json({ error: '新密码至少 8 位' }, 400);
      if (await sha256(oldPassword) !== user.account.hash) return json({ error: '原密码不正确' }, 400);
      await env.CLASS09_CMS.put(`admin:${user.email}`, JSON.stringify({
        ...user.account,
        hash: await sha256(newPassword),
        pwChangedAt: Date.now(),
      }));
      await writeLog(env.CLASS09_CMS, 'change_password', user.email);
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
        const m = await getSplitItem(env.CLASS09_CMS, SPLIT.moments, item.slug);
        if (!m) return json({ error: '原时刻已不存在，无法恢复照片' }, 400);
        m.photos = m.photos || [];
        m.photos.push(item.data);
        m.count = m.photos.length;
        await putSplitItem(env.CLASS09_CMS, SPLIT.moments, m);
      } else if (item.type === 'moment') {
        await ensureSplit(env.CLASS09_CMS, SPLIT.moments);
        await putSplitItem(env.CLASS09_CMS, SPLIT.moments, item.data);
      } else if (item.type === 'honor') {
        await ensureSplit(env.CLASS09_CMS, SPLIT.honors);
        await putSplitItem(env.CLASS09_CMS, SPLIT.honors, item.data);
      } else if (item.type === 'teacher_letter') {
        await ensureSplit(env.CLASS09_CMS, SPLIT.teacher);
        await putSplitItem(env.CLASS09_CMS, SPLIT.teacher, item.data);
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
