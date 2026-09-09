// 三个灾备脚本共用的 wrangler 包装。
// 一律走 wrangler CLI 而不是 Cloudflare REST API：这样复用已有的 wrangler 登录态，
// 不需要再生成、保管一个 API token。

import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const KV_BINDING = 'CLASS09_CMS';
// KV bulk 接口单次上限 100 个键，超了整个请求会被拒。
export const BULK_LIMIT = 100;

export function log(msg) { console.log(msg); }
export function warn(msg) { console.warn(`⚠ ${msg}`); }
export function die(msg) { console.error(`✘ ${msg}`); process.exit(1); }

export function requireNode22() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 22) die(`需要 Node 22+（当前 ${process.versions.node}）。试试 PATH="$HOME/.local/bin:$PATH" npm run ...`);
}

export function hasFlag(name) { return process.argv.slice(2).includes(name); }

export function argValue(name) {
  const args = process.argv.slice(2);
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export function wrangler(args, { allowFail = false } = {}) {
  const res = spawnSync('npx', ['wrangler', ...args], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  if (res.status !== 0) {
    if (allowFail) return null;
    die(`wrangler ${args.join(' ')} 失败：\n${res.stderr || res.stdout}`);
  }
  return res.stdout;
}

export function r2Get(bucket, key) {
  const tmp = join(mkdtempSync(join(tmpdir(), 'class09-r2-')), 'obj');
  // r2 object get 默认就是远端，传 --remote 会被拒。失败时它仍会留下一个 0 字节文件，所以空内容也算没读到。
  const out = wrangler(['r2', 'object', 'get', `${bucket}/${key}`, '--file', tmp], { allowFail: true });
  if (out === null) return null;
  try {
    const body = readFileSync(tmp, 'utf8');
    return body.length ? body : null;
  } catch { return null; }
}

export function kvListKeys() {
  // kv key list 默认就是远端，传 --remote 反而会被拒（只有 --local 才切到本地）。
  const raw = wrangler(['kv', 'key', 'list', '--binding', KV_BINDING]);
  // wrangler 会把更新提示混进 stdout，只取 JSON 数组那一段。
  const start = raw.indexOf('[');
  if (start < 0) die('读不到 KV 键列表');
  return JSON.parse(raw.slice(start));
}

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function wranglerAsync(args) {
  return new Promise((resolve) => {
    const child = spawn('npx', ['wrangler', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

// 逐键读取 KV，返回 { key: value }。
// wrangler 3.114.17 没有 `kv bulk get`（只有 bulk put / bulk delete），只能一个个读；
// 单次调用约 3 秒，130 个键串行要 7 分钟，所以限流并发跑。
export async function kvGetMany(keys, { concurrency = 8, onProgress } = {}) {
  const result = {};
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < keys.length) {
      const key = keys[next++];
      const { code, out, err } = await wranglerAsync(['kv', 'key', 'get', key, '--binding', KV_BINDING, '--text']);
      // 读不到值和值为空是两回事，前者必须报错，不能当成"线上没有"悄悄覆盖掉。
      if (code !== 0) die(`读取 KV 键 ${key} 失败：\n${err || out}`);
      // wrangler 用 console.log 打值，固定多一个换行。只剥一个，值本身结尾有换行时也不会被吃掉。
      result[key] = out.endsWith('\n') ? out.slice(0, -1) : out;
      if (onProgress) onProgress(++done, keys.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, keys.length) }, worker));
  return result;
}

// 分块写入 KV。每条可带 metadata，用来保住条目顺序（order）。
export function kvBulkPut(entries) {
  for (const group of chunk(entries, BULK_LIMIT)) {
    const dir = mkdtempSync(join(tmpdir(), 'class09-kv-'));
    const file = join(dir, 'put.json');
    writeFileSync(file, JSON.stringify(group));
    wrangler(['kv', 'bulk', 'put', file, '--binding', KV_BINDING]);
    rmSync(dir, { recursive: true, force: true });
  }
}

// 分块删除 KV。-f 跳过 wrangler 自己的交互确认，调用方必须已经拿到用户的明确许可。
export function kvBulkDelete(keys) {
  for (const group of chunk(keys, BULK_LIMIT)) {
    const dir = mkdtempSync(join(tmpdir(), 'class09-kv-'));
    const file = join(dir, 'delete.json');
    writeFileSync(file, JSON.stringify(group));
    wrangler(['kv', 'bulk', 'delete', file, '--binding', KV_BINDING, '-f']);
    rmSync(dir, { recursive: true, force: true });
  }
}
