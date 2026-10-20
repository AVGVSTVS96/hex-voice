import type { Chat } from './tasks';

// What you sent from here that hex's chat doesn't show yet: `total` is how long the chat was then,
// so it's found once it shows up after that point. One that failed keeps its key, so trying again
// delivers it once.
export type Sending = { key: string; text: string; total: number; failed?: boolean };

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
