import { useState } from 'react';

import { hex } from '@/hex';
import { usePastCall } from '@/hooks/use-calls';
import type { CallId } from '@/live/calls';

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
  const on = call !== undefined && (call.ended ?? '') === '';

  const hangUp = async () => {
    if (call === undefined || (call.ended ?? '') !== '') {
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
