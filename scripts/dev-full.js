#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const backend = path.join(root, 'backend');
const frontend = path.join(root, 'frontend');

function run(cmd, cwd = root) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function copyEnvIfMissing() {
  const envPath = path.join(backend, '.env');
  const examplePath = path.join(backend, '.env.example');
  if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('Copied backend/.env.example to backend/.env');
  }

  const frontendEnv = path.join(frontend, '.env');
  const frontendExample = path.join(frontend, '.env.example');
  if (!fs.existsSync(frontendEnv) && fs.existsSync(frontendExample)) {
    fs.copyFileSync(frontendExample, frontendEnv);
    console.log('Copied frontend/.env.example to frontend/.env');
  }
}

function ensureAppKey() {
  const envPath = path.join(backend, '.env');
  if (!fs.existsSync(envPath)) return;

  const env = fs.readFileSync(envPath, 'utf8');
  if (!env.match(/^APP_KEY=base64:/m)) {
    run('php artisan key:generate', backend);
  }
}

try {
  console.log('=== EMZI Nexus Care — Full Dev Setup ===\n');

  run('npm install', frontend);
  run('composer install --no-interaction', backend);

  copyEnvIfMissing();
  ensureAppKey();

  run('php artisan migrate --force', backend);
  run('php artisan db:seed --force', backend);
  run('php artisan storage:link', backend);

  console.log('\n=== Starting servers ===\n');
  console.log('Backend:  http://localhost:8000');
  console.log('Frontend: http://localhost:5173');
  console.log('Admin:    admin@admin.com / password\n');

  const backendProc = spawn('php', ['artisan', 'serve', '--port=8000'], {
    cwd: backend,
    stdio: 'inherit',
  });

  const frontendProc = spawn('npm', ['run', 'dev'], {
    cwd: frontend,
    stdio: 'inherit',
  });

  const shutdown = () => {
    backendProc.kill();
    frontendProc.kill();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (err) {
  console.error('Setup failed:', err.message);
  process.exit(1);
}
