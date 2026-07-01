import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendEnvPath = path.join(__dirname, '..', 'backend', '.env');

export function getBackendUrl() {
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }

  if (fs.existsSync(backendEnvPath)) {
    const env = fs.readFileSync(backendEnvPath, 'utf8');
    const match = env.match(/^APP_URL=(.+)$/m);
    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  return 'http://localhost:8000';
}

export function getBackendPort() {
  if (process.env.BACKEND_PORT) {
    return process.env.BACKEND_PORT;
  }

  try {
    const parsed = new URL(getBackendUrl());
    if (parsed.port) return parsed.port;
  } catch {
    // fall through
  }

  return '8000';
}
