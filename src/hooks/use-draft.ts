import { useState } from 'react';
import { Settings } from 'react-native';

// What you've typed and not sent yet, kept by where you typed it, so leaving the page, a restart
// into an update or a crash never loses it. The app's defaults read at once, so a field opens with
// its draft already in it.
const KEY = 'HexDrafts';

const saved = (): Record<string, string> => {
  const all: unknown = Settings.get(KEY);
  return all && typeof all === 'object' ? (all as Record<string, string>) : {};
};

export const keepDraft = (where: string, text: string) => {
  const { [where]: _, ...rest } = saved();
  Settings.set({ [KEY]: text.trim() ? { ...rest, [where]: text } : rest });
};

// Once what you typed has gone, its draft goes too, unless you've typed more since.
export const sentDraft = (where: string, text: string) => {
  if (saved()[where]?.trim() === text.trim()) {
    keepDraft(where, '');
  }
};

// What's typed somewhere that's since been listed under another name, like an ask hex's check took
// up, moves to where it is now.
export const carryDraft = (where: string, from: string[]) => {
  const all = saved();
  const old = all[where]?.trim() ? undefined : from.find((key) => all[key]?.trim());
  if (!old) {
    return all[where] ?? '';
  }
  const { [old]: text, ...rest } = all;
  Settings.set({ [KEY]: { ...rest, [where]: text } });
  return text;
};

export const useDraft = (where: string) => {
  const [first] = useState(() => saved()[where] ?? '');
  return {
    first,
    keep: (text: string) => {
      keepDraft(where, text);
    },
  };
};
