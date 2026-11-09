import * as z from "zod/mini";

import { CallId, timeOfDay } from "./calls";
import { TaskId } from "./tasks";
import type { FailedHere } from "./types";

export const AskId = z.string().brand<"AskId">();

export type AskId = z.infer<typeof AskId>;

const AskOption = z.object({
  label: z.string(),
  value: z.optional(z.string()),
  pick: z.optional(z.boolean()),
  shot: z.optional(z.number()),
  shape: z.optional(z.number()),
  detail: z.optional(z.string()),
});

export type AskOption = z.infer<typeof AskOption>;

const AskLink = z.object({ label: z.string(), url: z.string() });

export type AskLink = z.infer<typeof AskLink>;

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
  kind: z.catch(z.enum(["pick", "yesno", "do", "look"]), "pick"),
  task: TaskId,
  app: z.string(),
  topic: z.string(),
  at: z.string(),
  question: z.string(),
  context: z.optional(z.string()),
  why: z.optional(z.string()),
  options: z.array(AskOption),
  links: z.optional(z.array(AskLink)),
  places: z.array(AskPlace),
  tag: z.optional(z.string()),
  was: z.optional(z.array(AskId)),
});

export const Words = z.object({ place: z.string(), at: z.optional(z.string()), text: z.string() });

export type Words = z.infer<typeof Words>;

export type Ask = z.infer<typeof Ask> & FailedHere & { missed?: number };

export const Sent = z.object({
  thread: z.string(),
  topic: z.string(),
  settled: z.number(),
  missed: z.number(),
});

export type Sent = z.infer<typeof Sent>;

export const NOT_NEEDED = "Not needed";

export const PICK = "hex’s pick";

export const unreached = (missed: number) =>
  missed === 1
    ? "One place was out of reach and still asks it"
    : `${missed} places were out of reach and still ask it`;

export const Stuck = z.object({
  id: z.string(),
  app: z.string(),
  title: z.string(),
  why: z.string(),
  action: z.string(),
  mark: z.catch(z.enum(["paused", "failed"]), "paused"),
  at: z.string(),
  request: z.optional(z.string()),
  sent: z.optional(z.string()),
});

export type Stuck = z.infer<typeof Stuck> & FailedHere;

export const Fresh = z.object({
  id: z.string(),
  app: z.string(),
  topic: z.string(),
  title: z.string(),
  line: z.string(),
  at: z.string(),
  read: z.boolean(),
});

export type Fresh = z.infer<typeof Fresh> & FailedHere;

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

export type AskList = Omit<z.infer<typeof AskList>, "asks" | "stuck" | "fresh"> & {
  asks: Ask[];
  stuck: Stuck[];
  fresh: Fresh[];
};

export interface Yours {
  list?: AskList | undefined;
  answered: Record<string, string | null>;
}

export type YoursAction =
  | { type: "list"; list: AskList }
  | { type: "answer"; id: string; label: string }
  | { type: "undo"; id: string }
  | { type: "failed"; id: string }
  | { type: "close"; keep?: string[] };

export const isAnswered = (answered: Record<string, string | null>, id: string) =>
  (answered[id] ?? "") !== "";

export const yours = (state: Yours, action: YoursAction): Yours => {
  const { list, answered } = state;

  switch (action.type) {
    case "list": {
      const held = (id: string) => id in answered;
      const back = action.list.asks.map((ask) => ask.id).filter((id) => answered[id] === null);

      return {
        list: { ...action.list, asks: keepInPlace(list?.asks ?? [], action.list.asks, held) },
        answered: back.length ? without(answered, back) : answered,
      };
    }

    case "answer": {
      return { list, answered: { ...answered, [action.id]: action.label } };
    }

    case "undo": {
      return { list, answered: { ...answered, [action.id]: null } };
    }

    case "failed": {
      return { list, answered: without(answered, [action.id]) };
    }

    case "close": {
      const kept = new Set(action.keep?.filter((id) => isAnswered(answered, id)));

      return {
        list: list && {
          ...list,
          asks: list.asks.filter((ask) => !isAnswered(answered, ask.id) || kept.has(ask.id)),
        },
        answered: Object.fromEntries(Object.entries(answered).filter(([id]) => kept.has(id))),
      };
    }
  }
};

export const failedOn = (
  list: AskList,
  failed: Record<string, string>,
  missed: Record<string, number> = {},
): AskList => {
  const on = <T extends { id: string }>(item: T) => {
    const why = failed[item.id];

    return why === undefined ? item : { ...item, failed: why };
  };

  return {
    ...list,
    asks: list.asks.map((ask) => {
      const times = missed[ask.id];

      return times === undefined ? on(ask) : { ...on(ask), missed: times };
    }),
    stuck: list.stuck.map(on),
    fresh: list.fresh.map(on),
  };
};

export const openAsks = ({ list, answered }: Yours) =>
  (list?.asks ?? []).filter((ask) => !isAnswered(answered, ask.id));

export const keepInPlace = (before: Ask[], after: Ask[], held: (id: string) => boolean) => {
  const shown = [...after];
  const at = (id: string) => shown.findIndex((ask) => ask.id === id);

  for (const [i, ask] of before.entries()) {
    if (!held(ask.id) || at(ask.id) !== -1) {
      continue;
    }

    const prior = before.slice(0, i).findLast((one) => at(one.id) !== -1);
    shown.splice(prior ? at(prior.id) + 1 : 0, 0, ask);
  }

  return shown;
};

const without = <T>(record: Record<string, T>, ids: string[]) =>
  Object.fromEntries(Object.entries(record).filter(([id]) => !ids.includes(id)));

export const checkLine = (check: CheckSummary) => {
  const did = [check.fixed && `fixed ${check.fixed}`, check.flagged && `flagged ${check.flagged}`]
    .filter(Boolean)
    .join(" · ");

  return { title: `Checked ${timeOfDay(check.at)}`, did };
};
