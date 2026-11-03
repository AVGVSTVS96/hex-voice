import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';

import { useFailures } from '@/hooks/use-failures';
import { useWatch } from '@/hooks/use-watch';
import { callsAPI } from '@/live/api';
import { putBack, type CallRecord, type CallSummary } from '@/live/calls';

const LIST = 'calls';
const saved = (id: string) => `call:${id}`;

function store(key: string, value: unknown) {
  void AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
}

async function restore<T>(key: string) {
  try {
    const stored = await AsyncStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : undefined;
  } catch {}
}

// The list shows what this device kept right away, then follows hex's copy while the app is in
// front: each request waits on the server until a call changes, so a new call, its title and its
// wrap-up arrive as they land.
export function useCalls() {
  const [calls, setCalls] = useState<CallSummary[]>();
  const [live, setLive] = useState<string>();
  const [offline, setOffline] = useState(false);
  const tries = useFailures();

  useEffect(() => {
    void restore<CallSummary[]>(LIST).then((kept) => {
      if (kept) setCalls((current) => current ?? kept);
    });
  }, []);

  useEffect(() => {
    if (calls) store(LIST, calls);
  }, [calls]);

  useWatch(
    true,
    callsAPI.list,
    (list) => {
      setCalls(list.calls);
      setLive(list.live);
    },
    setOffline,
  );

  const add = (call: CallSummary) =>
    setCalls((current) => [call, ...(current ?? []).filter(({ id }) => id !== call.id)]);

  const remove = (id: string) => {
    const removed = calls?.find((call) => call.id === id);
    setCalls((current) => current?.filter((call) => call.id !== id));
    void tries
      .attempt(id, 'Not deleted', () => callsAPI.remove(id))
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
  return { calls: shown, live, offline, add, remove };
}

export function useCall(summary: CallSummary | undefined) {
  const id = summary?.id;
  const [call, setCall] = useState<CallRecord>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    void restore<CallRecord>(saved(id)).then((kept) => {
      if (active && kept) setCall((current) => current ?? kept);
    });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    callsAPI.get(id).then(
      (fresh) => {
        if (!active) return;
        setCall(fresh);
        setFailed(false);
        store(saved(id), fresh);
      },
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, [id, summary?.seconds, summary?.title, summary?.ended]);

  return { call: call?.id === id ? call : undefined, failed };
}
