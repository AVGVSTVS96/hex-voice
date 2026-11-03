import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

const RETRY = 2000;

// Asks hex and waits: each answer comes the moment something changes, and the next question
// carries the version it answered with. It runs while `on`, and only while the app is in front; an
// `on` that names something, like a thread, starts over when it names another. Coming back to the
// front picks up from the version it had, since a question without one is how hex hears that
// something was opened. It says whether what it took last is current: hex has answered, and the
// last try since didn't fail.
export function useWatch<T extends { version: number }>(
  on: boolean | string | null,
  ask: (after: number | undefined, signal: AbortSignal) => Promise<T>,
  take: (answer: T) => void,
  offline?: (offline: boolean) => void,
) {
  const active = useActive();
  const [current, setCurrent] = useState(false);
  const version = useRef<number>(undefined);
  useEffect(() => {
    version.current = undefined;
  }, [on]);
  useEffect(() => {
    if (!on || !active) return;
    const controller = new AbortController();
    void (async () => {
      while (!controller.signal.aborted) {
        try {
          const answer = await ask(version.current, controller.signal);
          if (controller.signal.aborted) return;
          version.current = answer.version;
          take(answer);
          setCurrent(true);
          offline?.(false);
        } catch {
          if (controller.signal.aborted) return;
          setCurrent(false);
          offline?.(true);
          await new Promise((resolve) => setTimeout(resolve, RETRY));
        }
      }
    })();
    return () => controller.abort();
  }, [on, active]);
  return current;
}

export function useActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => listener.remove();
  }, []);
  return active;
}
