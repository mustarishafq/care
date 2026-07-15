import { getUserFacingError, statusFallbackMessage } from '@/lib/userFacingError';

const TOKEN_KEY = 'care_auth_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

function getUploadErrorMessage(status, raw = '') {
  const body = raw.toLowerCase();

  if (
    status === 413 ||
    body.includes('too large') ||
    body.includes('exceeds the limit') ||
    body.includes('upload_max_filesize') ||
    body.includes('post_max_size') ||
    body.includes('content-length of') ||
    body.includes('entity too large')
  ) {
    return 'The file is too large. Maximum size is 10 MB.';
  }

  return null;
}

function getApiErrorMessage(data, status, raw = '') {
  const uploadMessage = getUploadErrorMessage(status, raw);
  if (uploadMessage) return uploadMessage;

  if (!data) {
    return statusFallbackMessage(status);
  }

  const fieldErrors = data.errors ? Object.values(data.errors).flat().filter(Boolean) : [];
  if (fieldErrors.length) {
    return getUserFacingError({ message: fieldErrors[0], status }, fieldErrors[0]);
  }

  if (data.message && data.message !== 'The given data was invalid.') {
    return getUserFacingError({ message: data.message, status }, statusFallbackMessage(status));
  }

  return statusFallbackMessage(status);
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) {
    return { data: null, raw: '' };
  }

  const trimmed = text.trim();
  const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');

  if (looksLikeJson) {
    try {
      return { data: JSON.parse(text), raw: text };
    } catch {
      return { data: null, raw: text, parseFailed: true };
    }
  }

  if (trimmed.startsWith('<')) {
    return { data: null, raw: text, html: true };
  }

  return { data: null, raw: text };
}

function getUnexpectedResponseMessage(status, raw = '') {
  return getUploadErrorMessage(status, raw)
    || (status >= 500
      ? statusFallbackMessage(500)
      : 'Unexpected server response. Please try again.');
}

class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request(method, path, { body, formData, params } = {}) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers = {
    Accept: 'application/json',
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const options = { method, headers };

  if (formData) {
    options.body = formData;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), options);
  const { data, raw, parseFailed, html } = await readResponseBody(response);

  if (!response.ok) {
    const message = getApiErrorMessage(data, response.status, raw);
    throw new ApiError(message, response.status, data);
  }

  if (parseFailed || html) {
    const message = getUnexpectedResponseMessage(response.status, raw);
    throw new ApiError(message, response.status, data);
  }

  return data;
}

function filenameFromContentDisposition(header) {
  if (!header) return null;
  const utfMatch = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim().replace(/['"]/g, ''));
    } catch {
      return utfMatch[1].trim().replace(/['"]/g, '');
    }
  }
  const plainMatch = header.match(/filename\s*=\s*("?)([^";]+)\1/i);
  return plainMatch?.[2]?.trim() || null;
}

async function download(path, params = {}, fallbackFilename = 'download.xlsx') {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const headers = {
    // Prefer JSON so Laravel returns parseable API errors instead of opaque "Server Error".
    Accept: 'application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), { method: 'GET', headers });

  if (!response.ok) {
    const { data, raw } = await readResponseBody(response);
    const message = getApiErrorMessage(data, response.status || 500, raw);
    throw new ApiError(message, response.status || 500, data);
  }

  const blob = await response.blob();
  const filename = filenameFromContentDisposition(response.headers.get('content-disposition'))
    || fallbackFilename;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);

  return { filename };
}

export const http = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
  upload: (path, formData) => request('POST', path, { formData }),
  download,
};

export { ApiError };
