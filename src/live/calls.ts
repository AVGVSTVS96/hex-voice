import type { SFSymbol } from 'sf-symbols-typescript';

export type CallSource = 'app' | 'web' | 'phone-in' | 'phone-out';
export type CallEnding =
  'you' | 'hex' | 'dropped' | 'expired' | 'no-connect' | 'no-answer' | 'busy';

export type CallSummary = {
  id: string;
  started: string;
  ended?: string;
  end?: CallEnding;
  from: CallSource;
  voice?: string;
  title?: string;
  seconds: number;
  tasks: number;
  preview: string;
};

export type CallTurn = { who: 'you' | 'voice'; at: number; text: string };
export type CallTask = {
  id: string;
  state: 'running' | 'done' | 'failed';
  at: number;
  text: string;
};
export type CallRecord = Omit<CallSummary, 'seconds' | 'tasks' | 'preview'> & {
  turns: CallTurn[];
  tasks: CallTask[];
};
export type CallList = { version: number; live?: string; calls: CallSummary[] };

export interface CallsAPI {
  list(after?: number, signal?: AbortSignal): Promise<CallList>;
  get(id: string): Promise<CallRecord>;
  remove(id: string): Promise<void>;
}

export const SOURCES: Record<CallSource, { started: string; symbol: SFSymbol }> = {
  app: { started: 'You called from the app', symbol: 'iphone' },
  web: { started: 'You called from the web page', symbol: 'globe' },
  'phone-in': { started: 'You called hex', symbol: 'phone.arrow.down.left' },
  'phone-out': { started: 'hex called you', symbol: 'phone.arrow.up.right' },
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
  return timeline(call)
    .map((moment) =>
      moment.kind === 'turn'
        ? `${moment.turn.who === 'you' ? 'You' : 'hex'}: ${moment.turn.text}`
        : `[${moment.task.text}]`,
    )
    .join('\n\n');
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

export function byDay(calls: CallSummary[], now = new Date()) {
  const days: { label: string; calls: CallSummary[] }[] = [];
  for (const call of calls) {
    const label = dayLabel(call.started, now);
    if (days.at(-1)?.label === label) days.at(-1)!.calls.push(call);
    else days.push({ label, calls: [call] });
  }
  return days;
}

export type Moment =
  | { kind: 'turn'; key: string; at: number; turn: CallTurn }
  | { kind: 'task'; key: string; at: number; task: CallTask };

// One marker per task, where hex started it, showing how it ended up.
export function timeline({ turns, tasks }: Pick<CallRecord, 'turns' | 'tasks'>): Moment[] {
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
  ].sort((a, b) => a.at - b.at);
}
