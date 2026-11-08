import { unreached } from './asks';
import type { Ask, AskList, Fresh, Stuck, Sent } from './asks';
import type { Finished, TaskId, TaskRow, Turn } from './tasks';

// Everything hex has going, as one stream sorted by what needs you now: your asks and whatever's
// stuck, then what's working, then what was done in the last day (each task hex closed, in whatever
// project), then the rest, quiet. Tasks shows it a stage at a time, or all of it.
export type Stage = 'needs' | 'working' | 'done' | 'quiet';
export type Tab = 'all' | Stage;
export type Place = 'telegram' | 't3' | 'buzz' | 'discord' | 'server';

// Where a row's item lives, as a tile beside it: a thread in its app, which opens there when it
// has a link, a call, which opens in Calls, or a page. `label` names its button in the row's swipe.
export type Tile =
  | { kind: 'app'; place: Place; label: string; link?: string }
  | { kind: 'call'; label: string; call: string }
  | { kind: 'link'; label: string; url: string };

interface Base {
  id: string;
  topic: string;
  place: Place;
  tiles: Tile[];
  stage: Stage;
  at: string;
}
export type Entry = Base &
  (
    | { kind: 'ask'; ask: Ask }
    | { kind: 'stuck'; stuck: Stuck }
    | { kind: 'task'; task: TaskRow }
    | { kind: 'fresh'; fresh: Fresh }
    | { kind: 'finished'; finished: Finished }
  );

// A topic in a stage: what it has there, one mark per thread it has anywhere, and each thread's
// last week for its lane.
export interface Topic {
  name: string;
  entries: Entry[];
  marks: Stage[];
}

export const TABS: { key: Tab; title: string }[] = [
  { key: 'all', title: 'All' },
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

export const placeOf = (app: string): Place =>
  app === 'telegram' || app === 't3' || app === 'buzz' || app === 'discord' ? app : 'server';

export const opens = (tile: Tile) => tile.kind !== 'app' || !!tile.link;
const kindOf = (tile: Tile) => (tile.kind === 'app' ? tile.place : tile.kind);

const TILES = 3;

// Where an ask was asked, as its row shows it: the places that open first, then the ones that
// can't, each newest first as hex sends them, and its first page last, three tiles at most. Each
// that opens is a button in the row's swipe, named by its app, or by its thread or call when two
// there share one.
export const tilesOf = (ask: Ask): Tile[] => {
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
};

const threadTile = (place: Place, link?: string): Tile => ({
  kind: 'app',
  place,
  label: PLACES[place],
  link,
});

const RANK: Record<Stage, number> = { needs: 0, working: 1, done: 2, quiet: 3 };
const DAY = 24 * 60 * 60_000;

// A link ends before the punctuation of the sentence it sits in. A proof can also name a Telegram
// message by hex's key for it, which in a group opens as that message.
const LINKS = /https?:\/\/[^\s)]*[^\s).,;:!?'"]|telegram:-100\d+:\d+/g;

