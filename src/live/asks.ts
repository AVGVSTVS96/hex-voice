import { timeOfDay } from './calls';

export type AskKind = 'pick' | 'yesno' | 'do' | 'look';
export type AskOption = { label: string; value?: string; pick?: boolean; url?: string };
export type Ask = {
  id: string;
  kind: AskKind;
  task: string;
  topic: string;
  at: string;
  question: string;
  context?: string;
  options: AskOption[];
  tag?: string;
  places?: string[];
  link?: string;
};
export type Stuck = {
  id: string;
  title: string;
  why: string;
  action: string;
  mark: 'paused' | 'failed';
  at: string;
  request?: string;
  sent?: string;
};
export type Fresh = {
  id: string;
  title: string;
  where: string;
  line: string;
  at: string;
  read: boolean;
};
export type CheckSummary = { at: string; why: string; fixed: number; flagged: number };
export type CheckNote = { title: string; text: string; did?: string };
export type Check = {
  at: string;
  why: string;
  read: Record<string, number>;
  fixed: CheckNote[];
  flagged: CheckNote[];
};
export type AskList = {
  version: number;
  asks: Ask[];
  stuck: Stuck[];
  fresh: Fresh[];
  check: CheckSummary | null;
};
// An ask answered on this phone, folded to one line until the sheet closes, so Undo stays in reach.
export type Answered = { ask: Ask; label: string };

export interface AsksAPI {
  list(after?: number, signal?: AbortSignal): Promise<AskList>;
  check(): Promise<Check>;
  answer(id: string, label: string): Promise<void>;
  undo(id: string): Promise<void>;
  act(id: string): Promise<void>;
  read(id: string): Promise<void>;
  talk(): Promise<void>;
}

export type AskFilter = 'all' | 'decide' | 'do' | 'look';
export const FILTERS: { key: AskFilter; title: string }[] = [
  { key: 'all', title: 'All' },
  { key: 'decide', title: 'Decide' },
  { key: 'do', title: 'Do' },
  { key: 'look', title: 'Look' },
];

export function filterAsks(asks: Ask[], filter: AskFilter) {
  if (filter === 'all') return asks;
  if (filter === 'decide') return asks.filter((ask) => ask.kind === 'pick' || ask.kind === 'yesno');
  return asks.filter((ask) => ask.kind === filter);
}

export function filterCounts(asks: Ask[]): Record<AskFilter, number> {
  return {
    all: asks.length,
    decide: filterAsks(asks, 'decide').length,
    do: filterAsks(asks, 'do').length,
    look: filterAsks(asks, 'look').length,
  };
}

// The list's line under "Tasks": what's yours, what's stuck, what's working.
export function yoursSubtitle(yours: number, stuck: number, working: number) {
  const parts = [
    yours && `${yours} yours`,
    stuck && `${stuck} stuck`,
    working && `${working} working`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Nothing waits on you';
}

// "Checked 6:31pm" with what it did: "fixed 4 · flagged 3".
export function checkLine(check: CheckSummary) {
  const did = [check.fixed && `fixed ${check.fixed}`, check.flagged && `flagged ${check.flagged}`]
    .filter(Boolean)
    .join(' · ');
  return { title: `Checked ${timeOfDay(check.at)}`, did };
}

// Two short choices sit side by side; a pick among several stacks, one per row.
export function stacked(ask: Ask) {
  return ask.kind === 'pick' && ask.options.length > 2;
}

// Where else it was asked, as one line: "Asked in calls, autofork and General".
export function placesLine(places: string[] = []) {
  if (places.length < 2) return undefined;
  const last = places.at(-1)!;
  return `Asked in ${places.slice(0, -1).join(', ')} and ${last}`;
}

// What the folded line says happened to its Telegram message.
export function foldNote(ask: Ask, label: string) {
  if (!ask.link) return `Sent to ${ask.topic}`;
  return `Telegram’s buttons now say Answered in the app: ${label}`;
}
