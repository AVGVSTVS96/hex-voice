import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import * as z from 'zod/mini';

import { hex } from '@/hex';
import { useFailures } from '@/hooks/use-failures';
import { restore, store } from '@/hooks/use-kept';
import { useWatch } from '@/hooks/use-watch';
import { CallRecord, CallSummary, putBack, type CallId } from '@/live/calls';

const LIST = 'calls';
const saved = (id: CallId) => `call:${id}`;

// The list shows what this device kept right away, then follows hex's copy while the app is in
// front: each request waits on the server until a call changes, so a new call, its title and its
// wrap-up arrive as they land.
export function useCalls() {
  const [calls, setCalls] = useState<CallSummary[]>();
  const [live, setLive] = useState<CallId>();
  const tries = useFailures();

  useEffect(() => {
    void restore(LIST, z.array(CallSummary)).then((kept) => {
      if (kept) setCalls((current) => current ?? kept);
    });
  }, []);

  useEffect(() => {
    if (calls) store(LIST, calls);
  }, [calls]);

  const watching = useWatch('calls', hex.calls.list, (list) => {
    setCalls(list.calls);
    setLive(list.live);
  });

  const add = (call: CallSummary) =>
    setCalls((current) => [call, ...(current ?? []).filter(({ id }) => id !== call.id)]);

  const remove = (id: CallId) => {
    const removed = calls?.find((call) => call.id === id);
    setCalls((current) => current?.filter((call) => call.id !== id));
    void tries
      .attempt(id, 'Not deleted', () => hex.calls.remove(id))
      .then((deleted) => {
        if (deleted) void AsyncStorage.removeItem(saved(id)).catch(() => {});
        else if (removed) setCalls((current) => putBack(current ?? [], removed));
      });
  };

  // A call that wouldn't delete comes back in its place saying why.
  const shown = useMemo(
    () =>
      calls?.map((call) =>
        tries.failed[call.id] ? { ...call, failed: tries.failed[call.id] } : call,
      ),
    [calls, tries.failed],
  );
  return { calls: shown, live, offline: watching === 'offline', add, remove };
}

// One call's record: a live one follows word by word until it ends, an ended one comes once and is
// kept on this device, so it opens at once next time.
export function usePastCall(id: CallId | undefined) {
  const [call, setCall] = useState<CallRecord>();

  useEffect(() => {
    if (!id) return;
    let active = true;
    void restore(saved(id), CallRecord).then((kept) => {
      if (active && kept) setCall((current) => (current?.id === id ? current : kept));
    });
    return () => {
      active = false;
    };
  }, [id]);

  const watching = useWatch(
    id ?? null,
    (after, signal, id) => hex.calls.get(id, after, signal),
    (fresh) => {
      setCall(fresh);
      if (fresh.ended) store(saved(fresh.id), fresh);
    },
  );

  return { call: call?.id === id ? call : undefined, failed: watching === 'offline' };
}