// What a link is, in a word or two: a GitHub pull request or commit by its repo and number, a repo
// by its name, a Telegram message by its number, else its site.
export const linkName = (url: string) => {
  const github = /^https?:\/\/github\.com\/[^/]+\/([^/#?]+)(?:\/(pull|commit)\/(\w+))?/.exec(url);
  if (github?.[2]) {
    return `${github[1]} ${github[2] === 'pull' ? '#' : ''}${github[3].slice(0, 7)}`;
  }
  if (github) {
    return github[1];
  }
  const message = /^https:\/\/t\.me\/c\/\d+\/(\d+)$/.exec(url);
  if (message) {
    return `message ${message[1]}`;
  }
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/[:/].*$/, '');
};

const urlOf = (found: string) => {
  const key = /^telegram:-100(\d+):(\d+)$/.exec(found);
  return key ? `https://t.me/c/${key[1]}/${key[2]}` : found;
};

// A task's proof as its page reads it, each link by its name.
export const proofWords = (proof: string) =>
  proof.replaceAll(LINKS, (found) => linkName(urlOf(found))).trim();

// Whether a proof says anything besides its links.
export const proofSays = (proof: string) => /\w/.test(proof.replaceAll(LINKS, ''));

// Each page a proof links to, once: a Telegram message as Telegram's, any other as the web's.
export const proofLinks = (proof: string): Tile[] => {
  const urls = [...new Set((proof.match(LINKS) ?? []).map(urlOf))];
  return urls.map((url) =>
    url.startsWith('https://t.me/')
      ? { kind: 'app', place: 'telegram', label: linkName(url), link: url }
      : { kind: 'link', label: linkName(url), url },
  );
};

// The stream, in its order. An ask stands in for the thread that asked it, in that thread's topic
// while it's on the board, so a thread waiting on your ask is never also quiet; one still working
// keeps its row in Working, and a thread that needs you some other way keeps its own. Done is what
// was done, not who stopped: the tasks hex closed and the T3 threads that finished in the last day,
// newest first. A thread between runs is quiet, and so is a finished T3 thread you haven't read
// from before then.
export const inboxEntries = (
  tasks: TaskRow[],
  finished: Finished[],
  list: Pick<AskList, 'stuck' | 'fresh'> | undefined,
  asks: Ask[],
  now = new Date(),
): Entry[] => {
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
      .filter((task) => task.state === 'working' || !asked.has(task.id))
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
        tiles: [threadTile(placeOf(one.app), one.link), ...proofLinks(one.proof).slice(0, 1)],
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
};

// The shown entries cut into their topics, in the stream's order. Each topic's marks and lanes
// come from all it has going, so a topic reads the same on every tab. Its marks put what needs
// you first; what just finished is news of a thread, not one, so it has none.
export const topicsOf = (shown: Entry[], all: Entry[]): Topic[] => {
  const names = [...new Set(shown.map((entry) => entry.topic))];
  return names.map((name) => {
    const threads = new Map<string, Stage>();
    for (const entry of all) {
      const thread = entry.topic === name ? taskOf(entry) : undefined;
      if (!thread) {
        continue;
      }
      const before = threads.get(thread);
      if (!before || RANK[entry.stage] < RANK[before]) {
        threads.set(thread, entry.stage);
      }
    }
    return {
      name,
      entries: shown.filter((entry) => entry.topic === name),
      marks: [...threads.values()].sort((a, b) => RANK[a] - RANK[b]),
    };
  });
};

// The tab Tasks opens on when it isn't sent to one: Needs you while anything waits.
export const openingStage = (counts: Record<Stage, number>): Stage =>
  counts.needs ? 'needs' : 'working';

// What a tab shows: its stage's entries, or on All each project's from the first stage it's in, so
// a project's row there reads as it does on that stage's tab.
export const tabEntries = (entries: Entry[], tab: Tab) => {
  if (tab !== 'all') {
    return entries.filter((entry) => entry.stage === tab);
  }
  const first = new Map<string, Stage>();
  for (const entry of entries) {
    if (!first.has(entry.topic)) {
      first.set(entry.topic, entry.stage);
    }
  }
  return entries.filter((entry) => first.get(entry.topic) === entry.stage);
};

// A tab's rows: its projects, except Done, which lists each thing done on its own, newest first,
// whatever else its project has going.
export const stageTopics = (entries: Entry[], tab: Tab): Topic[] => {
  const shown = tabEntries(entries, tab);
  return tab === 'done'
    ? shown.flatMap((entry) => topicsOf([entry], entries))
    : topicsOf(shown, entries);
};

// What each tab counts: asks you've answered here are already off your plate.
export const stageCounts = (entries: Entry[], answered: Record<string, string | null> = {}) => {
  const counts: Record<Stage, number> = { needs: 0, working: 0, done: 0, quiet: 0 };
  for (const entry of entries) {
    if (!answered[entry.id]) {
      counts[entry.stage]++;
    }
  }
  return counts;
};

// Search runs over every word a row shows, its topic and where it lives.
const wordsOf = (query: string) => query.trim().toLowerCase().split(/\s+/).filter(Boolean);

export const search = (entries: Entry[], query: string) => {
  const words = wordsOf(query);
  if (!words.length) {
    return entries;
  }
  return entries.filter((entry) => {
    const text = [entry.topic, PLACES[entry.place], ...textOf(entry)].join(' ').toLowerCase();
    return words.every((word) => text.includes(word));
  });
};

// Why a search found an entry its row doesn't show the reason for: the stretch of its words
// around the first search word that neither its line nor its topic holds, with every search word
// in it marked. Nothing when the row already shows why.
export interface Part {
  text: string;
  hit: boolean;
}

export const whyOf = (entry: Entry, query: string): Part[] | undefined => {
  const words = wordsOf(query);
  const shown = `${entry.topic} ${headlineOf(entry)}`.toLowerCase();
  const hidden = words.find((word) => !shown.includes(word));
  if (!hidden) {
    return undefined;
  }
  const text =
    textOf(entry).find((one) => one.toLowerCase().includes(hidden)) ?? PLACES[entry.place];
  const at = text.toLowerCase().indexOf(hidden);
  if (at === -1) {
    return undefined;
  }
  const start = Math.max(0, text.lastIndexOf(' ', Math.max(0, at - WHY_BEFORE)) + 1);
  const end = Math.min(text.length, at + hidden.length + WHY_AFTER);
  const stretch = `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
  return marked(stretch, words);
};

const WHY_BEFORE = 30;
const WHY_AFTER = 80;

const marked = (text: string, words: string[]): Part[] => {
  const pattern = new RegExp(
    `(${words.map((word) => word.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi',
  );
  return text
    .split(pattern)
    .filter(Boolean)
    .map((piece) => ({ text: piece, hit: words.includes(piece.toLowerCase()) }));
};

// What an entry asks or says, in one line: the question, the stuck thing, what's new.
export const headlineOf = (entry: Entry) => {
  switch (entry.kind) {
    case 'ask': {
      return entry.ask.question;
    }
    case 'task': {
      return entry.task.line || entry.task.name;
    }
    case 'stuck': {
      return entry.stuck.title;
    }
    case 'fresh': {
      return entry.fresh.title;
    }
    case 'finished': {
      return entry.finished.title;
    }
  }
};

// A run that ended on the API's own error says what went wrong in words, not the raw message.
export const problemOf = (line: string) => {
  const error = /^API Error:\s*(.*)$/s.exec(line.trim());
  if (!error) {
    return;
  }
  return /limit/i.test(error[1] ?? '')
    ? 'Stopped: the server was limiting requests'
    : 'Stopped on an API error';
};

const textOf = (entry: Entry) => {
  switch (entry.kind) {
    case 'ask': {
      return [entry.ask.question, entry.ask.context ?? ''];
    }
    case 'task': {
      return [entry.task.name, entry.task.place, entry.task.line];
    }
    case 'stuck': {
      return [entry.stuck.title, entry.stuck.why];
    }
    case 'fresh': {
      return [entry.fresh.title, entry.fresh.line];
    }
    case 'finished': {
      return [entry.finished.title, proofWords(entry.finished.proof)];
    }
  }
};

// The asks hex already has a pick for, to take in one go. Money stays a call you make one by one.
export const picksOf = (entries: Entry[], answered: Record<string, string | null> = {}) =>
  entries.flatMap((entry) => {
    if (entry.kind !== 'ask' || answered[entry.id] || entry.ask.tag === 'money') {
      return [];
    }
    const option = entry.ask.options.find((one) => one.pick);
    return option ? [{ ask: entry.ask, option }] : [];
  });

// A page in Tasks: a thread's, a project's own when it has no thread to show, or a thing hex did.
const TOPIC = 'topic:';
const DONE = 'done:';
export type PageId = TaskId | `${typeof TOPIC}${string}` | `${typeof DONE}${string}`;
const isTopic = (page: PageId): page is `${typeof TOPIC}${string}` => page.startsWith(TOPIC);
const isDone = (page: PageId): page is `${typeof DONE}${string}` => page.startsWith(DONE);

// The page a row opens on: what hex did, for a row of Done; else its project's leading thread's,
// or, with none to show (what's stuck, a finished T3 thread), a page of its project's own rows.
export const pageOf = (topic: Topic): PageId => {
  const [lead] = topic.entries;
  if (topic.entries.length === 1 && lead?.kind === 'finished') {
    return `${DONE}${lead.id}`;
  }
  return topic.entries.map(taskOf).find(Boolean) ?? `${TOPIC}${topic.name}`;
};

export const topicIn = (page: PageId | null) =>
  page && isTopic(page) ? page.slice(TOPIC.length) : undefined;

export const taskIn = (page: PageId | null) =>
  page && !isTopic(page) && !isDone(page) ? page : null;

export const doneIn = (page: PageId | null) =>
  page && isDone(page) ? page.slice(DONE.length) : undefined;

// Each of a project's threads' last week, for its lane.
export const tracksOf = (name: string, tasks: TaskRow[]): Turn[][] =>
  tasks.flatMap((task) => (task.name === name && task.track?.length ? [task.track] : []));

// The thread a row is about and opens, when it has one on the board.
export const taskOf = (entry: Entry) => {
  if (entry.kind === 'ask') {
    return entry.ask.task;
  }
  if (entry.kind === 'task') {
    return entry.task.id;
  }
  if (entry.kind === 'finished') {
    return entry.finished.run;
  }
};

// What an answer reached, as hex recorded it, after "Sent Yes to hex": the buttons it cleared, only
// when it cleared some, and the places it couldn't reach. hex counts them without saying which, so
// they're named by the apps the ask was asked in only when it reached them all.
export const reachedBy = (ask: Ask, sent: Sent | undefined) => {
  if (!sent) {
    return '';
  }
  const apps = sent.missed
    ? []
    : [...new Set(ask.places.map((place) => placeOf(place.app)))]
        .filter((place) => place === 'telegram' || place === 'discord')
        .map((place) => PLACES[place]);
  const cleared = sent.settled
    ? ` and cleared its ${apps.length ? `${apps.join(' and ')} ` : ''}buttons`
    : '';
  return sent.missed ? `${cleared}. ${unreached(sent.missed)}` : cleared;
};
