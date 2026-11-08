import { useState } from 'react';
import { Linking } from 'react-native';

// "Not answered · That question is already answered or settled": what didn't happen, then hex's
// reason, which its client already words for you.
export const failure = (what: string, error: unknown) =>
  `${what} · ${error instanceof Error ? error.message : String(error)}`;

// What you did that didn't go through, by what you did it to, so the place you did it can say so.
// Doing it again clears it until that try fails too.
export const useFailures = () => {
  const [failed, setFailed] = useState<Record<string, string>>({});
  const attempt = async (key: string, what: string, work: () => Promise<unknown>) => {
    setFailed(({ [key]: _, ...rest }) => rest);
    return work().then(
      () => true,
      (error: unknown) => {
        setFailed((now) => ({ ...now, [key]: failure(what, error) }));
        return false;
      },
    );
  };
  const clear = (keys: string[]) => {
    setFailed((now) =>
      Object.fromEntries(Object.entries(now).filter(([key]) => !keys.includes(key))),
    );
  };
  return { failed, attempt, clear };
};

// iOS turns a link down without a word when no app here takes it.
export const openURL = async (url: string) =>
  Linking.openURL(url).catch(() => {
    throw new Error('No app on this device opens this link');
  });
