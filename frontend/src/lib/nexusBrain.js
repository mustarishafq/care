import { rememberLoginReturn, sanitizeRedirect } from '@/lib/ssoRedirect';

/** EMZI Nexus Brain platform URL (parent SSO / identity hub). */
export const NEXUS_BRAIN_URL =
  import.meta.env.VITE_NEXUS_BRAIN_URL || 'https://emzinexus.com';

export function redirectToNexusBrain(returnPath) {
  const base = NEXUS_BRAIN_URL.replace(/\/$/, '');
  const sanitized = sanitizeRedirect(returnPath);

  if (sanitized) {
    rememberLoginReturn(sanitized);
    const careSsoUrl = `${window.location.origin}/sso/nexus?return_to=${encodeURIComponent(sanitized)}`;
    window.location.href = `${base}?return_to=${encodeURIComponent(careSsoUrl)}`;
    return;
  }

  window.location.href = base;
}
