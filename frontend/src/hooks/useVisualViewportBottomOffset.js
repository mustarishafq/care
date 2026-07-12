import { useEffect, useState } from 'react';

/**
 * Distance (px) from the layout viewport bottom to the visual viewport bottom.
 * On iOS Safari, collapsing/expanding chrome changes the visual viewport while
 * the layout viewport stays tall — pin fixed bottom UI with this offset
 * (MOBILE_BOTTOM_NAV_DESIGN §2.1).
 *
 * offset = max(0, round(innerHeight - visualViewport.height - visualViewport.offsetTop))
 */
function readViewportBottomOffset() {
  if (typeof window === 'undefined') return 0;
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}

export function useVisualViewportBottomOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let rafId = 0;

    const update = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setOffset(readViewportBottomOffset());
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
