import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { RefusedError } from "@/hex/client";

const RETRY = 2000;

export type Watching = "waiting" | "current" | "offline";

export const useWatch = <K extends string, T extends { version?: number }>(
  key: K | null,
  ask: (after: number | undefined, signal: AbortSignal, key: K) => Promise<T>,
  take: (answer: T, key: K) => void,
) => {
  const active = useActive();
  const [watching, setWatching] = useState<Watching>("waiting");
  const [watched, setWatched] = useState(key);

  if (key !== watched) {
    setWatched(key);

    if (key !== null) {
      setWatching("waiting");
    }
  }

  const version = useRef<number>(undefined);
  const asking = useEffectEvent(ask);
  const taking = useEffectEvent(take);
  useEffect(() => {
    version.current = undefined;
  }, [key]);
  useEffect(() => {
    if (key === null || !active) {
      return;
    }

    const controller = new AbortController();
    void (async () => {
      while (!controller.signal.aborted) {
        try {
          // oxlint-disable-next-line no-await-in-loop -- a long poll asks again only once its last question is answered
          const answer = await asking(version.current, controller.signal, key);

          if (controller.signal.aborted) {
            return;
          }

          taking(answer, key);
          setWatching("current");

          if (answer.version === undefined) {
            return;
          }

          version.current = answer.version;
        } catch {
          if (controller.signal.aborted) {
            return;
          }

          setWatching("offline");
          // oxlint-disable-next-line no-await-in-loop, promise/avoid-new -- waits RETRY before asking again; React Native's setTimeout has no promise form
          await new Promise<void>((resolve) => {
            setTimeout(resolve, RETRY);
          });
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [key, active]);

  return watching;
};

const onAppState = (change: () => void) => {
  const listener = AppState.addEventListener("change", change);

  return () => {
    listener.remove();
  };
};

export const useActive = () =>
  useSyncExternalStore(onAppState, () => AppState.currentState === "active");

export const useAnswer = <K extends string, T>(
  key: K | null,
  fresh: number | undefined,
  ask: (key: K) => Promise<T>,
) => {
  const [got, setGot] = useState<{ key: K; answer?: T; refused?: RefusedError }>();

  const watching = useWatch<string, { version?: undefined; got?: typeof got }>(
    key === null ? null : `${key} ${String(fresh)}`,
    async () => {
      if (key === null) {
        return {};
      }

      try {
        return { got: { key, answer: await ask(key) } };
      } catch (error) {
        if (error instanceof RefusedError) {
          return { got: { key, refused: error } };
        }

        throw error;
      }
    },
    (answer) => {
      if (answer.got) {
        setGot(answer.got);
      }
    },
  );

  const mine = got?.key === key ? got : undefined;

  return {
    answer: mine?.answer,
    refused: mine?.refused,
    failed: watching === "offline" && !mine,
  };
};

export type Answered = Omit<ReturnType<typeof useAnswer>, "answer">;
