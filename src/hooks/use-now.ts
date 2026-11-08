import { useEffect, useState } from 'react';

export const useNow = (ticking: boolean) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!ticking) {
      return;
    }

    setNow(new Date());

    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [ticking]);

  return now;
};
