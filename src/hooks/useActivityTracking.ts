import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { setTrackingAdminId, pushSectionTime, trackClick } from '@/lib/tracking';

const HEARTBEAT_MS = 30_000;

/**
 * Global activity tracking:
 *  - registers admin id for tracking lib
 *  - listens for any click that has data-track attribute (or button text fallback)
 *  - accumulates time-on-route and flushes every 30s + on route change/unload
 */
export const useActivityTracking = () => {
  const { adminProfile } = useAuth();
  const location = useLocation();
  const startedAtRef = useRef<number>(Date.now());
  const currentRouteRef = useRef<string>(location.pathname);

  // sync admin id
  useEffect(() => {
    setTrackingAdminId(adminProfile?.id ?? null);
  }, [adminProfile?.id]);

  // flush helper
  useEffect(() => {
    const flush = () => {
      const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
      if (elapsed > 0 && document.visibilityState === 'visible') {
        void pushSectionTime(currentRouteRef.current, elapsed);
      }
      startedAtRef.current = Date.now();
    };

    // on route change flush old route then switch
    if (currentRouteRef.current !== location.pathname) {
      flush();
      currentRouteRef.current = location.pathname;
    }

    const heartbeat = window.setInterval(flush, HEARTBEAT_MS);
    const onHide = () => flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onHide);
      flush();
    };
  }, [location.pathname]);

  // global click delegation
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest<HTMLElement>('[data-track]') ||
        target.closest<HTMLElement>('button, a[role="button"], a[href]');
      if (!el) return;
      const key = el.getAttribute('data-track') ||
        (el.tagName === 'A' ? 'link_click' : 'button_click');
      const label = el.getAttribute('data-track-label') ||
        el.getAttribute('aria-label') ||
        (el.textContent ?? '').trim().slice(0, 80) ||
        undefined;
      const meetingId = el.getAttribute('data-meeting-id') ?? undefined;
      void trackClick({ key, label, meetingId });
    };
    window.addEventListener('click', onClick, { capture: true });
    return () => window.removeEventListener('click', onClick, { capture: true } as EventListenerOptions);
  }, []);
};