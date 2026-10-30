import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Saves scroll position per pathname in sessionStorage and restores it when
 * navigating back to the dashboard (or any previously-visited path).
 *
 * Strategy:
 *  - Continuously persist the current scrollY on scroll (rAF-throttled), so
 *    the value is always fresh when the user clicks a card to leave.
 *  - On every pathname change, save the OLD path's scroll, then restore the
 *    NEW path's scroll if we have one stored — regardless of POP/PUSH. This
 *    fixes the common "Back to Dashboard" button (which uses navigate('/dashboard'),
 *    a PUSH) snapping to top.
 *  - Try restoration multiple times (rAF + small delays) so it works even
 *    when the destination page renders content asynchronously.
 */
const KEY_PREFIX = 'scroll:';

// Disable browser's native scroll restoration so ours is authoritative.
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  try { window.history.scrollRestoration = 'manual'; } catch {}
}

const saveScroll = (path: string) => {
  try { sessionStorage.setItem(KEY_PREFIX + path, String(window.scrollY)); } catch {}
};

const readScroll = (path: string): number | null => {
  try {
    const v = sessionStorage.getItem(KEY_PREFIX + path);
    return v == null ? null : parseInt(v, 10);
  } catch { return null; }
};

const ScrollRestoration: React.FC = () => {
  const location = useLocation();
  const navType = useNavigationType();
  const lastPath = useRef<string>(location.pathname);
  const rafRef = useRef<number | null>(null);

  // Persist current scroll position continuously (throttled via rAF)
  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        saveScroll(lastPath.current);
      });
    };
    const onBeforeUnload = () => saveScroll(lastPath.current);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    // Save old path's scroll before switching
    saveScroll(lastPath.current);
    const prevPath = lastPath.current;
    lastPath.current = location.pathname;

    const saved = readScroll(location.pathname);

    // Restore if we have a saved position for the destination, regardless of nav type.
    // This makes "Back to Dashboard" buttons (PUSH) keep your place.
    // For brand-new paths we haven't visited, fall back to top.
    if (saved != null && saved > 0) {
      // Try several times to outlast async content rendering
      const targets = [0, 50, 150, 300, 600];
      const timers: number[] = [];
      targets.forEach((delay) => {
        const t = window.setTimeout(() => {
          window.scrollTo({ top: saved, behavior: 'auto' });
        }, delay);
        timers.push(t);
      });
      return () => { timers.forEach(clearTimeout); };
    } else if (prevPath !== location.pathname) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return null;
};

export default ScrollRestoration;