import React, { useEffect } from 'react';
import { useActivityTracking } from '@/hooks/useActivityTracking';
import { loadTimeWindowSettings, subscribeTimeWindowSettings } from '@/lib/timeWindow';

/** Headless mount that wires global activity tracking inside Router context. */
const ActivityTrackerMount: React.FC = () => {
  useActivityTracking();
  useEffect(() => {
    loadTimeWindowSettings();
    subscribeTimeWindowSettings();
  }, []);
  return null;
};

export default ActivityTrackerMount;