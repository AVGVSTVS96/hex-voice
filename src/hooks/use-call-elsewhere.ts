import { useEffect, useState } from 'react';

import { useActive } from '@/hooks/use-watch';
import { callsAPI, sessionAPI } from '@/live/api';
import type { CallRecord } from '@/live/calls';

const RETRY = 2000;

// hex holds one call at a time. When it's one this app isn't on, a phone call or the web page, the
// screen shows it as its own: the call's record follows it word by word until it ends, and the
// ended call stays on screen, with how it ended, until a call starts here. A call that ended while
// the app was away is read once more for its ending.
export function useCallElsewhere(live: string | undefined, here: boolean) {
  const [call, setCall] = useState<CallRecord>();
  const [leaving, setLeaving] = useState(false);
  const active = useActive();
  const follow = live ?? (call && !call.ended ? call.id : undefined);

  useEffect(() => {
    if (here) setCall(undefined);
  }, [here]);

  useEffect(() => {
    setLeaving(false);
    if (!follow || !active) return;
    const controller = new AbortController();
    void (async () => {
      let version: number | undefined;
      while (!controller.signal.aborted) {
        try {
          const record = await callsAPI.get(follow, version, controller.signal);
          if (controller.signal.aborted) return;
          setCall(record);
          if (record.ended || record.version === undefined) return;
          version = record.version;
        } catch {
          if (controller.signal.aborted) return;
          await new Promise((resolve) => setTimeout(resolve, RETRY));
        }
      }
    })();
    return () => controller.abort();
  }, [follow, active]);

  const hangUp = () => {
    if (!call || call.ended) return;
    setLeaving(true);
    sessionAPI.close(call.id).catch(() => setLeaving(false));
  };

  return { call, live: !!call && !call.ended, leaving, hangUp };
}
