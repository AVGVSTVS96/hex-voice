import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export const useSavedPreference = <T extends string>(
  key: string,
  defaultValue: T,
  isValid: (value: unknown) => value is T,
) => {
  const [saved, setSaved] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const pickedBeforeRead = useRef(false);
  const writesInOrder = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    void (async () => {
      const stored = await AsyncStorage.getItem(key).catch(() => null);

      if (active && !pickedBeforeRead.current && isValid(stored)) {
        setSaved(stored);
      }

      if (active) {
        setLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [key, isValid]);

  const setValue = useCallback(
    (next: T) => {
      if (!isValid(next)) {
        return;
      }

      pickedBeforeRead.current = true;
      setSaved(next);
      const before = writesInOrder.current;
      writesInOrder.current = (async () => {
        await before;

        try {
          await AsyncStorage.setItem(key, next);
        } catch {
          console.warn(`[hex] Could not save preference: ${key}`);
        }
      })();
    },
    [key, isValid],
  );

  return { value: saved, setValue, loaded };
};
