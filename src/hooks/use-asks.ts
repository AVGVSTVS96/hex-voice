import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { hex } from '@/hex';
import { keepDraft } from '@/hooks/use-draft';
import { useFailures } from '@/hooks/use-failures';
import { useKept } from '@/hooks/use-kept';
import { useWatch } from '@/hooks/use-watch';
import {
  AskList,
  NOT_NEEDED,
  failedOn,
  openAsks,
  yours,
  type Ask,
  type AskId,
  type AskOption,
  type Check,
  type Sent,
} from '@/live/asks';

// The one way to answer an ask, from Tasks or its card on a call: once hex has it, what you'd
// started typing on it goes, and you get back what the answer reached.
export async function answerAsk(ask: Ask, option: AskOption) {
  const sent = await hex.asks.answer(ask.id, option.label);
  keepDraft(`ask:${ask.id}`, '');
  return sent;
}

// Your own words to the ask's thread. The ask stays open everywhere, so here only what you wrote
// goes.
export async function noteAsk(ask: Ask, text: string) {
  await hex.asks.note(ask.id, text);
  keepDraft(`ask:${ask.id}`, '');
}

// On a call, the voice starts going through your asks with you.
export const raiseAsks = () => hex.asks.talk();

// Everything waiting on you, live while the sheet is open. An answer or a not needed folds its card
// where it sits and goes to hex; the card stays folded there with Undo until the sheet closes.
// Whatever hex couldn't take says why on the item it was about, an answer that didn't land opens
// again, and one that missed a place says so until it's sent again.
export function useAsks(open: boolean) {
  const [state, dispatch] = useReducer(yours, { answered: {} });
  const tries = useFailures();
  const [missed, setMissed] = useState<Record<string, number>>({});
  // Each ask's latest answer, so Send again sends it the same way and an Undo tapped while it's on
  // its way reaches hex after it.
  const answers = useRef(new Map<AskId, { send: () => Promise<Sent>; landed: Promise<boolean> }>());
  const reached = (id: AskId, sent?: Sent) =>
    setMissed(({ [id]: _, ...rest }) => (sent?.missed ? { ...rest, [id]: sent.missed } : rest));
  const [kept, keep] = useKept('asks', AskList);
  useEffect(() => {
    if (kept && !state.list) dispatch({ type: 'list', list: kept });
  }, [kept]);
  const watching = useWatch(open ? 'asks' : null, hex.asks.list, (list) => {
    keep(list);
    dispatch({ type: 'list', list });
  });
  useEffect(() => {
    if (open) return;
    dispatch({ type: 'close' });
    tries.clear();
    setMissed({});
  }, [open]);
  const list = useMemo(
    () => state.list && failedOn(state.list, tries.failed, missed),
    [state.list, tries.failed, missed],
  );

  const settle = (ask: Ask, label: string, what: string, send: () => Promise<Sent>) => {
    dispatch({ type: 'answer', id: ask.id, label });
    const landed = tries.attempt(ask.id, what, async () => reached(ask.id, await send()));
    answers.current.set(ask.id, { send, landed });
    void landed.then((ok) => {
      if (!ok) dispatch({ type: 'failed', id: ask.id });
    });
  };
  const undo = (id: AskId) => {
    const label = state.answered[id];
    if (!label) return;
    dispatch({ type: 'undo', id });
    void answers.current.get(id)?.landed.then(async (landed) => {
      if (!landed) return;
      if (await tries.attempt(id, 'Not undone', () => hex.asks.undo(id))) reached(id);
      else dispatch({ type: 'answer', id, label });
    });
  };
  return {
    list,
    shown: list?.asks ?? [],
    answered: state.answered,
    open: openAsks(state),
    offline: watching === 'offline',
    current: watching === 'current',
    answer: (ask: Ask, option: AskOption) =>
      settle(ask, option.label, 'Not answered', () => answerAsk(ask, option)),
    dismiss: (ask: Ask) => settle(ask, NOT_NEEDED, 'Not put away', () => hex.asks.dismiss(ask.id)),
    // What went out stands, so sending it again only reaches the places it missed, and it stays
    // folded whether or not they answer this time.
    again: (ask: Ask) => {
      const last = answers.current.get(ask.id);
      if (last)
        void tries.attempt(ask.id, 'Not sent again', async () =>
          reached(ask.id, await last.send()),
        );
    },
    undo,
    act: (id: string) => tries.attempt(id, 'Not sent', () => hex.asks.act(id)),
    read: (id: string) => tries.attempt(id, 'Not marked read', () => hex.asks.read(id)),
  };
}

// The last check in full, fetched when its page opens and again whenever a new one lands.
export function useCheck(at: string | undefined) {
  const [check, setCheck] = useState<Check>();
  useEffect(() => {
    if (!at) return;
    let current = true;
    hex.asks.check().then(
      (fresh) => current && setCheck(fresh),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [at]);
  return check?.at === at ? check : undefined;
}
