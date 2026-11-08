import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import * as z from 'zod/mini';

import { hex } from '@/hex';
import { useFailures } from '@/hooks/use-failures';
import { restore, store } from '@/hooks/use-kept';
import { useWatch } from '@/hooks/use-watch';
import { CallRecord, CallSummary, putBack } from '@/live/calls';
import type { CallId } from '@/live/calls';

const LIST = 'calls';
const saved = (id: CallId) => `call:${id}`;

// The list shows what this device kept right away, then follows hex's copy while the app is in
// front: each request waits on the server until a call changes, so a new call, its title and its
// wrap-up arrive as they land. A call that just ended here leads the list until hex answers, and
// only hex's answers are kept on this device.
export const useCalls = () => {
  const [listed, setListed] = useState<CallSummary[]>();
  const [justEnded, setJustEnded] = useState<CallSummary[]>([]);
  const [live, setLive] = useState<CallId>();
  const tries = useFailures();

  useEffect(() => {
    void restore(LIST, z.array(CallSummary)).then((kept) => {
      if (kept) {
        setListed((current) => current ?? kept);
      }
    });
  }, []);

  useEffect(() => {
    if (listed) {
      store(LIST, listed);
    }
  }, [listed]);

  const watching = useWatch('calls', hex.calls.list, (list) => {
    setListed(list.calls);
    setJustEnded([]);
    setLive(list.live);
  });

  const add = (call: CallSummary) =>
    setJustEnded((current) => [call, ...current.filter(({ id }) => id !== call.id)]);

  const remove = (id: CallId) => {
    const others = (calls: CallSummary[]) => calls.filter((call) => call.id !== id);
    const fromHex = listed?.find((call) => call.id === id);
    const fromHere = justEnded.find((call) => call.id === id);
    setListed((current) => current && others(current));
    setJustEnded(others);
    void tries
      .attempt(id, 'Not deleted', () => hex.calls.remove(id))
      .then((deleted) => {
        if (deleted) {
          void AsyncStorage.removeItem(saved(id)).catch(() => {});
        }
        if (!deleted && fromHex) {
          setListed((current) => putBack(current ?? [], fromHex));
        }
        if (!deleted && fromHere) {
          setJustEnded((current) => putBack(current, fromHere));
        }
      });
  };

  // A call that wouldn't delete comes back in its place saying why.
  const shown = useMemo(() => {
    if (!listed && !justEnded.length) {
      return undefined;
    }
    const calls = [
      ...justEnded,
      ...(listed ?? []).filter(({ id }) => !justEnded.some((call) => call.id === id)),
    ];
    return calls.map((call) =>
      tries.failed[call.id] ? { ...call, failed: tries.failed[call.id] } : call,
    );
  }, [listed, justEnded, tries.failed]);
  return { calls: shown, live, offline: watching === 'offline', add, remove };
};

// One call's record: a live one follows word by word until it ends, an ended one comes once and is
// kept on this device, so it opens at once next time.
export const usePastCall = (id: CallId | undefined) => {
  const [call, setCall] = useState<CallRecord>();

  useEffect(() => {
    if (!id) {
      return;
    }
    let active = true;
    void restore(saved(id), CallRecord).then((kept) => {
      if (active && kept) {
        setCall((current) => (current?.id === id ? current : kept));
      }
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
      if (fresh.ended) {
        store(saved(fresh.id), fresh);
      }
    },
  );

  return { call: call?.id === id ? call : undefined, failed: watching === 'offline' };
};
