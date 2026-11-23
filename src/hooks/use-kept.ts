import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import * as z from "zod/mini";

import { server } from "@/hex";

const under = (key: string) => `${server.kept}${key}`;

export const restore = async <S extends z.ZodMiniType>(
  key: string,
  schema: S,
): Promise<z.output<S> | undefined> => {
  try {
    const saved = await AsyncStorage.getItem(under(key));

    return saved === null || saved === "" ? undefined : schema.safeParse(JSON.parse(saved)).data;
  } catch {
    return undefined;
  }
};

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- writes any kept answer out as JSON; nothing here reads it
export const store = (key: string, value: unknown) => {
  void AsyncStorage.setItem(under(key), JSON.stringify(value)).catch(() => null);
};

export const forget = (key: string) => {
  void AsyncStorage.removeItem(under(key)).catch(() => null);
};

export const useKept = <S extends z.ZodMiniType>(key: string, schema: S) => {
  const [kept, setKept] = useState<{ value: z.output<S>; at: string | undefined }>();
  useEffect(() => {
    void (async () => {
      const [value, at] = await Promise.all([
        restore(`kept:${key}`, schema),
        restore(`kept-at:${key}`, z.string()),
      ]);

      if (value !== undefined) {
        setKept((now) => now ?? { value, at });
      }
    })();
  }, [key]);

  const keep = useCallback(
    (value: z.output<S>) => {
      const at = new Date().toISOString();
      setKept({ value, at });
      store(`kept:${key}`, value);
      store(`kept-at:${key}`, at);
    },
    [key],
  );

  return [kept?.value, keep, kept?.at] as const;
};
