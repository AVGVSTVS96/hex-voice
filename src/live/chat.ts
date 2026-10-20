import type { Chat, ChatTurn } from './tasks';

// What you sent from here to thread `id` that its chat doesn't show yet: `total` is how long the
// chat was then, so it's found once it shows up after that point. One that failed keeps its key,
// so trying again delivers it once.
export type Sending = { id: string; key: string; text: string; total: number; failed?: boolean };

// Whether hex's chat has what you sent: waiting to be taken under its key, or said in the chat.
export function arrived(chat: Chat, sent: Sending) {
  return (
    chat.waiting.some(({ key }) => key.endsWith(`:${sent.key}`)) ||
    chat.turns
      .slice(Math.max(0, sent.total - (chat.total - chat.turns.length)))
      .some((turn) => turn.from === 'me' && turn.text === sent.text)
  );
}

export const newKey = () =>
  `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// How a turn reads: your words, hex's, or something you did there, which every app writes the same
// way, its label in parentheses first: "(answered in the app) Ship it?: Yes", "(vote: Go)",
// "(photo)". A voice message is just your words.
export type Said =
  { kind: 'me' | 'hex'; text: string } | { kind: 'event'; label: string; text: string };

const EVENT = /^\(([^()\n]+)\)\s*([\s\S]*)$/;

export function said(turn: ChatTurn): Said {
  const event = turn.from === 'me' ? turn.text.match(EVENT) : null;
  if (!event) return { kind: turn.from, text: turn.text };
  const [, label, text] = event as unknown as [string, string, string];
  if (label === 'voice message') return { kind: 'me', text };
  return { kind: 'event', label: label[0]!.toUpperCase() + label.slice(1), text };
}
