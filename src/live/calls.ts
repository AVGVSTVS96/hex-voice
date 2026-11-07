import type { SFSymbol } from 'sf-symbols-typescript';
import * as z from 'zod/mini';

import type { TranscriptEntry } from './types';

export const CallId = z.string().brand<'CallId'>();
export type CallId = z.infer<typeof CallId>;

export const CallSource = z.catch(
  z.enum(['app', 'web', 'phone-in', 'phone-out', 'discord', 'other']),
  'other',
);
export type CallSource = z.infer<typeof CallSource>;
export const CallEnding = z.enum([
  'you',
  'hex',
  'dropped',
  'expired',
  'no-connect',
  'no-answer',
  'busy',
]);
export type CallEnding = z.infer<typeof CallEnding>;

const call = {
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
  ...call,
  seconds: z.number(),
  tasks: z.number(),
  preview: z.string(),
});
// `failed` is this app's, never hex's: why deleting it here didn't go through.
export type CallSummary = z.infer<typeof CallSummary> & { failed?: string };

const CallTurn = z.object({
  who: z.catch(z.enum(['you', 'voice']), 'voice'),
  at: z.number(),
  text: z.string(),
});
export type CallTurn = z.infer<typeof CallTurn>;
const CallTask = z.object({
  id: z.string(),
  state: z.catch(z.enum(['running', 'done', 'failed']), 'done'),
  at: z.number(),
  text: z.string(),
});
export type CallTask = z.infer<typeof CallTask>;
// hex's exact words to the voice (say, note), things that happened to the call itself, and the asks
// it put on screen with their answers and the undos that took one back.
const CallMark = z.object({
  at: z.number(),
  kind: z.catch(
    z.enum(['say', 'note', 'paused', 'resumed', 'warned', 'ask', 'answered', 'undone']),
    'note',
  ),
  text: z.string(),
});
export type CallMark = z.infer<typeof CallMark>;
// A live call's record carries a version, and asking with it waits for the next word.
export const CallRecord = z.object({
  ...call,
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

// `where` is what the call screen says while it shows a call held somewhere other than this app.
export const SOURCES: Record<CallSource, { started: string; where: string; symbol: SFSymbol }> = {
  app: { started: 'You called from the app', where: 'In the app', symbol: 'iphone' },
  web: { started: 'You called from the web page', where: 'On the web page', symbol: 'globe' },
  'phone-in': {
    started: 'You called hex',
    where: 'On your phone',
    symbol: 'phone.arrow.down.left',
  },
  'phone-out': {
    started: 'hex called you',
    where: 'On your phone',
    symbol: 'phone.arrow.up.right',
  },
  discord: { started: 'You called from Discord', where: 'On Discord', symbol: 'headphones' },
  other: { started: 'A call with hex', where: 'Somewhere else', symbol: 'phone' },
};

// `line` closes the call on screen; `short` joins a list row, which only mentions the ending when
// it wasn't you hanging up.
export const ENDINGS: Record<CallEnding, { line: string; short?: string; bad?: true }> = {
  you: { line: 'You hung up' },
  hex: { line: 'hex hung up', short: 'hex hung up' },
  dropped: { line: 'Call dropped', short: 'Dropped', bad: true },
  expired: { line: 'Time ran out', short: 'Time ran out' },
  'no-connect': { line: 'Couldn’t connect', short: 'Didn’t connect', bad: true },
  'no-answer': { line: 'No answer', short: 'No answer' },
  busy: { line: 'Line busy', short: 'Busy' },
};

export function callName(call: Pick<CallSummary, 'title' | 'preview'>) {
  return call.title || call.preview || 'A quiet call';
}

// hex names a call within seconds of it ending; past ten minutes it isn't coming.
export function isNaming(call: CallSummary, now = Date.now()) {
  return !call.title && !!call.ended && now - Date.parse(call.ended) < 10 * 60_000;
}

export function callDetails(call: CallSummary) {
  const tasks = call.tasks === 1 ? '1 task' : call.tasks ? `${call.tasks} tasks` : '';
  return [callLength(call.seconds), isNaming(call) ? 'naming…' : tasks].filter(Boolean).join(' · ');
}

export function callWhen(call: CallSummary, live: boolean) {
  return `${dayLabel(call.started)}, ${timeOfDay(call.started)} · ${live ? 'Live now' : callLength(call.seconds)}`;
}

export function transcriptText(call: CallRecord) {
  const wrapUp = [
    call.summary,
    ...(call.waiting?.length
      ? ['Waiting on you:', ...call.waiting.map((item) => `- ${item}`)]
      : []),
  ].filter(Boolean);
  const moments = timeline(call).map((moment) =>
    moment.kind === 'turn'
      ? `${moment.turn.who === 'you' ? 'You' : 'hex'}: ${moment.turn.text}`
      : `[${moment.kind === 'task' ? moment.task.text : moment.mark.text}]`,
  );
  return [...(wrapUp.length ? [wrapUp.join('\n')] : []), ...moments].join('\n\n');
}

// A call's turns as the live transcript shows them, each keyed by where it starts so it keeps its
// place as its words grow.
export function liveEntries(turns: CallTurn[]): TranscriptEntry[] {
  return turns.map(({ who, at, text }) => ({
    id: `${who} ${at}`,
    role: who === 'you' ? 'user' : 'assistant',
    text,
    startMs: at,
  }));
}

export function endedSeconds({ started, ended }: Pick<CallSummary, 'started' | 'ended'>) {
  return ended ? Math.round((Date.parse(ended) - Date.parse(started)) / 1000) : 0;
}

export function callLength(seconds: number) {
  if (seconds < 60) return `${Math.max(seconds, 1)} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

export function clock(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const rest = String(seconds % 60).padStart(2, '0');
  return seconds < 3600
    ? `${Math.floor(seconds / 60)}:${rest}`
    : `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${rest}`;
}

export function timeOfDay(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function dayLabel(iso: string, now = new Date()) {
  const date = new Date(iso);
  const days = Math.round((dayStart(now) - dayStart(date)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], {
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

// A call back among the others, newest first, where it sat before.
export function putBack(calls: CallSummary[], call: CallSummary) {
  const at = calls.findIndex((one) => one.started < call.started);
  return at === -1 ? [...calls, call] : [...calls.slice(0, at), call, ...calls.slice(at)];
}

// Calls under three heads at most, so a day's name doesn't head nearly every call: today,
// yesterday, and everything before, each newest first, as hex sends them.
export function byDay(calls: CallSummary[], now = new Date()) {
  const days: { label: string; calls: CallSummary[] }[] = [];
  for (const call of calls) {
    const label = periodOf(call.started, now);
    if (days.at(-1)?.label === label) days.at(-1)!.calls.push(call);
    else days.push({ label, calls: [call] });
  }
  return days;
}

function periodOf(iso: string, now: Date) {
  const days = daysAgo(iso, now);
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : 'Earlier';
}

const daysAgo = (iso: string, now: Date) =>
  Math.round((dayStart(now) - dayStart(new Date(iso))) / 86_400_000);

// When a call was, beside its name: the time today and yesterday, as their heads say the day;
// before that, the day of the week, or the date once it's more than a week back.
export function callTime(iso: string, now = new Date()) {
  const days = daysAgo(iso, now);
  if (days < 2) return timeOfDay(iso);
  const date = new Date(iso);
  if (days < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

// What happened to the call shows in it; hex's say and note text is the voice's own words already,
// and its asks show as cards.
const SHOWN = { paused: true, resumed: true, warned: true };
export type ShownMark = CallMark & { kind: keyof typeof SHOWN };
const shown = (mark: CallMark): mark is ShownMark => mark.kind in SHOWN;

export type Moment =
  | { kind: 'turn'; key: string; at: number; turn: CallTurn }
  | { kind: 'task'; key: string; at: number; task: CallTask }
  | { kind: 'mark'; key: string; at: number; mark: ShownMark };

// One marker per task, where hex started it, showing how it ended up.
export function timeline({
  turns,
  tasks,
  moments = [],
}: Pick<CallRecord, 'turns' | 'tasks' | 'moments'>): Moment[] {
  const markers = new Map<string, CallTask>();
  for (const task of tasks)
    markers.set(task.id, { ...task, at: markers.get(task.id)?.at ?? task.at });
  return [
    ...turns.map((turn, i) => ({ kind: 'turn' as const, key: `turn-${i}`, at: turn.at, turn })),
    ...[...markers.values()].map((task) => ({
      kind: 'task' as const,
      key: `task-${task.id}`,
      at: task.at,
      task,
    })),
    ...moments
      .filter(shown)
      .map((mark, i) => ({ kind: 'mark' as const, key: `mark-${i}`, at: mark.at, mark })),
  ].sort((a, b) => a.at - b.at);
}
