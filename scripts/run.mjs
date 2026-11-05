import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const cms = new URL('../apps/cms/', import.meta.url);
const env = { ...process.env, PAYLOAD_SCHEMA_PUSH: '0',
  PAYLOAD_SECRET: process.env.PAYLOAD_SECRET || readFileSync(new URL('.local-secret', cms), 'utf8') };
const production = process.argv.includes('--production');
const children = [
  spawn(process.execPath, ['server.mjs'], { cwd: new URL('../apps/web/', import.meta.url), env: { ...env, HOST: '127.0.0.1', PORT: '3000' }, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/next/dist/bin/next', production ? 'start' : 'dev', '-H', '127.0.0.1', '-p', '3001'], { cwd: cms, env, stdio: 'inherit' }),
  spawn(process.execPath, ['scripts/embedding-worker.ts'], { cwd: cms, env, stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
for (const child of children) {
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 1); });
}
