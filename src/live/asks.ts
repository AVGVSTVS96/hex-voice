import * as z from 'zod/mini';

import { CallId, timeOfDay } from './calls';
import { TaskId } from './tasks';

export const AskId = z.string().brand<'AskId'>();
export type AskId = z.infer<typeof AskId>;

// An answer: each tells hex something. A page an ask points to is a link, and opening it answers
// nothing.
const AskOption = z.object({
  label: z.string(),
  value: z.optional(z.string()),
  pick: z.optional(z.boolean()),
  // Its screenshot's number, when the choice is between looks.
  shot: z.optional(z.number()),
});
export type AskOption = z.infer<typeof AskOption>;
const AskLink = z.object({ label: z.string(), url: z.string() });
export type AskLink = z.infer<typeof AskLink>;
// Each place an ask was asked: a thread in its app (`task` is its id among the tasks) or a call
// (`app: 'voice'`, opened in Calls by `call`). Without a link we know it's from there but can't open
// it. hex sends the ones that open first, then the rest, each newest first.
const AskPlace = z.object({
  app: z.string(),
  place: z.string(),
  task: z.optional(TaskId),
  call: z.optional(CallId),
  link: z.optional(z.string()),
});
export type AskPlace = z.infer<typeof AskPlace>;
export const Ask = z.object({
  id: AskId,
  kind: z.catch(z.enum(['pick', 'yesno', 'do', 'look']), 'pick'),
  task: TaskId,
  app: z.string(),
  topic: z.string(),
  at: z.string(),
  question: z.string(),
  context: z.optional(z.string()),
  options: z.array(AskOption),
  links: z.optional(z.array(AskLink)),
  places: z.array(AskPlace),
  tag: z.optional(z.string()),
  // The ids it was listed under before hex's check took it up.
  was: z.optional(z.array(AskId)),
});
// Where an ask came from in its thread's own words, read when its card opens: the place as Tasks
// names it, when it was said there, and the words, as written.
export const Words = z.object({ place: z.string(), at: z.optional(z.string()), text: z.string() });
export type Words = z.infer<typeof Words>;
// Every item names the app it lives in; a stuck one is T3 Code's, or hex's own (`hex`). `failed` and
// `missed` are this app's, never hex's: what you did to it here that didn't go through, and why, and
// how many places an answer from here couldn't reach, which still ask it.
export type Ask = z.infer<typeof Ask> & { failed?: string; missed?: number };
// What an answer, a note or a not needed reached: the hex thread it told and that thread's name, how
// many open copies of the ask (buttons or polls) it sent an answer or settle to, and how many copies
// or threads it couldn't reach because their app's hub was down. Hubs don't confirm, so `settled`
// means sent to.
export const Sent = z.object({
  thread: z.string(),
  topic: z.string(),
  settled: z.number(),
  missed: z.number(),
});
export type Sent = z.infer<typeof Sent>;

// What a not needed reads as, folded here and on a call's card, where hex records it as the answer.
export const NOT_NEEDED = 'Not needed';
// What marks the option hex would answer with, wherever it's offered.
export const PICK = 'hex’s pick';

// The places an answer couldn't reach, which still ask it until it's sent again.
export const unreached = (missed: number) =>
  missed === 1
    ? 'One place was out of reach and still asks it'
    : `${missed} places were out of reach and still ask it`;
export const Stuck = z.object({
  id: z.string(),
  app: z.string(),
  title: z.string(),
  why: z.string(),
  action: z.string(),
  mark: z.catch(z.enum(['paused', 'failed']), 'paused'),
  at: z.string(),
  request: z.optional(z.string()),
  sent: z.optional(z.string()),
});
export type Stuck = z.infer<typeof Stuck> & { failed?: string };
export const Fresh = z.object({
  id: z.string(),
  app: z.string(),
  topic: z.string(),
  title: z.string(),
  line: z.string(),
  at: z.string(),
  read: z.boolean(),
});
export type Fresh = z.infer<typeof Fresh> & { failed?: string };
const CheckSummary = z.object({
  at: z.string(),
  why: z.string(),
  fixed: z.number(),
  flagged: z.number(),
});
export type CheckSummary = z.infer<typeof CheckSummary>;
const CheckNote = z.object({ title: z.string(), text: z.string(), did: z.optional(z.string()) });
export type CheckNote = z.infer<typeof CheckNote>;
export const Check = z.object({
  at: z.string(),
  why: z.string(),
  read: z.record(z.string(), z.number()),
  fixed: z.array(CheckNote),
  flagged: z.array(CheckNote),
});
export type Check = z.infer<typeof Check>;
export const AskList = z.object({
  version: z.number(),
  asks: z.array(Ask),
  stuck: z.array(Stuck),
  fresh: z.array(Fresh),
  check: z.nullable(CheckSummary),
});
// What this app holds of hex's list, with what didn't go through here on each item it's about.
export type AskList = Omit<z.infer<typeof AskList>, 'asks' | 'stuck' | 'fresh'> & {
  asks: Ask[];
  stuck: Stuck[];
  fresh: Fresh[];
};

