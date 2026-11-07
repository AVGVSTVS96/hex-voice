import {
  unreached,
  type Ask,
  type AskList,
  type AskOption,
  type Fresh,
  type Stuck,
  type Sent,
} from './asks';
import { type Finished, type TaskId, type TaskRow, type Turn } from './tasks';

// Everything hex has going, as one stream sorted by what needs you now: your asks and whatever's
// stuck, then what's working, then what was done in the last day (each task hex closed, in whatever
// project), then the rest, quiet. Tasks shows it a stage at a time.
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
    | { kind: 'finished'; finished: Finished }
  );

export type FinishedEntry = Extract<Entry, { kind: 'finished' }>;

// What hex finished in a project in the last day, newest first.
export const finishedIn = (entries: Entry[], topic: string) =>
  entries.filter(
    (entry): entry is FinishedEntry => entry.kind === 'finished' && entry.topic === topic,
  );

// A topic in a stage: what it has there and how many of those count.
export type Topic = { name: string; entries: Entry[]; count: number };

// The asks answered here, folded where they sat until the sheet closes. They're off your plate, so
// no count holds them: a stage's tab is the sum of its projects' counts.
type Answered = Record<string, string | null>;
const counts = (entry: Entry, answered: Answered) => !answered[entry.id];

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
const DAY = 24 * 60 * 60_000;

const LINKS = /https?:\/\/[^\s)]+/g;

