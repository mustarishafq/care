import { useEffect, useState } from 'react';

/**
 * Soft-keyboard inset only — not Safari URL-bar chrome.
 *
 * Tracking every visualViewport resize lifts the dock mid-scroll when the
 * toolbar expands (scroll up) and drops it again when scrolling settles.
 * Toolbar deltas are typically < ~150px; the soft keyboard is much larger.
 */
const KEYBOARD_OFFSET_THRESHOLD_PX = 150;

/**
 * Distance (px) to lift fixed bottom UI above the soft keyboard.
 * Returns 0 during Safari chrome expand/collapse so the dock stays pinned.
 *
 * raw = max(0, round(innerHeight - visualViewport.height - visualViewport.offsetTop))
 */
function readKeyboardBottomOffset() {
  if (typeof window === 'undefined') return 0;
  const vv = window.visualViewport;
  if (!vv) return 0;

  const raw = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  return raw >= KEYBOARD_OFFSET_THRESHOLD_PX ? raw : 0;
}

export function useVisualViewportBottomOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let rafId = 0;

    const update = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setOffset(readKeyboardBottomOffset());
      });
    };

    update();

    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    return () => {
      cancelAnimationFrame(rafId);
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return offset;
}
