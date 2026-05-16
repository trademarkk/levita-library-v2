import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const isWindows = process.platform === 'win32';
const viteBin = join(rootDir, 'node_modules', '.bin', isWindows ? 'vite.cmd' : 'vite');

const children = [
  spawn(process.execPath, ['server/api.mjs'], { cwd: rootDir, stdio: 'inherit' }),
  spawn(viteBin, ['--host', '127.0.0.1'], { cwd: rootDir, stdio: 'inherit', shell: isWindows }),
];

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

for (const child of children) {
  child.on('exit', (code) => {
    if (!shuttingDown && code && code !== 0) shutdown(code);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
