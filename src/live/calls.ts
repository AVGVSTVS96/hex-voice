import type { SFSymbol } from "sf-symbols-typescript";
import * as z from "zod/mini";

import { MediaId } from "./media";
import type { Shared } from "./media";
import type { FailedHere, TranscriptEntry } from "./types";

export const CallId = z.string().brand<"CallId">();

export type CallId = z.infer<typeof CallId>;

export const CallSource = z.catch(
  z.enum(["app", "web", "phone-in", "phone-out", "discord", "other"]),
  "other",
);

export type CallSource = z.infer<typeof CallSource>;

export const CallEnding = z.enum([
  "you",
  "hex",
  "dropped",
  "expired",
  "no-connect",
  "no-answer",
  "busy",
]);

export type CallEnding = z.infer<typeof CallEnding>;

const callFields = {
  id: CallId,
  started: z.string(),
  ended: z.optional(z.string()),
  end: z.catch(z.optional(CallEnding), undefined),
  from: CallSource,
  voice: z.optional(z.string()),
  title: z.optional(z.string()),
  reason: z.optional(z.string()),
  why: z.optional(z.string()),
  summary: z.optional(z.string()),
  waiting: z.optional(z.array(z.string())),
};

export const CallSummary = z.object({
  ...callFields,
  seconds: z.number(),
  tasks: z.number(),
  preview: z.string(),
});

export type CallSummary = z.infer<typeof CallSummary> & FailedHere;

const CallTurn = z.object({
  who: z.catch(z.enum(["you", "voice"]), "voice"),
  at: z.number(),
  text: z.string(),
});

export type CallTurn = z.infer<typeof CallTurn>;

const CallTask = z.object({
  id: z.string(),
  state: z.catch(z.enum(["running", "done", "failed"]), "done"),
  at: z.number(),
  text: z.string(),
});

export type CallTask = z.infer<typeof CallTask>;

const CallMark = z.object({
  at: z.number(),
  kind: z.catch(
    z.enum([
      "say",
      "note",
      "paused",
      "resumed",
      "warned",
      "ask",
      "answered",
      "undone",
      "photo",
      "video",
      "muted",
      "unmuted",
      "stopped",
    ]),
    "note",
  ),
  text: z.string(),
  media: z.optional(MediaId),
});

export type CallMark = z.infer<typeof CallMark>;

export const CallRecord = z.object({
  ...callFields,
  turns: z.array(CallTurn),
  tasks: z.array(CallTask),
  moments: z.optional(z.array(CallMark)),
  version: z.optional(z.number()),
});

export type CallRecord = z.infer<typeof CallRecord>;

export const CallList = z.object({
  version: z.number(),
  live: z.optional(CallId),
  calls: z.array(CallSummary),
});

export type CallList = z.infer<typeof CallList>;

export const SOURCES: Record<CallSource, { started: string; where: string; symbol: SFSymbol }> = {
  app: { started: "You called from the app", where: "In the app", symbol: "iphone" },
  web: { started: "You called from the web page", where: "On the web page", symbol: "globe" },
  "phone-in": {
    started: "You called hex",
    where: "On your phone",
    symbol: "phone.arrow.down.left",
  },
  "phone-out": {
    started: "hex called you",
    where: "On your phone",
    symbol: "phone.arrow.up.right",
  },
  discord: { started: "You called from Discord", where: "On Discord", symbol: "headphones" },
  other: { started: "A call with hex", where: "Somewhere else", symbol: "phone" },
};

export const ENDINGS: Record<CallEnding, { line: string; short?: string; bad?: true }> = {
  you: { line: "You hung up" },
  hex: { line: "hex hung up", short: "hex hung up" },
  dropped: { line: "Call dropped", short: "Dropped", bad: true },
  expired: { line: "Time ran out", short: "Time ran out" },
  "no-connect": { line: "Couldn’t connect", short: "Didn’t connect", bad: true },
  "no-answer": { line: "No answer", short: "No answer" },
  busy: { line: "Line busy", short: "Busy" },
};

export const callName = ({ title, preview }: Pick<CallSummary, "title" | "preview">) =>
  [title, preview].find((name) => name !== undefined && name !== "") ?? "A quiet call";

const NAME_ARRIVES_WITHIN = 10 * 60_000;

export const isNaming = (call: CallSummary, now = Date.now()) =>
  (call.title ?? "") === "" &&
  call.ended !== undefined &&
  call.ended !== "" &&
  now - Date.parse(call.ended) < NAME_ARRIVES_WITHIN;

const tasksWord = (count: number) => {
  if (count === 1) {
    return "1 task";
  }

  return count ? `${count} tasks` : "";
};

export const callDetails = (call: CallSummary) => {
  const tasks = tasksWord(call.tasks);

  return [callLength(call.seconds), isNaming(call) ? "naming…" : tasks].filter(Boolean).join(" · ");
};

export const callWhen = (call: CallSummary, live: boolean) =>
  `${dayLabel(call.started)}, ${timeOfDay(call.started)} · ${live ? "Live now" : callLength(call.seconds)}`;

export const transcriptText = (call: CallRecord) => {
  const waiting = call.waiting ?? [];

  const wrapUp = [
    call.summary,
    ...(waiting.length > 0 ? ["Waiting on you:", ...waiting.map((item) => `- ${item}`)] : []),
  ].filter(Boolean);

  const moments = timeline(call).map(momentText);

  return [...(wrapUp.length ? [wrapUp.join("\n")] : []), ...moments].join("\n\n");
};

