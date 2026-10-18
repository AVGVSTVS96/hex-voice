import { useEffect, useState } from 'react';

// The time now, moving each second while `ticking`, so a running step counts up as it runs.
export function useNow(ticking: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!ticking) return;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
}
