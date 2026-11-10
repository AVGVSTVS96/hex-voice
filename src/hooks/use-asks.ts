import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { hex } from "@/hex";
import { keepDraft, sentDraft } from "@/hooks/use-draft";
import { useFailures } from "@/hooks/use-failures";
import { useKept } from "@/hooks/use-kept";
import { useAnswer, useWatch } from "@/hooks/use-watch";
import { AskList, NOT_NEEDED, failedOn, openAsks, yours } from "@/live/asks";
import type { Ask, AskId, AskOption, Sent } from "@/live/asks";
import type { Picked } from "@/live/media";

export type Chosen = AskOption & { media?: Picked[] };

export const answerAsk = async (ask: Ask, option: Chosen) => {
  const sent = await hex.asks.answer(ask.id, option.label, option.media);
  keepDraft(`ask:${ask.id}`, "");

  return sent;
};

export const noteAsk = async (ask: Ask, text: string, media: Picked[] = []) => {
  await hex.asks.note(ask.id, text, media);
  sentDraft(`ask:${ask.id}`, text);
};

export const raiseAsks = async () => {
  await hex.asks.talk();
};

export const shotOf = (ask: Ask, shot: number) => hex.asks.shot(ask.id, shot);

export const useAsks = (open: boolean) => {
  const [state, dispatch] = useReducer(yours, { answered: {} });
  const tries = useFailures();
  const [missed, setMissed] = useState<Record<string, number>>({});

  const reached = (id: AskId, sent?: Sent) => {
    setMissed((now) => {
      const rest = Object.fromEntries(Object.entries(now).filter(([key]) => key !== id));

      return sent !== undefined && sent.missed !== 0 ? { ...rest, [id]: sent.missed } : rest;
    });
  };

  const queue = useRef(new Map<AskId, { last: Promise<void>; turn: number }>());

  const inTurn = (id: AskId, work: (latest: () => boolean) => Promise<void>) => {
    const now = queue.current.get(id) ?? { last: Promise.resolve(), turn: 0 };
    const turn = now.turn + 1;
    const latest = () => queue.current.get(id)?.turn === turn;

    const last = (async () => {
      await now.last;
      await work(latest);
    })();

    queue.current.set(id, { last, turn });
  };

  const resends = useRef(new Map<AskId, () => Promise<Sent>>());
  const [kept, keep] = useKept("asks", AskList);
  useEffect(() => {
    if (kept && !state.list) {
      dispatch({ type: "list", list: kept });
    }
  }, [kept]);

  const watching = useWatch(open ? "asks" : null, hex.asks.list, (list) => {
    keep(list);
    dispatch({ type: "list", list });
  });

  const [wasOpen, setWasOpen] = useState(open);
  const [shownFailed, setShownFailed] = useState<string[]>([]);

  if (open !== wasOpen) {
    setWasOpen(open);

    if (open) {
      dispatch({ type: "close", keep: Object.keys(missed) });
      tries.clear(shownFailed);
    } else {
      setShownFailed(Object.keys(tries.failed));
    }
  }

  const list = useMemo(
    () => state.list && failedOn(state.list, tries.failed, missed),
    [state.list, tries.failed, missed],
  );

  const settle = (ask: Ask, label: string, what: string, send: () => Promise<Sent>) => {
    dispatch({ type: "answer", id: ask.id, label });
    inTurn(ask.id, async (latest) => {
      if (
        await tries.attempt(ask.id, what, async () => {
          reached(ask.id, await send());
        })
      ) {
        resends.current.set(ask.id, send);
      } else if (latest()) {
        dispatch({ type: "failed", id: ask.id });
      }
    });
  };

  const undo = (id: AskId) => {
    const label = state.answered[id] ?? "";

    if (label === "") {
      return;
    }

    dispatch({ type: "undo", id });
    reached(id);
    inTurn(id, async (latest) => {
      if (!resends.current.has(id)) {
        return;
      }

      if (
        await tries.attempt(id, "Not undone", async () => {
          await hex.asks.undo(id);
        })
      ) {
        resends.current.delete(id);
      } else if (latest()) {
        dispatch({ type: "answer", id, label });
      }
    });
  };

  return {
    list,
    shown: list?.asks ?? [],
    answered: state.answered,
    open: openAsks(state),
    offline: watching === "offline",
    current: watching === "current",
    answer: (ask: Ask, option: Chosen) => {
      settle(ask, option.label, "Not answered", async () => await answerAsk(ask, option));
    },
    dismiss: (ask: Ask) => {
      settle(ask, NOT_NEEDED, "Not put away", async () => await hex.asks.dismiss(ask.id));
    },
    again: (ask: Ask) => {
      const send = resends.current.get(ask.id);

      if (!send) {
        return;
      }

      reached(ask.id);
      inTurn(ask.id, async () => {
        await tries.attempt(ask.id, "Not sent again", async () => {
          reached(ask.id, await send());
        });
      });
    },
    undo,
    act: async (id: string) =>
      await tries.attempt(id, "Not sent", async () => {
        await hex.asks.act(id);
      }),
    read: async (id: string) =>
      await tries.attempt(id, "Not marked read", async () => {
        await hex.asks.read(id);
      }),
  };
};

export const useCheck = (at: string | undefined) => {
  const { answer, ...answered } = useAnswer(
    at ?? null,
    undefined,
    async () => await hex.asks.check(),
  );

  return { check: answer, ...answered };
};

export const useWords = (id: AskId | null) =>
  useAnswer(id, undefined, async (open) => await hex.asks.words(open)).answer;