// What's yours as this phone shows it: hex's list, with each ask answered here held in its place,
// folded to what you said, until the sheet closes, so Undo stays in reach. Closing keeps the ones
// it's told to, like an answer still missing a place. An undone ask (null) stays put until hex
// lists it as open again.
export type Yours = { list?: AskList; answered: Record<string, string | null> };
export type YoursAction =
  | { type: 'list'; list: AskList }
  | { type: 'answer'; id: string; label: string }
  | { type: 'undo'; id: string }
  | { type: 'failed'; id: string }
  | { type: 'close'; keep?: string[] };

export function yours(state: Yours, action: YoursAction): Yours {
  const { list, answered } = state;
  switch (action.type) {
    case 'list': {
      const held = (id: string) => id in answered;
      const back = action.list.asks.map((ask) => ask.id).filter((id) => answered[id] === null);
      return {
        list: { ...action.list, asks: keepInPlace(list?.asks ?? [], action.list.asks, held) },
        answered: back.length ? without(answered, back) : answered,
      };
    }
    case 'answer':
      return { list, answered: { ...answered, [action.id]: action.label } };
    case 'undo':
      return { list, answered: { ...answered, [action.id]: null } };
    case 'failed':
      return { list, answered: without(answered, [action.id]) };
    case 'close': {
      const kept = new Set(action.keep?.filter((id) => answered[id]));
      return {
        list: list && {
          ...list,
          asks: list.asks.filter((ask) => !answered[ask.id] || kept.has(ask.id)),
        },
        answered: Object.fromEntries(Object.entries(answered).filter(([id]) => kept.has(id))),
      };
    }
  }
}

// hex's list with what didn't go through on each item it's about, and on each ask an answer from
// here left open somewhere, how many places still ask it.
export function failedOn(
  list: AskList,
  failed: Record<string, string>,
  missed: Record<string, number> = {},
): AskList {
  const on = <T extends { id: string }>(item: T) =>
    failed[item.id] ? { ...item, failed: failed[item.id] } : item;
  return {
    ...list,
    asks: list.asks.map((ask) =>
      missed[ask.id] ? { ...on(ask), missed: missed[ask.id] } : on(ask),
    ),
    stuck: list.stuck.map(on),
    fresh: list.fresh.map(on),
  };
}

// The asks still open, for the counts: the folded ones are already off your plate.
export function openAsks({ list, answered }: Yours) {
  return (list?.asks ?? []).filter((ask) => !answered[ask.id]);
}

// hex's new list, with every held ask it dropped put back right after the ask it followed.
export function keepInPlace(before: Ask[], after: Ask[], held: (id: string) => boolean) {
  const shown = [...after];
  const at = (id: string) => shown.findIndex((ask) => ask.id === id);
  before.forEach((ask, i) => {
    if (!held(ask.id) || at(ask.id) !== -1) return;
    const prior = before.slice(0, i).findLast((one) => at(one.id) !== -1);
    shown.splice(prior ? at(prior.id) + 1 : 0, 0, ask);
  });
  return shown;
}

function without<T>(record: Record<string, T>, ids: string[]) {
  return Object.fromEntries(Object.entries(record).filter(([id]) => !ids.includes(id)));
}

// "Checked 6:31pm" with what it did: "fixed 4 · flagged 3".
export function checkLine(check: CheckSummary) {
  const did = [check.fixed && `fixed ${check.fixed}`, check.flagged && `flagged ${check.flagged}`]
    .filter(Boolean)
    .join(' · ');
  return { title: `Checked ${timeOfDay(check.at)}`, did };
}
