import { useState } from 'react';
import { Linking } from 'react-native';

// "Not answered · That question is already answered or settled": what didn't happen, then hex's
// reason, which its client already words for you.
export const failure = (what: string, cause: unknown) =>
  `${what} · ${cause instanceof Error ? cause.message : String(cause)}`;

// What you did that didn't go through, by what you did it to, so the place you did it can say so.
// Doing it again clears it until that try fails too.
export const useFailures = () => {
  const [failed, setFailed] = useState<Record<string, string>>({});

  const attempt = async (key: string, what: string, work: () => Promise<void>) => {
    setFailed(({ [key]: _, ...rest }) => rest);

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

// iOS turns a link down without a word when no app here takes it.
export const openURL = async (url: string) => {
  await Linking.openURL(url).catch(() => {
    throw new Error('No app on this device opens this link');
  });
};
