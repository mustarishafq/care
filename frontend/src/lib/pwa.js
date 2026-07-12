/**
 * True when the app is running as an installed PWA / home-screen web app.
 * Used to apply env(safe-area-inset-*) only when there is no browser chrome
 * already clearing the home indicator (see MOBILE_BOTTOM_NAV_DESIGN §2.1).
 */
export function isRunningStandalone() {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    // iOS Safari "Add to Home Screen"
    window.navigator.standalone === true
  );
}
