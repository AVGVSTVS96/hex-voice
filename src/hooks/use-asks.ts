import { useEffect, useReducer, useState } from 'react';
import { Linking } from 'react-native';

import { useWatch } from '@/hooks/use-watch';
import { asksAPI } from '@/live/api';
import { openAsks, yours, type Ask, type AskOption } from '@/live/asks';

// Everything waiting on you, live while the sheet is open. An answer folds its card where it sits
// and goes to hex; the card stays folded there with Undo until the sheet closes, and opens again if
// hex couldn't take the answer.
export function useAsks(open: boolean) {
  const [state, dispatch] = useReducer(yours, { answered: {} });
  const [offline, setOffline] = useState(false);
  useWatch(open, asksAPI.list, (list) => dispatch({ type: 'list', list }), setOffline);
  useEffect(() => {
    if (!open) dispatch({ type: 'close' });
  }, [open]);

  const answer = (ask: Ask, option: AskOption) => {
    if (option.url) return void Linking.openURL(option.url);
    dispatch({ type: 'answer', id: ask.id, label: option.label });
    asksAPI.answer(ask.id, option.label).catch(() => dispatch({ type: 'failed', id: ask.id }));
  };
  const undo = (id: string) => {
    dispatch({ type: 'undo', id });
    void asksAPI.undo(id).catch(() => {});
  };
  return {
    list: state.list,
    shown: state.list?.asks ?? [],
    answered: state.answered,
    open: openAsks(state),
    offline,
    answer,
    undo,
    act: (id: string) => asksAPI.act(id).catch(() => {}),
    read: (id: string) => asksAPI.read(id).catch(() => {}),
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
