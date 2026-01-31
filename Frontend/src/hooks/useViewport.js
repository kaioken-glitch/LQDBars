import { useEffect, useState } from 'react';

export default function useViewport(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    // Set initial state immediately
    setIsMobile(window.innerWidth < breakpoint);

    function onResize() {
      setIsMobile(window.innerWidth < breakpoint);
    }

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);

  return { isMobile };
}
