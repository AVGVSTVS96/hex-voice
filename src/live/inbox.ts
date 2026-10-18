import type { Ask, AskList, AskOption, Fresh, Stuck } from './asks';
import { startOfDay, type TaskRow, type Turn } from './tasks';

// Everything hex has going, as one stream sorted by what needs you now: your asks and whatever's
// stuck, then what's working, then what finished today, then the rest, quiet. Tasks shows it a
// stage at a time, each stage cut into its topics.
export type Stage = 'needs' | 'working' | 'done' | 'quiet';
export type Place = 'telegram' | 't3' | 'buzz' | 'discord' | 'server';

// Where a row's item lives, as a tile beside it: a thread in its app, which opens there when it
// has a link, a call, which opens in Calls, or a page. `label` names its button in the row's swipe.
export type Tile =
  | { kind: 'app'; place: Place; label: string; link?: string }
  | { kind: 'call'; label: string; call: string }
  | { kind: 'link'; label: string; url: string };

type Base = { id: string; topic: string; place: Place; tiles: Tile[]; stage: Stage; at: string };
export type Entry = Base &
  (
    | { kind: 'ask'; ask: Ask }
    | { kind: 'stuck'; stuck: Stuck }
    | { kind: 'task'; task: TaskRow }
    | { kind: 'fresh'; fresh: Fresh }
  );

// A topic in a stage: what it has there, one mark per thread it has anywhere, and each thread's
// last week for its lane.
export type Topic = { name: string; entries: Entry[]; marks: Stage[]; tracks: Turn[][] };

export const STAGES: { key: Stage; title: string }[] = [
  { key: 'needs', title: 'Needs you' },
  { key: 'working', title: 'Working' },
  { key: 'done', title: 'Done' },
  { key: 'quiet', title: 'Quiet' },
];

// Where a thread lives. Voice and loose Claude Code sessions live in no app, so they sit together
// on the server, with what hex's own check finds stuck.
export const PLACES: Record<Place, string> = {
  telegram: 'Telegram',
  t3: 'T3 Code',
  buzz: 'Buzz',
  discord: 'Discord',
  server: 'On the server',
};

// hex's stuck list holds things like a rate limit or a failing check, which belong to no topic.
export const STUCK = 'Stuck';

export function placeOf(app: string): Place {
  return app === 'telegram' || app === 't3' || app === 'buzz' || app === 'discord' ? app : 'server';
}

export const opens = (tile: Tile) => tile.kind !== 'app' || !!tile.link;
const kindOf = (tile: Tile) => (tile.kind === 'app' ? tile.place : tile.kind);

const TILES = 3;

// Where an ask was asked, as its row shows it: the places that open first, then the ones that
// can't, each newest first as hex sends them, and its first page last, three tiles at most. Each
// that opens is a button in the row's swipe, named by its app, or by its thread or call when two
// there share one.
export function tilesOf(ask: Ask): Tile[] {
  const places = ask.places.map((one): Tile =>
    one.app === 'voice' && one.call
      ? { kind: 'call', label: one.place, call: one.call }
      : { kind: 'app', place: placeOf(one.app), label: one.place, link: one.link },
  );
  const [page] = ask.links ?? [];
  const shown = [...places.filter(opens), ...places.filter((tile) => !opens(tile))].slice(
    0,
    page ? TILES - 1 : TILES,
  );
  const twins = (tile: Tile) =>
    shown.filter((one) => opens(one) && kindOf(one) === kindOf(tile)).length > 1;
  return [
    ...shown.map((tile) =>
      opens(tile) && twins(tile)
        ? tile
        : { ...tile, label: tile.kind === 'app' ? PLACES[tile.place] : 'Call' },
    ),
    ...(page ? [{ kind: 'link' as const, ...page }] : []),
  ];
}

const threadTile = (place: Place, link?: string): Tile => ({
  kind: 'app',
  place,
  label: PLACES[place],
  link,
});

const RANK: Record<Stage, number> = { needs: 0, working: 1, done: 2, quiet: 3 };

