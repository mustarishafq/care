const DEFAULT_REDIRECT = '/dashboard';
const LOGIN_RETURN_KEY = 'nexus_login_return';

export function resolveSsoRedirect(...candidates) {
  for (const candidate of candidates) {
    const resolved = sanitizeRedirect(candidate);
    if (resolved) return resolved;
  }

  return DEFAULT_REDIRECT;
}

export function sanitizeRedirect(value) {
  const redirectTo = String(value ?? '').trim();
  if (!redirectTo) return null;

  if (redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
    return redirectTo;
  }

  try {
    const url = new URL(redirectTo, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function rememberSsoRedirect(value) {
  const resolved = sanitizeRedirect(value);
  if (!resolved) return null;
  sessionStorage.setItem('nexus_redirect_to', resolved);
  return resolved;
}

export function consumeStoredSsoRedirect() {
  const stored = sessionStorage.getItem('nexus_redirect_to');
  sessionStorage.removeItem('nexus_redirect_to');
  return sanitizeRedirect(stored);
}

export function readLoginReturnFromSearch(searchParams) {
  return resolveSsoRedirect(
    searchParams.get('redirect_to'),
    searchParams.get('return_to'),
    searchParams.get('return'),
  );
}

export function rememberLoginReturn(value) {
  const resolved = sanitizeRedirect(value);
  if (!resolved) return null;
  sessionStorage.setItem(LOGIN_RETURN_KEY, resolved);
  return resolved;
}

export function consumeLoginReturn() {
  const stored = sessionStorage.getItem(LOGIN_RETURN_KEY);
  sessionStorage.removeItem(LOGIN_RETURN_KEY);
  return sanitizeRedirect(stored);
}

export function clearStoredSsoRedirects() {
  sessionStorage.removeItem('nexus_redirect_to');
  sessionStorage.removeItem('nexus_return_to');
  sessionStorage.removeItem(LOGIN_RETURN_KEY);
}
