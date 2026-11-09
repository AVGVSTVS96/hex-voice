import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import * as z from "zod/mini";

import { hex } from "@/hex";
import { useFailures } from "@/hooks/use-failures";
import { restore, store } from "@/hooks/use-kept";
import { useWatch } from "@/hooks/use-watch";
import { CallRecord, CallSummary, putBack } from "@/live/calls";
import type { CallId } from "@/live/calls";

const LIST = "calls";
const saved = (id: CallId) => `call:${id}`;

export const useCalls = () => {
  const [listed, setListed] = useState<CallSummary[]>();
  const [justEnded, setJustEnded] = useState<CallSummary[]>([]);
  const [live, setLive] = useState<CallId>();
  const tries = useFailures();

  useEffect(() => {
    void (async () => {
      const kept = await restore(LIST, z.array(CallSummary));

      if (kept) {
        setListed((current) => current ?? kept);
      }
    })();
  }, []);

  useEffect(() => {
    if (listed) {
      store(LIST, listed);
    }
  }, [listed]);

  const watching = useWatch("calls", hex.calls.list, (list) => {
    setListed(list.calls);
    setJustEnded([]);
    setLive(list.live);
  });

  const add = (call: CallSummary) => {
    setJustEnded((current) => [call, ...current.filter(({ id }) => id !== call.id)]);
  };

  const remove = (id: CallId) => {
    const others = (calls: CallSummary[]) => calls.filter((call) => call.id !== id);
    const fromHex = listed?.find((call) => call.id === id);
    const fromHere = justEnded.find((call) => call.id === id);
    setListed((current) => current && others(current));
    setJustEnded(others);
    void (async () => {
      const deleted = await tries.attempt(id, "Not deleted", async () => {
        await hex.calls.remove(id);
      });

      if (deleted) {
        void AsyncStorage.removeItem(saved(id)).catch(() => null);
      }

      if (!deleted && fromHex) {
        setListed((current) => putBack(current ?? [], fromHex));
      }

      if (!deleted && fromHere) {
        setJustEnded((current) => putBack(current, fromHere));
      }
    })();
  };

  const shown = useMemo((): CallSummary[] | undefined => {
    if (!listed && !justEnded.length) {
      return undefined;
    }

    const calls = [
      ...justEnded,
      ...(listed ?? []).filter(({ id }) => !justEnded.some((call) => call.id === id)),
    ];

    return calls.map((call) => {
      const why = tries.failed[call.id];

      return why === undefined ? call : { ...call, failed: why };
    });
  }, [listed, justEnded, tries.failed]);

  return { calls: shown, live, offline: watching === "offline", add, remove };
};

export const usePastCall = (id: CallId | undefined) => {
  const [call, setCall] = useState<CallRecord>();

  useEffect(() => {
    if (!id) {
      return;
    }

    let active = true;
    void (async () => {
      const kept = await restore(saved(id), CallRecord);

      if (active && kept) {
        setCall((current) => (current?.id === id ? current : kept));
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  const watching = useWatch(
    id ?? null,
    async (after, signal, watched) => await hex.calls.get(watched, after, signal),
    (fresh) => {
      setCall(fresh);

      if ((fresh.ended ?? "") !== "") {
        store(saved(fresh.id), fresh);
      }
    },
  );

  return { call: call?.id === id ? call : undefined, failed: watching === "offline" };
};
