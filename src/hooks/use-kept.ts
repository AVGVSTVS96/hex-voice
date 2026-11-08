import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import type * as z from 'zod/mini';

// What this device kept, read back through the schema of hex's answer, since an older app may have
// written it.
export const restore = async <S extends z.ZodMiniType>(key: string, schema: S) => {
  try {
    const saved = await AsyncStorage.getItem(key);
    return saved ? schema.safeParse(JSON.parse(saved)).data : undefined;
  } catch {}
};

export const store = (key: string, value: unknown) => {
  void AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
};

// What hex last sent, kept on this device, so while hex is slow or out of reach the screen shows
// that, not an empty or zeroed list. hex's answer replaces it the moment it lands.
export const useKept = <S extends z.ZodMiniType>(key: string, schema: S) => {
  const [value, setValue] = useState<z.output<S>>();
  useEffect(() => {
    void restore(`kept:${key}`, schema).then((saved) => {
      if (saved !== undefined) setValue((now) => now ?? saved);
    });
  }, [key]);
  const keep = useCallback(
    (next: z.output<S>) => {
      setValue(next);
      store(`kept:${key}`, next);
    },
    [key],
  );
  return [value, keep] as const;
};
