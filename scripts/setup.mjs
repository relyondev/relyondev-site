import { randomBytes, createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node.js 24 LTS.');
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message || result.status}`);
}
mkdirSync('.downloads', { recursive: true });
if (!existsSync('apps/web/dist/index.html') || !existsSync('content/media')) {
  // Stream public assets to disk; no GitHub token or CLI is needed.
  for (const name of ['site-assets.tar.gz', 'SHA256SUMS']) {
    console.log(`Downloading ${name}…`);
    const response = await fetch(`https://github.com/relyondev/relyondev-site/releases/download/v${version}/${name}`, { signal: AbortSignal.timeout(900_000) });
    if (!response.ok || !response.body) throw new Error(`Release download failed: ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(`.downloads/${name}`));
  }
  const expected = readFileSync('.downloads/SHA256SUMS', 'utf8').trim().split(/\s+/)[0];
  const hash = createHash('sha256');
  for await (const chunk of createReadStream('.downloads/site-assets.tar.gz')) hash.update(chunk);
  const actual = hash.digest('hex');
  if (actual !== expected) throw new Error('Release asset checksum mismatch');
  run('tar', ['-xzf', '.downloads/site-assets.tar.gz']);
}
cpSync('apps/web/brand', 'apps/web/dist/brand', { recursive: true });
const secretFile = resolve('apps/cms/.local-secret');
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
run('npm', ['ci'], resolve('apps/cms'));
run(process.execPath, ['scripts/cms.mjs', 'seed']);
console.log('Setup finished. Run npm run dev and create your admin at http://localhost:3001/admin.');
