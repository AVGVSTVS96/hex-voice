import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { hex } from '@/hex';
import { keepDraft, sentDraft } from '@/hooks/use-draft';
import { useFailures } from '@/hooks/use-failures';
import { useKept } from '@/hooks/use-kept';
import { useAnswer, useWatch } from '@/hooks/use-watch';
import { AskList, NOT_NEEDED, failedOn, openAsks, yours } from '@/live/asks';
import type { Ask, AskId, AskOption, Sent } from '@/live/asks';

// The one way to answer an ask, from Tasks or its card on a call: once hex has it, what you'd
// started typing on it goes, and you get back what the answer reached.
export const answerAsk = async (ask: Ask, option: AskOption) => {
  const sent = await hex.asks.answer(ask.id, option.label);
  keepDraft(`ask:${ask.id}`, '');

  return sent;
};

// Your own words to the ask's thread. The ask stays open everywhere, so here only what you wrote
// goes.
export const noteAsk = async (ask: Ask, text: string) => {
  await hex.asks.note(ask.id, text);
  sentDraft(`ask:${ask.id}`, text);
};

// On a call, the voice starts going through your asks with you.
export const raiseAsks = async () => {
  await hex.asks.talk();
};

// Where an option's screenshot is read from.
export const shotOf = (ask: Ask, shot: number) => hex.asks.shot(ask.id, shot);

// Everything waiting on you, live while the sheet is open. An answer or a not needed folds its card
// where it sits and goes to hex; the card stays folded there with Undo until the sheet closes.
// Whatever hex couldn't take says why on the item it was about, an answer that didn't land opens
// again, and one that missed a place stays folded, through the sheet closing, and says so until
// it's sent again or undone.
export const useAsks = (open: boolean) => {
  const [state, dispatch] = useReducer(yours, { answered: {} });
  const tries = useFailures();
  const [missed, setMissed] = useState<Record<string, number>>({});

  const reached = (id: AskId, sent?: Sent) => {
    setMissed(({ [id]: _, ...rest }) =>
      sent !== undefined && sent.missed !== 0 ? { ...rest, [id]: sent.missed } : rest,
    );
  };

  // hex takes one thing at a time per ask, so each answer, undo or send again here goes once the
  // one before it is done, and only the latest you did may change how its card shows.
  const queue = useRef(new Map<AskId, { last: Promise<unknown>; turn: number }>());

  const inTurn = (id: AskId, work: (latest: () => boolean) => Promise<unknown>) => {
    const now = queue.current.get(id) ?? { last: Promise.resolve(), turn: 0 };
    const turn = now.turn + 1;
    const latest = () => queue.current.get(id)?.turn === turn;
    queue.current.set(id, { last: now.last.then(async () => await work(latest)), turn });
  };

  // What went out for each ask and hasn't been taken back, sent the same way by Send again.
  const out = useRef(new Map<AskId, () => Promise<Sent>>());
  const [kept, keep] = useKept('asks', AskList);
  useEffect(() => {
    if (kept && !state.list) {
      dispatch({ type: 'list', list: kept });
    }
  }, [kept]);

  const watching = useWatch(open ? 'asks' : null, hex.asks.list, (list) => {
    keep(list);
    dispatch({ type: 'list', list });
  });

  // Closing tidies what was folded, and the reasons it showed, only as Tasks opens again, before it
  // shows, so nothing on it changes while it fades out; a reason that came while it was closed stays.
  const [wasOpen, setWasOpen] = useState(open);
  const [shownFailed, setShownFailed] = useState<string[]>([]);

  if (open !== wasOpen) {
    setWasOpen(open);

    if (open) {
      dispatch({ type: 'close', keep: Object.keys(missed) });
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
    dispatch({ type: 'answer', id: ask.id, label });
    inTurn(ask.id, async (latest) => {
      if (
        await tries.attempt(ask.id, what, async () => {
          reached(ask.id, await send());
        })
      ) {
        out.current.set(ask.id, send);
      } else if (latest()) {
        dispatch({ type: 'failed', id: ask.id });
      }
    });
  };

  const undo = (id: AskId) => {
    const label = state.answered[id] ?? '';

    if (label === '') {
      return;
    }

    dispatch({ type: 'undo', id });
    reached(id);
    inTurn(id, async (latest) => {
      if (!out.current.has(id)) {
        return;
      }

      if (
        await tries.attempt(id, 'Not undone', async () => {
          await hex.asks.undo(id);
        })
      ) {
        out.current.delete(id);
      } else if (latest()) {
        dispatch({ type: 'answer', id, label });
      }
    });
  };

  return {
    list,
    shown: list?.asks ?? [],
    answered: state.answered,
    open: openAsks(state),
    offline: watching === 'offline',
    current: watching === 'current',
    answer: (ask: Ask, option: AskOption) => {
      settle(ask, option.label, 'Not answered', async () => await answerAsk(ask, option));
    },
    dismiss: (ask: Ask) => {
      settle(ask, NOT_NEEDED, 'Not put away', async () => await hex.asks.dismiss(ask.id));
    },
    // What went out stands, so sending it again only reaches the places it missed, and it stays
    // folded whether or not they answer this time.
    again: (ask: Ask) => {
      const send = out.current.get(ask.id);

      if (!send) {
        return;
      }

      reached(ask.id);
      inTurn(
        ask.id,
        async () =>
          await tries.attempt(ask.id, 'Not sent again', async () => {
            reached(ask.id, await send());
          }),
      );
    },
    undo,
    act: async (id: string) =>
      await tries.attempt(id, 'Not sent', async () => {
        await hex.asks.act(id);
      }),
    read: async (id: string) =>
      await tries.attempt(id, 'Not marked read', async () => {
        await hex.asks.read(id);
      }),
  };
};

// The last check in full, fetched when its page opens and again whenever a new one lands.
export const useCheck = (at: string | undefined) => {
  const { answer, ...answered } = useAnswer(
    at ?? null,
    undefined,
    async () => await hex.asks.check(),
  );

  return { check: answer, ...answered };
};

// An ask's thread's own words, asked for while its card is open. Where hex has none, there are none.
export const useWords = (id: AskId | null) =>
  useAnswer(id, undefined, async (open) => await hex.asks.words(open)).answer;
