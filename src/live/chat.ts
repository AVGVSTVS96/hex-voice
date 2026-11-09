import type { Picked } from "./media";
import type { Chat, ChatTurn, TaskId } from "./tasks";

export interface Sending {
  id: TaskId;
  key: string;
  text: string;
  media: Picked[];
  total: number;
  failed?: { why: string; again: boolean };
}

export const arrived = (chat: Chat, sent: Sending) =>
  chat.waiting.some(({ key }) => key.endsWith(`:${sent.key}`)) ||
  chat.turns
    .slice(Math.max(0, sent.total - (chat.total - chat.turns.length)))
    .some(
      (turn) =>
        turn.from === "me" &&
        turn.text === sent.text &&
        (turn.media?.length ?? 0) === sent.media.length,
    );

export const newKey = () =>
  `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export type Said =
  | { kind: "me" | "hex"; text: string }
  | { kind: "event"; label: string; text: string };

const EVENT = /^\((?<label>[^()\n]+)\)\s*(?<text>[\s\S]*)$/u;

export const said = (turn: ChatTurn): Said => {
  const event = turn.from === "me" ? EVENT.exec(turn.text)?.groups : undefined;
  const { label, text = "" } = event ?? {};

  if (label === undefined) {
    return { kind: turn.from, text: turn.text };
  }

  if (label === "voice message") {
    return { kind: "me", text };
  }

  if (label.startsWith("asked Siri")) {
    return { kind: "event", label: "Asked Siri", text };
  }

  return { kind: "event", label: label.slice(0, 1).toUpperCase() + label.slice(1), text };
};
