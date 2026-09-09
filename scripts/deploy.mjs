#!/usr/bin/env node
// 构建 + 部署 + 把「这次部署对应哪个 commit」记进备份桶。
//
//   npm run deploy
//
// 记这一笔是为了回滚时能看懂版本列表：Cloudflare 只给 version id 和时间，
// 光看 UUID 没法判断该退到哪一版。

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requireNode22, log, warn, die, wrangler } from './lib/cf.mjs';

const BUCKET = 'class09-backup';

requireNode22();

const git = (args) => spawnSync('git', args, { encoding: 'utf8' }).stdout.trim();
const sha = git(['rev-parse', 'HEAD']);
const subject = git(['log', '-1', '--pretty=%s']);
const dirty = git(['status', '--porcelain']).length > 0;
if (dirty) warn('工作区有未提交的改动，部署上去的代码和这个 commit 并不完全一致（已记进部署清单）。');

const run = (cmd, args) => {
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.status !== 0) die(`${cmd} ${args.join(' ')} 失败，已中止部署`);
};

run('npm', ['run', 'build']);

const out = spawnSync('npx', ['wrangler', 'deploy'], { encoding: 'utf8' });
process.stdout.write(out.stdout || '');
process.stderr.write(out.stderr || '');
if (out.status !== 0) die('wrangler deploy 失败');

const versionId = (`${out.stdout}${out.stderr}`.match(/Current Version ID:\s*([0-9a-f-]{36})/) || [])[1];
if (!versionId) {
  warn('部署成功了，但没解析出 Version ID，这次没能记进部署清单。回滚时请用 npx wrangler versions list 自己核对时间。');
  process.exit(0);
}

const record = { versionId, sha, subject, dirty, deployedAt: new Date().toISOString() };
const dir = mkdtempSync(join(tmpdir(), 'class09-deploy-'));
const file = join(dir, 'record.json');
writeFileSync(file, JSON.stringify(record));
wrangler(['r2', 'object', 'put', `${BUCKET}/deployments/${versionId}.json`, '--file', file, '--content-type', 'application/json']);

log(`\n已部署 ${versionId}`);
log(`对应 commit ${sha.slice(0, 8)} ${subject}${dirty ? '（工作区不干净）' : ''}`);
log('要退回上一版：npm run rollback');
