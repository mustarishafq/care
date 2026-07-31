#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBackendUrl } from './backend-url.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const frontend = path.join(root, 'frontend');

console.log(`API:      ${getBackendUrl()}`);
console.log(`Frontend: http://localhost:5174\n`);

const children = [
  spawn('node', [path.join(__dirname, 'serve-backend.js')], {
    cwd: root,
    stdio: 'inherit',
  }),
  spawn('npm', ['run', 'dev'], {
    cwd: frontend,
    stdio: 'inherit',
  }),
];

const shutdown = (signal) => {
  for (const child of children) {
    child.kill(signal);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (signal) {
      shutdown(signal);
      process.exit(0);
    }
    if (code !== 0 && code !== null) {
      shutdown('SIGTERM');
      process.exit(code);
    }
  });
}
