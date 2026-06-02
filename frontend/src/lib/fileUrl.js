const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Resolve proof/attachment URLs for display (handles legacy /storage/ paths).
 */
export function resolveFileUrl(url) {
  if (!url) {
    return url;
  }

  const normalized = String(url).trim();

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    try {
      const { pathname } = new URL(normalized);
      return resolveFileUrl(pathname);
    } catch {
      return normalized;
    }
  }

  if (normalized.startsWith(`${API_BASE}/files/`)) {
    return normalized;
  }

  if (normalized.startsWith('/api/v1/files/')) {
    return normalized;
  }

  if (normalized.startsWith('/storage/')) {
    return `${API_BASE}/files/${normalized.slice('/storage/'.length)}`;
  }

  if (normalized.startsWith('storage/')) {
    return `${API_BASE}/files/${normalized.slice('storage/'.length)}`;
  }

  if (normalized.startsWith('uploads/')) {
    return `${API_BASE}/files/${normalized}`;
  }

  return normalized;
}
