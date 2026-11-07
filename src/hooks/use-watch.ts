import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { Refused } from '@/hex/client';

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
  const [watched, setWatched] = useState(key);
  // What it took stops being current only as it watches anew, not as it stops, so a view fading
  // out keeps showing it as it was.
  if (key !== watched) {
    setWatched(key);
    if (key !== null) setWatching('waiting');
  }
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
// can't be reached. The last answer for the same key stays until a newer one comes. hex refusing it
// ends the asking, since asking again gets the same answer.
export function useAnswer<K extends string, T>(
  key: K | null,
  fresh: unknown,
  ask: (key: K) => Promise<T>,
) {
  const [got, setGot] = useState<{ key: K; answer?: T; refused?: Refused }>();
  const watching = useWatch<string, { version?: undefined; got?: typeof got }>(
    key === null ? null : `${key} ${String(fresh)}`,
    async () => {
      if (key === null) return {};
      try {
        return { got: { key, answer: await ask(key) } };
      } catch (error) {
        if (error instanceof Refused) return { got: { key, refused: error } };
        throw error;
      }
    },
    (answer) => {
      if (answer.got) setGot(answer.got);
    },
  );
  const mine = got?.key === key ? got : undefined;
  return {
    answer: mine?.answer,
    refused: mine?.refused,
    failed: watching === 'offline' && !mine,
  };
}

export type Answered = Omit<ReturnType<typeof useAnswer>, 'answer'>;
