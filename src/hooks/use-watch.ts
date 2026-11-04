import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

const RETRY = 2000;

// Whether what the watch took last is current: hex has answered, or the last try failed.
export type Watching = 'waiting' | 'current' | 'offline';

// Asks hex and waits: each answer comes the moment something changes, and the next question
// carries the version it answered with. An answer without a version won't change, so it's the
// last. It runs while `key` isn't null, and only while the app is in front; a new key starts over.
// Coming back to the front picks up from the version it had, since a question without one is how
// hex hears that something was opened.
export function useWatch<K extends string, T extends { version?: number }>(
  key: K | null,
  ask: (after: number | undefined, signal: AbortSignal, key: K) => Promise<T>,
  take: (answer: T, key: K) => void,
) {
  const active = useActive();
  const [watching, setWatching] = useState<Watching>('waiting');
  const version = useRef<number>(undefined);
  const asking = useEffectEvent(ask);
  const taking = useEffectEvent(take);
  useEffect(() => {
    version.current = undefined;
  }, [key]);
  useEffect(() => {
    if (key === null || !active) return;
    const controller = new AbortController();
    void (async () => {
      while (!controller.signal.aborted) {
        try {
          const answer = await asking(version.current, controller.signal, key);
          if (controller.signal.aborted) return;
          taking(answer, key);
          setWatching('current');
          if (answer.version === undefined) return;
          version.current = answer.version;
        } catch {
          if (controller.signal.aborted) return;
          setWatching('offline');
          await new Promise((resolve) => setTimeout(resolve, RETRY));
        }
      }
    })();
    return () => controller.abort();
  }, [key, active]);
  return watching;
}

const onAppState = (change: () => void) => {
  const listener = AppState.addEventListener('change', change);
  return () => listener.remove();
};

export function useActive() {
  return useSyncExternalStore(onAppState, () => AppState.currentState === 'active');
}

// One answer from hex for `key`, asked again when `key` or `fresh` changes and every RETRY while hex
// can't be reached. The last answer for the same key stays until a newer one comes.
export function useAnswer<K extends string, T>(
  key: K | null,
  fresh: unknown,
  ask: (key: K) => Promise<T>,
) {
  const [got, setGot] = useState<{ key: K; answer: T }>();
  const watching = useWatch<string, { version?: undefined; got?: { key: K; answer: T } }>(
    key === null ? null : `${key} ${String(fresh)}`,
    async () => (key === null ? {} : { got: { key, answer: await ask(key) } }),
    (answer) => {
      if (answer.got) setGot(answer.got);
    },
  );
  const answer = got && got.key === key ? got.answer : undefined;
  return { answer, failed: watching === 'offline' && answer === undefined };
}
