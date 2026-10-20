import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useSyncExternalStore } from 'react';

type Saved = {
  value: string | null;
  loaded: boolean;
  changed: boolean;
  listeners: Set<() => void>;
  writes: Promise<void>;
  subscribe: (listener: () => void) => () => void;
  snapshot: () => string;
};

// One copy of each preference for the whole app, so every screen showing it agrees the moment
// one of them changes it.
const saved = new Map<string, Saved>();

function entry(key: string) {
  let found = saved.get(key);
  if (!found) {
    const created: Saved = {
      value: null,
      loaded: false,
      changed: false,
      listeners: new Set(),
      writes: Promise.resolve(),
      subscribe: (listener) => {
        created.listeners.add(listener);
        return () => created.listeners.delete(listener);
      },
      snapshot: () => `${created.loaded}:${created.value}`,
    };
    saved.set(key, created);
    void AsyncStorage.getItem(key)
      .then((stored) => {
        // A delayed read must not replace a selection made during startup.
        if (!created.changed) created.value = stored;
      })
      .catch(() => {})
      .finally(() => {
        created.loaded = true;
        tell(created);
      });
    found = created;
  }
  return found;
}

function tell(changed: Saved) {
  for (const listener of changed.listeners) listener();
}

export function useSavedPreference<T extends string>(
  key: string,
  defaultValue: T,
  isValid: (value: unknown) => value is T,
) {
  const preference = entry(key);
  useSyncExternalStore(preference.subscribe, preference.snapshot);
  const setValue = useCallback(
    (next: T) => {
      if (!isValid(next)) return;
      preference.changed = true;
      preference.value = next;
      tell(preference);
      // Keep rapid carousel selections in order when writing to storage.
      preference.writes = preference.writes
        .then(() => AsyncStorage.setItem(key, next))
        .catch(() => {
          console.warn(`[hex] Could not save preference: ${key}`);
        });
    },
    [preference, key, isValid],
  );

  const value = isValid(preference.value) ? preference.value : defaultValue;
  return { value, setValue, loaded: preference.loaded };
}
