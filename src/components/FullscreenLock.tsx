import React from 'react';
import { useForceFullscreen } from '@/hooks/useForceFullscreen';

const FullscreenLock: React.FC = () => {
  useForceFullscreen(true);
  return null;
};

export default FullscreenLock;