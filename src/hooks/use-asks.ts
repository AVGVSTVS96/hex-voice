import { useEffect, useMemo, useReducer, useState } from 'react';

import { keepDraft } from '@/hooks/use-draft';
import { useFailures } from '@/hooks/use-failures';
import { useWatch } from '@/hooks/use-watch';
import { asksAPI } from '@/live/api';
import { failedOn, openAsks, yours, type Ask, type AskOption } from '@/live/asks';

// Everything waiting on you, live while the sheet is open. An answer folds its card where it sits
// and goes to hex; the card stays folded there with Undo until the sheet closes. Whatever hex
// couldn't take says why on the item it was about, and an answer that didn't land opens again.
export function useAsks(open: boolean) {
  const [state, dispatch] = useReducer(yours, { answered: {} });
  const [offline, setOffline] = useState(false);
  const tries = useFailures();
  useWatch(open, asksAPI.list, (list) => dispatch({ type: 'list', list }), setOffline);
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
    const sent = tries.attempt(ask.id, 'Not answered', () => asksAPI.answer(ask.id, option.label));
    void sent.then((landed) => {
      if (landed) keepDraft(`ask:${ask.id}`, '');
      else dispatch({ type: 'failed', id: ask.id });
    });
  };
  const undo = (id: string) => {
    const label = state.answered[id];
    if (!label) return;
    dispatch({ type: 'undo', id });
    void tries
      .attempt(id, 'Not undone', () => asksAPI.undo(id))
      .then((undone) => undone || dispatch({ type: 'answer', id, label }));
  };
  return {
    list,
    shown: list?.asks ?? [],
    answered: state.answered,
    open: openAsks(state),
    offline,
    answer,
    undo,
    act: (id: string) => tries.attempt(id, 'Not sent', () => asksAPI.act(id)),
    read: (id: string) => tries.attempt(id, 'Not marked read', () => asksAPI.read(id)),
  };
}

// The last check in full, fetched when its page opens and again whenever a new one lands.
export function useCheck(at: string | undefined) {
  const [check, setCheck] = useState<Awaited<ReturnType<typeof asksAPI.check>>>();
  useEffect(() => {
    if (!at) return;
    let current = true;
    asksAPI.check().then(
      (fresh) => current && setCheck(fresh),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [at]);
  return check?.at === at ? check : undefined;
}
