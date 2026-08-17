// Playwright webServer command: build the workspace server, seed deterministic
// fixture batches in a temporary data directory, then run the share API.

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const webDir = process.cwd();
const repoDir = path.resolve(webDir, '..', '..');
const dataDir = path.join(repoDir, '.playwright-data');
const env = {
  ...process.env,
  SANITIZE_SECRET: 'playwright-secret',
  DATA_DIR: dataDir,
  PORT: '3000',
  BOT_USERNAME: 'examplebot',
};

rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });
const pnpm = process.platform === 'win32'
  ? path.join(process.env.APPDATA || '', 'npm', 'pnpm.cmd')
  : 'pnpm';
execFileSync(
  process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : pnpm,
  process.platform === 'win32'
    ? ['/d', '/s', '/c', pnpm, '--filter', '@tbfb/server', 'build']
    : ['--filter', '@tbfb/server', 'build'],
  { cwd: repoDir, env, stdio: 'inherit' },
);
execFileSync(
  process.execPath,
  ['--experimental-strip-types', 'apps/server/scripts/seed-share.ts'],
  { cwd: repoDir, env, stdio: 'inherit' },
);

const server = spawn(process.execPath, ['apps/server/dist/main.js'], {
  cwd: repoDir,
  env,
  stdio: 'inherit',
});
server.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
