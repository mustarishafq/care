const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v', 'ogv']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);

export const MAX_PROOF_FILE_BYTES = 10 * 1024 * 1024;

export function getProofFileExtension(urlOrName = '') {
  const withoutQuery = String(urlOrName).split('?')[0];
  const parts = withoutQuery.split('.');
  if (parts.length < 2) return '';
  return parts.pop().toLowerCase();
}

export function getProofFileKind(urlOrName, { isImage, isVideo } = {}) {
  if (isImage) return 'image';
  if (isVideo) return 'video';
  const ext = getProofFileExtension(urlOrName);
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  return 'document';
}

export function formatProofFileSize(bytes) {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