// What a link is, in a word or two: a GitHub pull request or commit by its repo and number, a repo
// by its name, else its site.
export function linkName(url: string) {
  const github = url.match(/^https?:\/\/github\.com\/[^/]+\/([^/#?]+)(?:\/(pull|commit)\/(\w+))?/);
  if (github?.[2])
    return `${github[1]} ${github[2] === 'pull' ? '#' : ''}${github[3]!.slice(0, 7)}`;
  if (github) return github[1]!;
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/[:/].*$/, '');
}

// A task's proof as its row reads it, each link by its name.
export const proofWords = (proof: string) => proof.replace(LINKS, linkName).trim();

const proofTile = (proof: string): Tile[] => {
  const [url] = proof.match(LINKS) ?? [];
  return url ? [{ kind: 'link', label: linkName(url), url }] : [];
};

// The stream, in its order. An ask stands in for the thread that asked it, in that thread's topic
// while it's on the board; a thread that needs you some other way keeps its own row. Done is what
// was done, not who stopped: the tasks hex closed and the T3 threads that finished in the last day,
// newest first. A thread between runs is quiet, and so is a finished T3 thread you haven't read
// from before then.
export function inboxEntries(
  tasks: TaskRow[],
  finished: Finished[],
  list: Pick<AskList, 'stuck' | 'fresh'> | undefined,
  asks: Ask[],
  now = new Date(),
): Entry[] {
  const since = now.getTime() - DAY;
  const asked = new Set(asks.map((ask) => ask.task));
  const names = new Map(tasks.map((task) => [task.id, task.name]));
  const entries: Entry[] = [
    ...asks.map((ask): Entry => ({
      kind: 'ask',
      id: ask.id,
      topic: names.get(ask.task) ?? ask.topic,
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
        stage: task.state === 'needs' || task.state === 'working' ? task.state : 'quiet',
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
      .filter((fresh) => !fresh.read || Date.parse(fresh.at) >= since)
      .map((fresh): Entry => ({
        kind: 'fresh',
        id: fresh.id,
        topic: fresh.topic,
        place: placeOf(fresh.app),
        tiles: [threadTile(placeOf(fresh.app))],
        stage: Date.parse(fresh.at) >= since ? 'done' : 'quiet',
        at: fresh.at,
        fresh,
      })),
    ...finished
      .filter((one) => Date.parse(one.at) >= since)
      .map((one): Entry => ({
        kind: 'finished',
        id: one.id,
        topic: one.topic,
        place: placeOf(one.app),
        tiles: [threadTile(placeOf(one.app), one.link), ...proofTile(one.proof)],
        stage: 'done',
        at: one.at,
        finished: one,
      })),
  ];
  const settled = (entry: Entry) => entry.stage === 'done' || entry.stage === 'quiet';
  return entries
    .map((entry, i) => ({ entry, i }))
    .sort(
      (a, b) =>
        RANK[a.entry.stage] - RANK[b.entry.stage] ||
        (settled(a.entry) ? Date.parse(b.entry.at) - Date.parse(a.entry.at) : 0) ||
        a.i - b.i,
    )
    .map(({ entry }) => entry);
}

// The shown entries cut into their topics, in the stream's order.
export function topicsOf(shown: Entry[], answered: Answered = {}): Topic[] {
  const names = [...new Set(shown.map((entry) => entry.topic))];
  return names.map((name) => {
    const entries = shown.filter((entry) => entry.topic === name);
    return { name, entries, count: entries.filter((entry) => counts(entry, answered)).length };
  });
}

// What each tab counts.
export function stageCounts(entries: Entry[], answered: Answered = {}) {
  const tabs: Record<Stage, number> = { needs: 0, working: 0, done: 0, quiet: 0 };
  for (const entry of entries) if (counts(entry, answered)) tabs[entry.stage]++;
  return tabs;
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

// What an entry asks or says, in one line: the question, the stuck thing, what's new.
export function headlineOf(entry: Entry) {
  switch (entry.kind) {
    case 'ask':
      return entry.ask.question;
    case 'task':
      return entry.task.line || entry.task.name;
    case 'stuck':
      return entry.stuck.title;
    case 'fresh':
      return entry.fresh.title;
    case 'finished':
      return entry.finished.title;
  }
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
    case 'finished':
      return [entry.finished.title, proofWords(entry.finished.proof)];
  }
}

// The asks hex already has a pick for, to take in one go. Money stays a call you make one by one.
export function picksOf(asks: Ask[], answered: Answered = {}) {
  return asks.flatMap((ask) => {
    if (answered[ask.id] || ask.tag === 'money') return [];
    const option = ask.options.find((one) => one.pick);
    return option ? [{ ask, option }] : [];
  });
}

export type HexPick = ReturnType<typeof picksOf>[number];

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

// A page in Tasks: a thread's, or a project's own when it has no thread to show.
const TOPIC = 'topic:';
export type PageId = TaskId | `${typeof TOPIC}${string}`;
const isTopic = (page: PageId): page is `${typeof TOPIC}${string}` => page.startsWith(TOPIC);

// The page a project opens on: its leading thread's, or, with none to show (what's stuck, what
// finished), a page of its own rows.
export function pageOf(topic: Topic): PageId {
  return topic.entries.map(taskOf).find(Boolean) ?? `${TOPIC}${topic.name}`;
}

export function topicIn(page: PageId | null) {
  return page && isTopic(page) ? page.slice(TOPIC.length) : undefined;
}

export function taskIn(page: PageId | null) {
  return page && !isTopic(page) ? page : null;
}

// Each of a project's threads' last week, for its lane.
export function tracksOf(name: string, tasks: TaskRow[]): Turn[][] {
  return tasks.flatMap((task) => (task.name === name && task.track?.length ? [task.track] : []));
}

// The thread a row is about and opens, when it has one on the board.
export function taskOf(entry: Entry) {
  if (entry.kind === 'ask') return entry.ask.task;
  if (entry.kind === 'task') return entry.task.id;
  if (entry.kind === 'finished') return entry.finished.run;
  return undefined;
}

// What an answer reached, as hex recorded it, after "Sent Yes to hex": the buttons it cleared, only
// when it cleared some, and the places it couldn't reach. hex counts them without saying which, so
// they're named by the apps the ask was asked in only when it reached them all.
export function reachedBy(ask: Ask, sent: Sent | undefined) {
  if (!sent) return '';
  const apps = sent.missed
    ? []
    : [...new Set(ask.places.map((place) => placeOf(place.app)))]
        .filter((place) => place === 'telegram' || place === 'discord')
        .map((place) => PLACES[place]);
  const cleared = sent.settled
    ? ` and cleared its ${apps.length ? `${apps.join(' and ')} ` : ''}buttons`
    : '';
  return sent.missed ? `${cleared}. ${unreached(sent.missed)}` : cleared;
}
