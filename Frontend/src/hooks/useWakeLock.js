import { useEffect, useState } from 'react';

export const useWakeLock = (shouldActivate) => {
  const [wakeLock, setWakeLock] = useState(null);

  useEffect(() => {
    if (!shouldActivate || !('wakeLock' in navigator)) return;

    let isActive = true;

    const requestWakeLock = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (isActive) setWakeLock(lock);
      } catch (err) {
        console.warn('Wake lock error:', err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldActivate) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isActive = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(console.warn);
      }
    };
  }, [shouldActivate]);

  return wakeLock;
};