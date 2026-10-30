import { useEffect, useState } from 'react';
import { getTimeWindowVersion, loadTimeWindowSettings, subscribeTimeWindowSettings } from '@/lib/timeWindow';

/**
 * Re-renders the caller whenever Super Admin updates attendance/work-log windows.
 * Also triggers an initial reload so labels & thresholds reflect the latest DB settings
 * even for pages that mount before the global loader has finished.
 */
export const useTimeWindows = () => {
  const [v, setV] = useState<number>(getTimeWindowVersion());
  useEffect(() => {
    loadTimeWindowSettings();
    subscribeTimeWindowSettings();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setV(detail?.version ?? getTimeWindowVersion());
    };
    window.addEventListener('time-windows-updated', onChange);
    return () => window.removeEventListener('time-windows-updated', onChange);
  }, []);
  return v;
};