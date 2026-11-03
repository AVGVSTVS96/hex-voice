import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

// What hex last sent, kept on this device, so while hex is slow or out of reach the screen shows
// that, not an empty or zeroed list. hex's answer replaces it the moment it lands.
export function useKept<T>(key: string) {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    void AsyncStorage.getItem(`kept:${key}`)
      .then((saved) => {
        if (saved) setValue((now) => now ?? (JSON.parse(saved) as T));
      })
      .catch(() => {});
  }, [key]);
  const keep = useCallback(
    (next: T) => {
      setValue(next);
      void AsyncStorage.setItem(`kept:${key}`, JSON.stringify(next)).catch(() => {});
    },
    [key],
  );
  return [value, keep] as const;
}
