import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { callsAPI } from '@/live/api';
import type { CallSummary } from '@/live/calls';

function phoneCall(live: string | undefined, calls: CallSummary[]) {
  const call = live ? calls.find(({ id }) => id === live) : undefined;
  return call && (call.from === 'phone-in' || call.from === 'phone-out') ? call : undefined;
}

// hex holds one call at a time, so a call started here hangs up a live phone call. The app learns
// about one whenever it comes to the front (hex usually calls while it's in the background), and
// from the Calls list while that's open, so the start button can ask first without a round trip.
export function usePhoneCall(live: string | undefined, calls: CallSummary[] | undefined) {
  const [call, setCall] = useState<CallSummary>();

  useEffect(() => {
    if (calls) setCall(phoneCall(live, calls));
  }, [live, calls]);

  useEffect(() => {
    const check = () => {
      callsAPI.list().then(
        (fresh) => setCall(phoneCall(fresh.live, fresh.calls)),
        () => {},
      );
    };
    check();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => listener.remove();
  }, []);

  return call;
}
