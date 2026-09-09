#!/usr/bin/env node
// 列出最近的 Worker 版本，并把线上流量切回指定的一版。
//
//   npm run rollback                      # 只列版本，什么都不改
//   npm run rollback -- --to <versionId>  # 把 100% 流量切到这一版
//
// 只回滚代码。KV 里的内容、R2 里的照片都是活数据，回滚版本不会动它们，
// 也不会把回滚点之后新增的照片弄丢。内容层面的恢复走 npm run restore。

import { requireNode22, log, warn, die, argValue, wrangler, r2Get } from './lib/cf.mjs';

const BUCKET = 'class09-backup';
const SHOW = 10;

requireNode22();

const raw = wrangler(['versions', 'list', '--json']);
const start = raw.indexOf('[');
if (start < 0) die('读不到版本列表');
const versions = JSON.parse(raw.slice(start)).sort((a, b) => b.number - a.number);

const to = argValue('--to');

if (!to) {
  log(`最近 ${SHOW} 个版本（新的在上面）：\n`);
  for (const v of versions.slice(0, SHOW)) {
    // 部署清单是 npm run deploy 写进备份桶的；手工 deploy 或从 dashboard 改的版本会查不到，属正常。
    const recordRaw = r2Get(BUCKET, `deployments/${v.id}.json`);
    const record = recordRaw ? JSON.parse(recordRaw) : null;
    const commit = record ? `${record.sha.slice(0, 8)} ${record.subject}${record.dirty ? '（工作区不干净）' : ''}` : `无部署记录（${v.metadata.source}）`;
    log(`  #${v.number}  ${v.id}`);
    log(`         ${new Date(v.metadata.created_on).toLocaleString('zh-CN')}  ${commit}`);
  }
  log(`\n要回滚：npm run rollback -- --to <versionId>`);
  log('注意：这只换代码。照片和内容都在 KV/R2 里，回滚不会动它们，也不会丢回滚点之后新加的照片。');
  process.exit(0);
}

const target = versions.find((v) => v.id === to);
if (!target) die(`版本列表里没有 ${to}。先跑 npm run rollback 看一眼可用版本。`);
if (target.id === versions[0].id) warn('这已经是最新版本，回滚它等于什么都没做。');

log(`把 100% 流量切到 #${target.number} ${target.id}（${new Date(target.metadata.created_on).toLocaleString('zh-CN')}）…`);
wrangler(['versions', 'deploy', `${target.id}@100`, '-y', '--message', `rollback to #${target.number}`]);
log('\n代码已回滚。KV 内容和 R2 照片没有任何改动。');
log('如果内容也需要退回，再跑 npm run restore（默认只报差异，不会删线上新内容）。');
