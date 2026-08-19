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
  PORT: process.env.SHARE_TEST_API_PORT || '3000',
  BOT_USERNAME: 'examplebot',
};

rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
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

const cleanup = () => rmSync(dataDir, { recursive: true, force: true });
const server = spawn(process.execPath, ['apps/server/dist/main.js'], {
  cwd: repoDir,
  env,
  stdio: 'inherit',
});
server.on('exit', (code) => {
  cleanup();
  process.exit(code ?? 0);
});
server.on('error', cleanup);
process.on('exit', cleanup);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    cleanup();
    server.kill(signal);
  });
}
