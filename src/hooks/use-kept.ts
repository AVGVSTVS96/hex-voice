import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import type * as z from "zod/mini";

export const restore = async <S extends z.ZodMiniType>(
  key: string,
  schema: S,
): Promise<z.output<S> | undefined> => {
  try {
    const saved = await AsyncStorage.getItem(key);

    return saved === null || saved === "" ? undefined : schema.safeParse(JSON.parse(saved)).data;
  } catch {
    return undefined;
  }
};

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- writes any kept answer out as JSON; nothing here reads it
export const store = (key: string, value: unknown) => {
  void AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => null);
};

export const useKept = <S extends z.ZodMiniType>(key: string, schema: S) => {
  const [value, setValue] = useState<z.output<S>>();
  useEffect(() => {
    void (async () => {
      const saved = await restore(`kept:${key}`, schema);

      if (saved !== undefined) {
        setValue((now) => now ?? saved);
      }
    })();
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