// The stream, in its order. An ask stands in for the thread that asked it; a thread that needs
// you some other way keeps its own row. What finished since you looked leads Done until it's read,
// and a read one from before today has already shown as its thread.
export function inboxEntries(
  tasks: TaskRow[],
  list: Pick<AskList, 'stuck' | 'fresh'> | undefined,
  asks: Ask[],
  now = new Date(),
): Entry[] {
  const today = startOfDay(now);
  const asked = new Set(asks.map((ask) => ask.task));
  const stageOf = (task: TaskRow): Stage => {
    if (task.state === 'needs' || task.state === 'working') return task.state;
    return task.state !== 'idle' && Date.parse(task.at) >= today ? 'done' : 'quiet';
  };
  const entries: Entry[] = [
    ...asks.map((ask): Entry => ({
      kind: 'ask',
      id: ask.id,
      topic: ask.topic,
      place: placeOf(ask.app),
      tiles: tilesOf(ask),
      stage: 'needs',
      at: ask.at,
      ask,
    })),
    ...tasks
      .filter((task) => task.state !== 'needs' || !asked.has(task.id))
      .map((task): Entry => ({
        kind: 'task',
        id: task.id,
        topic: task.name,
        place: placeOf(task.app),
        tiles: [threadTile(placeOf(task.app), task.link)],
        stage: stageOf(task),
        at: task.state === 'needs' ? task.since : task.at,
        task,
      })),
    ...(list?.stuck ?? []).map((stuck): Entry => ({
      kind: 'stuck',
      id: stuck.id,
      topic: STUCK,
      place: placeOf(stuck.app),
      tiles: [threadTile(placeOf(stuck.app))],
      stage: 'needs',
      at: stuck.at,
      stuck,
    })),
    ...(list?.fresh ?? [])
      .filter((fresh) => !fresh.read || Date.parse(fresh.at) >= today)
      .map((fresh): Entry => ({
        kind: 'fresh',
        id: fresh.id,
        topic: fresh.topic,
        place: placeOf(fresh.app),
        tiles: [threadTile(placeOf(fresh.app))],
        stage: 'done',
        at: fresh.at,
        fresh,
      })),
  ];
  const settled = (entry: Entry) => entry.stage === 'done' || entry.stage === 'quiet';
  const unread = (entry: Entry) => entry.kind === 'fresh' && !entry.fresh.read;
  return entries
    .map((entry, i) => ({ entry, i }))
    .sort(
      (a, b) =>
        RANK[a.entry.stage] - RANK[b.entry.stage] ||
        Number(unread(b.entry)) - Number(unread(a.entry)) ||
        (settled(a.entry) ? Date.parse(b.entry.at) - Date.parse(a.entry.at) : 0) ||
        a.i - b.i,
    )
    .map(({ entry }) => entry);
}

// The shown entries cut into their topics, in the stream's order. Each topic's marks and lanes
// come from all it has going, so a topic reads the same on every tab. Its marks put what needs
// you first; what just finished is news of a thread, not one, so it has none.
export function topicsOf(shown: Entry[], all: Entry[], tasks: TaskRow[]): Topic[] {
  const names = [...new Set(shown.map((entry) => entry.topic))];
  return names.map((name) => {
    const threads = new Map<string, Stage>();
    for (const entry of all) {
      const thread = entry.topic === name ? taskOf(entry) : undefined;
      if (!thread) continue;
      const before = threads.get(thread);
      if (!before || RANK[entry.stage] < RANK[before]) threads.set(thread, entry.stage);
    }
    return {
      name,
      entries: shown.filter((entry) => entry.topic === name),
      marks: [...threads.values()].sort((a, b) => RANK[a] - RANK[b]),
      tracks: [...threads.keys()].flatMap((id) => {
        const track = tasks.find((task) => task.id === id)?.track;
        return track?.length ? [track] : [];
      }),
    };
  });
}

// What each tab counts: asks you've answered here are already off your plate.
export function stageCounts(entries: Entry[], answered: Record<string, string | null> = {}) {
  const counts: Record<Stage, number> = { needs: 0, working: 0, done: 0, quiet: 0 };
  for (const entry of entries) if (!answered[entry.id]) counts[entry.stage]++;
  return counts;
}

// Search runs over every word a row shows, its topic and where it lives.
export function search(entries: Entry[], query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return entries;
  return entries.filter((entry) => {
    const text = [entry.topic, PLACES[entry.place], ...textOf(entry)].join(' ').toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

function textOf(entry: Entry) {
  switch (entry.kind) {
    case 'ask':
      return [entry.ask.question, entry.ask.context ?? ''];
    case 'task':
      return [entry.task.name, entry.task.place, entry.task.line];
    case 'stuck':
      return [entry.stuck.title, entry.stuck.why];
    case 'fresh':
      return [entry.fresh.title, entry.fresh.line];
  }
}

// The asks hex already has a pick for, to take in one go. Money stays a call you make one by one.
export function picksOf(entries: Entry[], answered: Record<string, string | null> = {}) {
  return entries.flatMap((entry) => {
    if (entry.kind !== 'ask' || answered[entry.id] || entry.ask.tag === 'money') return [];
    const option = entry.ask.options.find((one) => one.pick);
    return option ? [{ ask: entry.ask, option }] : [];
  });
}

// An ask's answers sit on one line only when every one fits in `width` points: their words at
// `size` (the list's 15 or a topic page's 17), hex's pick with its check, a gap and a rule between
// each. Measured at 15; the words, the check and the gaps all scale with the size.
const SIZE = 15;
const CHARACTER = 8.4;
const CHECK = 18;
const BETWEEN = 29;

export function fitsOneLine(options: AskOption[], width: number, size = SIZE) {
  const words = options.reduce(
    (sum, option) => sum + option.label.length * CHARACTER + (option.pick ? CHECK : 0),
    0,
  );
  return ((words + BETWEEN * (options.length - 1)) * size) / SIZE <= width;
}

// The task a row opens, when it has one.
export function taskOf(entry: Entry) {
  if (entry.kind === 'ask') return entry.ask.task;
  if (entry.kind === 'task') return entry.task.id;
  return undefined;
}
