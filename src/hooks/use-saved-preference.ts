import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export const useSavedPreference = <T extends string>(
  key: string,
  defaultValue: T,
  isValid: (value: unknown) => value is T,
) => {
  const [saved, setSaved] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const changed = useRef(false);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    void (async () => {
      const stored = await AsyncStorage.getItem(key).catch(() => null);

      // A delayed read must not replace a selection made during startup.
      if (active && !changed.current && isValid(stored)) {
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

      changed.current = true;
      setSaved(next);
      // Keep rapid carousel selections in order when writing to storage.
      const before = writes.current;
      writes.current = (async () => {
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
