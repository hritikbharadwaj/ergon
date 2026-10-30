import { useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Force fullscreen on first user gesture and re-enter if the user exits.
 * Skipped on mobile (most browsers don't honor it well there).
 */
export const useForceFullscreen = (enabled = true) => {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!enabled || isMobile) return;
    let bypass = false;
    const enter = async () => {
      if (bypass) return;
      if (!document.fullscreenElement) {
        try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' } as any); } catch {}
      }
    };
    const onGesture = () => { void enter(); };
    const onChange = () => {
      if (!document.fullscreenElement) {
        // grace re-entry after 800ms
        window.setTimeout(() => { if (!bypass) void enter(); }, 800);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      // Esc tends to exit; let user temporarily bypass with Ctrl+Shift+F
      if (e.key === 'F' && e.ctrlKey && e.shiftKey) {
        bypass = !bypass;
        if (bypass && document.fullscreenElement) document.exitFullscreen().catch(() => {});
      }
    };
    document.addEventListener('click', onGesture);
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('click', onGesture);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, [enabled, isMobile]);
};