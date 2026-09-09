#!/usr/bin/env node
// 把备份桶里最近一次（或指定日期）的快照拉到本地，可选再写一份到 NAS。
//
//   npm run backup                                          # 拉最近一次
//   npm run backup -- --date 2026-09-09                      # 拉指定日期
//   CLASS09_BACKUP_DIR=/Volumes/NAS/class09 npm run backup    # 额外写一份异地副本
//
// 快照本体由 Worker 生成（它同时握着 KV 和 R2 的 binding），由每日 cron 或后台
// 「备份」页的按钮触发。本地脚本只做搬运，所以这台电脑不开机也不影响备份。

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { r2Get, requireNode22, log, warn, die, argValue } from './lib/cf.mjs';

const BUCKET = 'class09-backup';
const FILES = ['manifest.json', 'kv.json', 'logs.json', 'r2-manifest.json'];

requireNode22();

let date = argValue('--date');
if (!date) {
  const latestRaw = r2Get(BUCKET, 'snapshots/latest.json');
  if (!latestRaw) {
    die('备份桶里还没有任何快照。到后台「备份」页点一次「立即备份」，或等每日 11:00 自动备份。');
  }
  date = JSON.parse(latestRaw).date;
}

const contents = {};
for (const name of FILES) {
  const body = r2Get(BUCKET, `snapshots/${date}/${name}`);
  // 缺文件的快照不能拿去恢复，宁可这里失败也别让人以为手里有一份完整备份。
  if (body === null) die(`快照 ${date} 缺少 ${name}，这份快照不完整，不要用它恢复`);
  contents[name] = body;
}

const manifest = JSON.parse(contents['manifest.json']);
const snapshotBytes = Object.values(contents).reduce((s, b) => s + Buffer.byteLength(b), 0);
log(`快照 ${date}：${manifest.kvContentKeys} 条内容 · ${manifest.kvLogKeys} 条操作记录 · ${(snapshotBytes / 1024).toFixed(0)} KB`);
// 照片二进制只在主桶存一份，快照只记清单不重复拷，别让人误以为每天要占这么多。
log(`它索引了主桶里 ${manifest.r2ObjectCount} 个照片/音频文件（共 ${(manifest.r2TotalBytes / 1048576).toFixed(1)} MB，这些文件不随快照重复复制）`);

const digest = createHash('sha256')
  .update(contents['kv.json'])
  .update(contents['r2-manifest.json'])
  .digest('hex');

const targets = [join(process.cwd(), 'backups', date)];
if (process.env.CLASS09_BACKUP_DIR) targets.push(join(process.env.CLASS09_BACKUP_DIR, date));

for (const dir of targets) {
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(contents)) writeFileSync(join(dir, name), body);
  writeFileSync(join(dir, 'checksum.txt'), `sha256(kv.json + r2-manifest.json) = ${digest}\n`);
  log(`已写入 ${dir}`);
}

// 快照里含账号密码 hash 和时光胶囊信正文，进了 Git 就等于公开了。
const gitignorePath = join(process.cwd(), '.gitignore');
if (existsSync(gitignorePath) && !readFileSync(gitignorePath, 'utf8').includes('backups/')) {
  warn('.gitignore 里没有 backups/。备份含密码 hash 和胶囊信正文，先忽略它再提交任何东西。');
}
if (!process.env.CLASS09_BACKUP_DIR) {
  log('提示：设 CLASS09_BACKUP_DIR 指向 NAS 目录，就会同时写一份异地副本。');
}
