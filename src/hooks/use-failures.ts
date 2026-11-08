import { useState } from 'react';
import { Linking } from 'react-native';

export const failure = (what: string, cause: unknown) =>
  `${what} · ${cause instanceof Error ? cause.message : String(cause)}`;

export const useFailures = () => {
  const [failed, setFailed] = useState<Record<string, string>>({});

  const attempt = async (key: string, what: string, work: () => Promise<void>) => {
    setFailed((now) => Object.fromEntries(Object.entries(now).filter(([one]) => one !== key)));

    try {
      await work();

      return true;
    } catch (error) {
      setFailed((now) => ({ ...now, [key]: failure(what, error) }));

      return false;
    }
  };

  const clear = (keys: string[]) => {
    setFailed((now) =>
      Object.fromEntries(Object.entries(now).filter(([key]) => !keys.includes(key))),
    );
  };

  return { failed, attempt, clear };
};

export const openURL = async (url: string) => {
  await Linking.openURL(url).catch(() => {
    throw new Error('No app on this device opens this link');
  });
};
