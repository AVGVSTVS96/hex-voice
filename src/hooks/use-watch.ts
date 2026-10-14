import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

const RETRY = 2000;

// Asks hex and waits: each answer comes the moment something changes, and the next question
// carries the version it answered with. It runs while `on`, and only while the app is in front.
export function useWatch<T extends { version: number }>(
  on: boolean,
  ask: (after: number | undefined, signal: AbortSignal) => Promise<T>,
  take: (answer: T) => void,
  offline?: (offline: boolean) => void,
) {
  const active = useActive();
  useEffect(() => {
    if (!on || !active) return;
    const controller = new AbortController();
    void (async () => {
      let version: number | undefined;
      while (!controller.signal.aborted) {
        try {
          const answer = await ask(version, controller.signal);
          version = answer.version;
          take(answer);
          offline?.(false);
        } catch {
          if (controller.signal.aborted) return;
          offline?.(true);
          await new Promise((resolve) => setTimeout(resolve, RETRY));
        }
      }
    })();
    return () => controller.abort();
  }, [on, active]);
}

export function useActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => listener.remove();
  }, []);
  return active;
}
