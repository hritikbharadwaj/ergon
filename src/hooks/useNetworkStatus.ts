import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: Date | null;
  downlinkSpeed?: number;
}

/**
 * Custom hook to monitor online/offline network connectivity status
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;
  });

  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(() => (isOnline ? new Date() : null));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(new Date());
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const downlinkSpeed =
    typeof navigator !== 'undefined' && 'connection' in navigator
      ? (navigator as any).connection?.downlink
      : undefined;

  return {
    isOnline,
    wasOffline,
    lastOnlineAt,
    downlinkSpeed,
  };
}

export default useNetworkStatus;