const momentText = (moment: Moment) => {
  if (moment.kind === "turn") {
    return `${moment.turn.who === "you" ? "You" : "hex"}: ${moment.turn.text}`;
  }

  if (moment.kind === "media") {
    return `You: (${moment.media.kind})`;
  }

  return `[${moment.kind === "task" ? moment.task.text : moment.mark.text}]`;
};

export const liveEntries = ({
  turns,
  moments = [],
}: Pick<CallRecord, "turns" | "moments">): TranscriptEntry[] =>
  [
    ...turns.map(({ who, at, text }) => ({
      id: `${who} ${at}`,
      role: who === "you" ? ("user" as const) : ("assistant" as const),
      text,
      startMs: at,
    })),
    ...moments.flatMap((mark) => {
      const media = sharedOf(mark);

      return media
        ? [{ id: `media ${media.id}`, role: "user" as const, text: "", startMs: mark.at, media }]
        : [];
    }),
  ].sort((a, b) => a.startMs - b.startMs);

const sharedOf = ({ kind, media }: CallMark): Shared | undefined =>
  media && (kind === "photo" || kind === "video") ? { id: media, kind } : undefined;

export const endedSeconds = ({ started, ended }: Pick<CallSummary, "started" | "ended">) =>
  ended === undefined || ended === ""
    ? 0
    : Math.round((Date.parse(ended) - Date.parse(started)) / 1000);

export const callLength = (seconds: number) => {
  if (seconds < 60) {
    return `${Math.max(seconds, 1)} sec`;
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
};

export const clock = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const rest = String(seconds % 60).padStart(2, "0");

  return seconds < 3600
    ? `${Math.floor(seconds / 60)}:${rest}`
    : `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${rest}`;
};

export const timeOfDay = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const dayStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export const dayLabel = (iso: string, now = new Date()) => {
  const date = new Date(iso);
  const days = Math.round((dayStart(now) - dayStart(date)) / 86_400_000);

  if (days === 0) {
    return "Today";
  }

  if (days === 1) {
    return "Yesterday";
  }

  if (days < 7) {
    return date.toLocaleDateString([], { weekday: "long" });
  }

  return date.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
};

export const putBack = (calls: CallSummary[], call: CallSummary) => {
  const at = calls.findIndex((one) => one.started < call.started);

  return at === -1 ? [...calls, call] : [...calls.slice(0, at), call, ...calls.slice(at)];
};

export const byDay = (calls: CallSummary[], now = new Date()) => {
  const days: { label: string; calls: CallSummary[] }[] = [];

  for (const call of calls) {
    const label = periodOf(call.started, now);

    const last = days.at(-1);

    if (last?.label === label) {
      last.calls.push(call);
    } else {
      days.push({ label, calls: [call] });
    }
  }

  return days;
};

const periodOf = (iso: string, now: Date) => {
  const days = daysAgo(iso, now);

  if (days === 0) {
    return "Today";
  }

  return days === 1 ? "Yesterday" : "Earlier";
};

const daysAgo = (iso: string, now: Date) =>
  Math.round((dayStart(now) - dayStart(new Date(iso))) / 86_400_000);

export const callTime = (iso: string, now = new Date()) => {
  const days = daysAgo(iso, now);

  if (days < 2) {
    return timeOfDay(iso);
  }

  const date = new Date(iso);

  if (days < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
};

const SHOWN = {
  paused: true,
  resumed: true,
  warned: true,
  muted: true,
  unmuted: true,
  stopped: true,
};

export type ShownMark = CallMark & { kind: keyof typeof SHOWN };

const shown = (mark: CallMark): mark is ShownMark => mark.kind in SHOWN;

export const hushed = (moments: CallMark[] = []) =>
  moments.findLast(({ kind }) => kind === "muted" || kind === "unmuted")?.kind === "muted";

export type Moment =
  | { kind: "turn"; key: string; at: number; turn: CallTurn }
  | { kind: "task"; key: string; at: number; task: CallTask }
  | { kind: "mark"; key: string; at: number; mark: ShownMark }
  | { kind: "media"; key: string; at: number; media: Shared };

export const timeline = ({
  turns,
  tasks,
  moments = [],
}: Pick<CallRecord, "turns" | "tasks" | "moments">): Moment[] => {
  const markers = new Map<string, CallTask>();

  for (const task of tasks) {
    markers.set(task.id, { ...task, at: markers.get(task.id)?.at ?? task.at });
  }

  return [
    ...turns.map((turn, i) => ({ kind: "turn" as const, key: `turn-${i}`, at: turn.at, turn })),
    ...[...markers.values()].map((task) => ({
      kind: "task" as const,
      key: `task-${task.id}`,
      at: task.at,
      task,
    })),
    ...moments
      .filter(shown)
      .map((mark, i) => ({ kind: "mark" as const, key: `mark-${i}`, at: mark.at, mark })),
    ...moments.flatMap((mark) => {
      const media = sharedOf(mark);

      return media
        ? [{ kind: "media" as const, key: `media-${media.id}`, at: mark.at, media }]
        : [];
    }),
  ].sort((a, b) => a.at - b.at);
};
