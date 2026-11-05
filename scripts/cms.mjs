import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const cwd = new URL('../apps/cms/', import.meta.url);
const commands = { seed: ['scripts/seed-content.ts'], build: ['node_modules/next/dist/bin/next', 'build'] };
const args = commands[process.argv[2]];
if (!args) throw new Error('Expected seed or build');
const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', env: {
  ...process.env, PAYLOAD_SECRET: process.env.PAYLOAD_SECRET || readFileSync(new URL('.local-secret', cwd), 'utf8'),
  PAYLOAD_SCHEMA_PUSH: process.argv[2] === 'seed' ? '1' : '0',
} });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
