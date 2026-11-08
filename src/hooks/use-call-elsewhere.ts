import { useState } from 'react';

import { hex } from '@/hex';
import { usePastCall } from '@/hooks/use-calls';
import type { CallId } from '@/live/calls';

// hex holds one call at a time. When it's one this app isn't on, a phone call or the web page, the
// screen shows it as its own: the call's record follows it word by word until it ends, and the
// ended call stays on screen, with how it ended, until a call starts here. A call that ended while
// the app was away is read once more for its ending.
export const useCallElsewhere = (live: CallId | undefined, here: boolean) => {
  const [shown, setShown] = useState<CallId>();
  const [leaving, setLeaving] = useState<CallId>();
  if (live && live !== shown) {
    setShown(live);
  }
  if (here && shown) {
    setShown(undefined);
  }
  const { call } = usePastCall(shown);
  const on = !!call && !call.ended;

  const hangUp = async () => {
    if (!call || call.ended) {
      return;
    }
    setLeaving(call.id);
    try {
      await hex.session.close(call.id);
    } catch (error) {
      setLeaving(undefined);
      throw error;
    }
  };

  return { call, live: on, leaving: on && leaving === call.id, hangUp };
};
