import { useEffect, useState } from 'react';

import { callsAPI } from '@/live/api';
import type { CallSummary } from '@/live/calls';

// The call you just hung up keeps listening for hex's name and wrap-up while its ending shows,
// so what hex sent where and what's left for you land on the screen as hex writes them.
export function useWrapUp(id: string | null, watching: boolean) {
  const [call, setCall] = useState<CallSummary>();

  useEffect(() => {
    setCall(undefined);
    if (!id || !watching) return;
    const controller = new AbortController();
    void (async () => {
      let version: number | undefined;
      while (!controller.signal.aborted) {
        try {
          const list = await callsAPI.list(version, controller.signal);
          version = list.version;
          setCall(list.calls.find((call) => call.id === id));
        } catch {
          return;
        }
      }
    })();
    return () => controller.abort();
  }, [id, watching]);

  return call;
}
