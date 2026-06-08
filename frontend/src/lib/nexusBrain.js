/** EMZI Nexus Brain platform URL (parent SSO / identity hub). */
export const NEXUS_BRAIN_URL =
  import.meta.env.VITE_NEXUS_BRAIN_URL || 'https://emzinexus.com';

export function redirectToNexusBrain() {
  window.location.href = NEXUS_BRAIN_URL;
}
