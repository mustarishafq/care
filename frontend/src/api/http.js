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
    if (status >= 500) return 'Something went wrong on the server. Please try again.';
    return `Request failed (${status})`;
  }

  const fieldErrors = data.errors ? Object.values(data.errors).flat().filter(Boolean) : [];
  if (fieldErrors.length) return fieldErrors[0];

  if (data.message && data.message !== 'The given data was invalid.') return data.message;

  return `Request failed (${status})`;
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
    || (status >= 500 ? 'Something went wrong on the server. Please try again.' : 'Unexpected server response. Please try again.');
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

export const http = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  delete: (path) => request('DELETE', path),
  upload: (path, formData) => request('POST', path, { formData }),
};

export { ApiError };
