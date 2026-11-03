import { useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { hex } from '@/hex';
import { keepDraft } from '@/hooks/use-draft';
import { useFailures } from '@/hooks/use-failures';
import { useKept } from '@/hooks/use-kept';
import { useWatch } from '@/hooks/use-watch';
import {
  AskList,
  failedOn,
  openAsks,
  yours,
  type Ask,
  type AskId,
  type AskOption,
  type Check,
} from '@/live/asks';

// The one way to answer an ask, from Tasks or its card on a call: once hex has it, what you'd
// started typing on it goes.
export async function answerAsk(ask: Ask, option: AskOption) {
  await hex.asks.answer(ask.id, option.label);
  keepDraft(`ask:${ask.id}`, '');
}

// On a call, the voice starts going through your asks with you.
export const raiseAsks = () => hex.asks.talk();

// Everything waiting on you, live while the sheet is open. An answer folds its card where it sits
// and goes to hex; the card stays folded there with Undo until the sheet closes. Whatever hex
// couldn't take says why on the item it was about, and an answer that didn't land opens again.
export function useAsks(open: boolean) {
  const [state, dispatch] = useReducer(yours, { answered: {} });
  const tries = useFailures();
  // Each ask's latest answer, so an Undo tapped while it's on its way reaches hex after it.
  const answers = useRef(new Map<AskId, Promise<boolean>>());
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
  }, [open]);
  const list = useMemo(
    () => state.list && failedOn(state.list, tries.failed),
    [state.list, tries.failed],
  );

  const answer = (ask: Ask, option: AskOption) => {
    dispatch({ type: 'answer', id: ask.id, label: option.label });
    const sent = tries.attempt(ask.id, 'Not answered', () => answerAsk(ask, option));
    answers.current.set(ask.id, sent);
    void sent.then((landed) => {
      if (!landed) dispatch({ type: 'failed', id: ask.id });
    });
  };
  const undo = (id: AskId) => {
    const label = state.answered[id];
    if (!label) return;
    dispatch({ type: 'undo', id });
    void answers.current.get(id)?.then(async (landed) => {
      if (landed && !(await tries.attempt(id, 'Not undone', () => hex.asks.undo(id))))
        dispatch({ type: 'answer', id, label });
    });
  };
  return {
    list,
    shown: list?.asks ?? [],
    answered: state.answered,
    open: openAsks(state),
    offline: watching === 'offline',
    current: watching === 'current',
    answer,
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
