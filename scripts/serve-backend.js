#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBackendPort } from './backend-url.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backend = path.join(__dirname, '..', 'backend');

spawn('php', ['artisan', 'serve', `--port=${getBackendPort()}`], {
  cwd: backend,
  stdio: 'inherit',
});
