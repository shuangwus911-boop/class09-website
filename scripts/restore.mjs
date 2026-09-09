#!/usr/bin/env node
// 用一份快照把 KV 内容补回去。默认只报差异，不写任何东西。
//
//   npm run restore -- --from backups/2026-09-09              # 只看差异（默认）
//   npm run restore -- --from backups/2026-09-09 --apply       # 补齐 + 覆盖回快照版本
//   npm run restore -- --from ... --apply --include-logs       # 连操作记录一起补
//   npm run restore -- --from ... --apply --allow-delete       # 才会删线上多出来的键
//
// 核心约束：默认只做 upsert。线上比快照新的内容（快照之后上传的照片、新写的时刻）
// 一律保留，只列出来提示。删除必须显式加 --allow-delete，这样"回滚代码"不会顺手
// 把回滚点之后的新内容一起弄丢。

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  requireNode22, log, warn, die, argValue, hasFlag,
  kvListKeys, kvGetMany, kvBulkPut, kvBulkDelete,
} from './lib/cf.mjs';

// 快照总是比线上旧，所以它天然缺少快照之后产生的记录。
// 这几类是"只增不减"的历史，删掉就等于抹掉审计痕迹或让回收站里的东西真的没了。
const NEVER_DELETE = ['log:', 'trash:', 'removed_account:'];

requireNode22();

const apply = hasFlag('--apply');
const allowDelete = hasFlag('--allow-delete');
const includeLogs = hasFlag('--include-logs');

if (allowDelete && !apply) die('--allow-delete 只能和 --apply 一起用');

let from = argValue('--from');
if (!from) {
  const dir = join(process.cwd(), 'backups');
  const dates = existsSync(dir) ? readdirSync(dir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() : [];
  if (!dates.length) die('本地没有快照。先跑 npm run backup 把快照拉下来，或用 --from 指定目录。');
  from = join(dir, dates[dates.length - 1]);
  log(`未指定 --from，用最近一份本地快照：${from}`);
}

const readSnapshot = (name) => {
  const p = join(from, name);
  if (!existsSync(p)) die(`${from} 里没有 ${name}，这份快照不完整，不要用它恢复`);
  return JSON.parse(readFileSync(p, 'utf8'));
};

const manifest = readSnapshot('manifest.json');
const snapshot = readSnapshot('kv.json');
const want = new Map();
for (const [key, entry] of Object.entries(snapshot)) want.set(key, entry);
if (includeLogs) {
  for (const [key, value] of Object.entries(readSnapshot('logs.json'))) want.set(key, { value });
}

log(`快照 ${manifest.date}（${manifest.trigger}）：${want.size} 个待比对的键`);

const liveKeys = kvListKeys().map((k) => k.name);
const liveSet = new Set(liveKeys);

const toAdd = [...want.keys()].filter((k) => !liveSet.has(k));
const shared = [...want.keys()].filter((k) => liveSet.has(k));
const extra = liveKeys.filter((k) => !want.has(k));

log(`线上 ${liveKeys.length} 个键，读取 ${shared.length} 个用于比对（约需 ${Math.ceil(shared.length * 3 / 8)} 秒）…`);
const liveValues = await kvGetMany(shared, {
  onProgress: (done, total) => { if (done % 25 === 0 || done === total) log(`  已读 ${done}/${total}`); },
});

const changed = shared.filter((k) => (want.get(k).value ?? null) !== (liveValues[k] ?? null));

const show = (title, keys) => {
  log(`\n${title}（${keys.length}）`);
  for (const k of keys.slice(0, 30)) log(`  ${k}`);
  if (keys.length > 30) log(`  …另外 ${keys.length - 30} 个`);
};

show('快照有、线上没有 → 会补回去', toAdd);
show('两边都有但内容不同 → 会覆盖成快照里的版本', changed);
show(allowDelete ? '线上多出来的 → 会删除' : '线上多出来的（快照之后新增的）→ 保留不动', extra);

const deletable = allowDelete ? extra.filter((k) => !NEVER_DELETE.some((p) => k.startsWith(p))) : [];
const protectedKeys = allowDelete ? extra.filter((k) => NEVER_DELETE.some((p) => k.startsWith(p))) : [];
if (protectedKeys.length) {
  warn(`即使加了 --allow-delete，${protectedKeys.length} 个 ${NEVER_DELETE.join('/')} 键也不会删——它们是只增不减的历史记录。`);
}

if (!includeLogs) {
  log('\n操作记录（log:）本次不参与比对，加 --include-logs 才会一起恢复。');
}
// R2 只有 Worker 才能列，CLI 没有 r2 object list，所以这里不做照片比对。
log(`快照记录了 ${manifest.r2ObjectCount} 个 R2 文件，本脚本不比对照片二进制。误删的照片走后台「回收站」恢复，删除前的原图在备份桶 deleted/ 下。`);

if (!apply) {
  log(`\n这是 dry run，什么都没改。确认无误后加 --apply。`);
  process.exit(0);
}

if (!toAdd.length && !changed.length && !deletable.length) {
  log('\n线上与快照一致，无需改动。');
  process.exit(0);
}

const entries = [...toAdd, ...changed].map((key) => {
  const entry = want.get(key);
  const row = { key, value: entry.value ?? '' };
  // metadata 存着条目顺序（order），丢了前台排序就乱了。
  if (entry.metadata) row.metadata = entry.metadata;
  return row;
});

if (entries.length) {
  log(`\n写入 ${entries.length} 个键…`);
  kvBulkPut(entries);
}
if (deletable.length) {
  log(`删除 ${deletable.length} 个键…`);
  kvBulkDelete(deletable);
}
log('恢复完成。KV 读取有约 60 秒缓存，前台可能要等一会儿才看到变化。');
