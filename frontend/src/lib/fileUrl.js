const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

/** Build a file URL using the same base as API requests (VITE_API_URL). */
function apiFileUrl(relativePath) {
  const path = String(relativePath).replace(/^\/+/, '');
  const filePath = path.startsWith('files/') ? path : `files/${path}`;

  return new URL(`${API_BASE}/${filePath}`, window.location.origin).href;
}

/**
 * Resolve proof/attachment paths for display (handles legacy /storage/ and /api/v1/files/ URLs).
 */
export function resolveFileUrl(url) {
  if (!url) {
    return url;
  }

  const normalized = String(url).trim();

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    try {
      return resolveFileUrl(new URL(normalized).pathname);
    } catch {
      return normalized;
    }
  }

  if (normalized.startsWith(`${API_BASE}/files/`)) {
    return apiFileUrl(normalized.slice(`${API_BASE}/files/`.length));
  }

  if (normalized.includes('/files/')) {
    return apiFileUrl(normalized.split('/files/').pop());
  }

  if (normalized.startsWith('/storage/')) {
    return apiFileUrl(normalized.slice('/storage/'.length));
  }

  if (normalized.startsWith('storage/')) {
    return apiFileUrl(normalized.slice('storage/'.length));
  }

  return apiFileUrl(normalized);
}
