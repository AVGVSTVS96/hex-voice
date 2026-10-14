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

// What's yours as this phone shows it: hex's list, with each ask answered here held in its place,
// folded to what you said, until the sheet closes, so Undo stays in reach. An undone ask (null)
// stays put until hex lists it as open again.
export type Yours = { list?: AskList; answered: Record<string, string | null> };
export type YoursAction =
  | { type: 'list'; list: AskList }
  | { type: 'answer'; id: string; label: string }
  | { type: 'undo'; id: string }
  | { type: 'failed'; id: string }
  | { type: 'close' };

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
    case 'close':
      return {
        list: list && { ...list, asks: list.asks.filter((ask) => !answered[ask.id]) },
        answered: {},
      };
  }
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

export interface AsksAPI {
  list(after?: number, signal?: AbortSignal): Promise<AskList>;
  check(): Promise<Check>;
  answer(id: string, label: string): Promise<void>;
  undo(id: string): Promise<void>;
  act(id: string): Promise<void>;
  read(id: string): Promise<void>;
  talk(): Promise<void>;
}

export type AskFilter = 'all' | 'decide' | 'do' | 'look' | 'stuck';
export const FILTERS: { key: AskFilter; title: string }[] = [
  { key: 'all', title: 'All' },
  { key: 'decide', title: 'Decide' },
  { key: 'do', title: 'Do' },
  { key: 'look', title: 'Look' },
  { key: 'stuck', title: 'Stuck' },
];

// Stuck isn't an ask: under its filter the asks step aside for what stopped.
export function filterAsks(asks: Ask[], filter: AskFilter) {
  if (filter === 'all') return asks;
  if (filter === 'stuck') return [];
  if (filter === 'decide') return asks.filter((ask) => ask.kind === 'pick' || ask.kind === 'yesno');
  return asks.filter((ask) => ask.kind === filter);
}

// All counts everything yours: the asks, what's stuck, and threads waiting on you some other way.
export function filterCounts(asks: Ask[], stuck: number, waiting = 0): Record<AskFilter, number> {
  return {
    all: asks.length + stuck + waiting,
    decide: filterAsks(asks, 'decide').length,
    do: filterAsks(asks, 'do').length,
    look: filterAsks(asks, 'look').length,
    stuck,
  };
}

// "Checked 6:31pm" with what it did: "fixed 4 · flagged 3".
export function checkLine(check: CheckSummary) {
  const did = [check.fixed && `fixed ${check.fixed}`, check.flagged && `flagged ${check.flagged}`]
    .filter(Boolean)
    .join(' · ');
  return { title: `Checked ${timeOfDay(check.at)}`, did };
}

// How many characters fit on a pill: one alone spans the card, two share it.
const PILL_FITS = [0, 28, 13];

// Two short choices sit side by side; several, or any too long for its pill, stack one per row.
export function stacked(ask: Ask) {
  const fits = PILL_FITS[ask.options.length];
  return !fits || ask.options.some((option) => option.label.length > fits);
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
