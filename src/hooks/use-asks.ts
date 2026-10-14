import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { useWatch } from '@/hooks/use-watch';
import { asksAPI } from '@/live/api';
import type { Answered, Ask, AskList, AskOption } from '@/live/asks';

// Everything waiting on you, live while the sheet is open. An answer folds its card at once and
// goes to hex; the card stays folded with Undo until the sheet closes, and comes back if hex
// couldn't take the answer.
export function useAsks(open: boolean) {
  const [list, setList] = useState<AskList>();
  const [offline, setOffline] = useState(false);
  const [answered, setAnswered] = useState<Answered[]>([]);
  useWatch(open, asksAPI.list, setList, setOffline);
  useEffect(() => {
    if (!open) setAnswered([]);
  }, [open]);

  const drop = (id: string) => setAnswered((now) => now.filter((entry) => entry.ask.id !== id));
  const answer = (ask: Ask, option: AskOption) => {
    if (option.url) return void Linking.openURL(option.url);
    setAnswered((now) => [
      { ask, label: option.label },
      ...now.filter((entry) => entry.ask.id !== ask.id),
    ]);
    asksAPI.answer(ask.id, option.label).catch(() => drop(ask.id));
  };
  const undo = (id: string) => {
    drop(id);
    void asksAPI.undo(id).catch(() => {});
  };
  const folded = new Set(answered.map((entry) => entry.ask.id));
  return {
    list,
    asks: list?.asks.filter((ask) => !folded.has(ask.id)),
    answered,
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
