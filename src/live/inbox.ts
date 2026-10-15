import type { Ask, AskList, Fresh, Stuck } from './asks';
import { startOfDay, type TaskRow } from './tasks';

// Everything hex has going, as one stream sorted by what needs you now: your asks and whatever's
// stuck, then what's working, then what finished today, then the rest, quiet.
export type Stage = 'needs' | 'working' | 'done' | 'quiet';
export type Grouping = 'state' | 'topic' | 'app';
export type Place = 'telegram' | 't3' | 'buzz' | 'discord' | 'server';

type Base = { id: string; topic: string; place: Place; stage: Stage; at: string };
export type Entry = Base &
  (
    | { kind: 'ask'; ask: Ask }
    | { kind: 'stuck'; stuck: Stuck }
    | { kind: 'task'; task: TaskRow }
    | { kind: 'fresh'; fresh: Fresh }
  );

export type Group = {
  key: string;
  title: string;
  place?: Place;
  topic?: string;
  live: Entry[];
  quiet: Entry[];
};

export type Topic = {
  name: string;
  needs: number;
  working: number;
  threads: number;
  at: string;
  places: Place[];
  marks: Stage[];
};

const STAGES: { key: Stage; title: string }[] = [
  { key: 'needs', title: 'Needs you' },
  { key: 'working', title: 'Working' },
  { key: 'done', title: 'Done' },
  { key: 'quiet', title: 'Quiet' },
];

export const GROUPINGS: { key: Grouping; title: string }[] = [
  { key: 'state', title: 'State' },
  { key: 'topic', title: 'Topic' },
  { key: 'app', title: 'App' },
];

// Where a thread lives, in the order App grouping lists them. Voice and loose Claude Code
// sessions live in no app, so they sit together on the server.
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
  const key = app.toLowerCase();
  return key === 'telegram' || key === 't3' || key === 'buzz' || key === 'discord' ? key : 'server';
}

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
      place: placeOf(ask.task.split(':')[0]),
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
        stage: stageOf(task),
        at: task.state === 'needs' ? task.since : task.at,
        task,
      })),
    ...(list?.stuck ?? []).map((stuck): Entry => ({
      kind: 'stuck',
      id: stuck.id,
      topic: STUCK,
      place: stuck.id.startsWith('t3-') ? 't3' : 'server',
      stage: 'needs',
      at: stuck.at,
      stuck,
    })),
    ...(list?.fresh ?? [])
      .filter((fresh) => !fresh.read || Date.parse(fresh.at) >= today)
      .map((fresh): Entry => {
        const [app, topic] = fresh.where.split(' · ');
        return {
          kind: 'fresh',
          id: fresh.id,
          topic: topic ?? fresh.title,
          place: placeOf(app),
          stage: 'done',
          at: fresh.at,
          fresh,
        };
      }),
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

// The stream cut three ways. By state: one group per stage. By topic: each topic with something
// going, its quiet threads folded under it, then every quiet topic folded together. By app: one
// group per place, each with its quiet folded.
export function groupEntries(entries: Entry[], by: Grouping): Group[] {
  const quiet = (entry: Entry) => entry.stage === 'quiet';
  if (by === 'state')
    return STAGES.map(({ key, title }) => {
      const these = entries.filter((entry) => entry.stage === key);
      return {
        key,
        title,
        live: key === 'quiet' ? [] : these,
        quiet: key === 'quiet' ? these : [],
      };
    }).filter((group) => group.live.length || group.quiet.length);
  const keyOf = (entry: Entry) => (by === 'topic' ? entry.topic : entry.place);
  const keys = [...new Set(entries.map(keyOf))];
  const groups = keys.map((key): Group => {
    const these = entries.filter((entry) => keyOf(entry) === key);
    return {
      key,
      title: by === 'topic' ? key : PLACES[key as Place],
      ...(by === 'topic' ? { topic: key } : { place: key as Place }),
      live: these.filter((entry) => !quiet(entry)),
      quiet: these.filter(quiet),
    };
  });
  if (by === 'app')
    return (Object.keys(PLACES) as Place[])
      .map((place) => groups.find((group) => group.key === place))
      .filter((group) => !!group);
  const active = groups.filter((group) => group.live.length);
  const resting = groups.filter((group) => !group.live.length).flatMap((group) => group.quiet);
  return resting.length
    ? [...active, { key: 'quiet', title: 'Quiet', live: [], quiet: resting }]
    : active;
}

// The topic chips: whatever needs you most first, then what's working, then the most recent. Each
// thread in a topic gets one mark, for the most pressing stage it's in. What just finished is news
// of a thread, not one, so it only says where a topic lives when nothing else does.
export function topicsOf(entries: Entry[]): Topic[] {
  type Tally = Topic & { seen: Map<string, Stage>; heard: Place[] };
  const topics = new Map<string, Tally>();
  for (const entry of entries) {
    if (entry.topic === STUCK) continue;
    const topic: Tally = topics.get(entry.topic) ?? {
      name: entry.topic,
      needs: 0,
      working: 0,
      threads: 0,
      at: entry.at,
      places: [],
      marks: [],
      seen: new Map(),
      heard: [],
    };
    topics.set(entry.topic, topic);
    if (Date.parse(entry.at) > Date.parse(topic.at)) topic.at = entry.at;
    const thread = taskOf(entry);
    if (!thread) {
      if (!topic.heard.includes(entry.place)) topic.heard.push(entry.place);
      continue;
    }
    if (entry.stage === 'needs') topic.needs++;
    if (entry.stage === 'working') topic.working++;
    if (!topic.places.includes(entry.place)) topic.places.push(entry.place);
    const before = topic.seen.get(thread);
    if (!before || RANK[entry.stage] < RANK[before]) topic.seen.set(thread, entry.stage);
  }
  return [...topics.values()]
    .map(({ seen, heard, ...topic }) => ({
      ...topic,
      threads: seen.size,
      places: topic.places.length ? topic.places : heard,
      marks: [...seen.values()].sort((a, b) => RANK[a] - RANK[b]),
    }))
    .sort(
      (a, b) => b.needs - a.needs || b.working - a.working || Date.parse(b.at) - Date.parse(a.at),
    );
}

// What the header counts: asks you've answered here are already off your plate.
export function stageCounts(entries: Entry[], answered: Record<string, string | null> = {}) {
  const counts: Record<Stage, number> = { needs: 0, working: 0, done: 0, quiet: 0 };
  for (const entry of entries) if (!answered[entry.id]) counts[entry.stage]++;
  return counts;
}

// "7 need you · 4 working · 4 done · 24 quiet", leaving out what's at zero.
export function countsLine(counts: Record<Stage, number>) {
  const parts = [
    counts.needs && `${counts.needs} need${counts.needs === 1 ? 's' : ''} you`,
    counts.working && `${counts.working} working`,
    counts.done && `${counts.done} done`,
    counts.quiet && `${counts.quiet} quiet`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Nothing yet';
}

// A topic under its own name: "4 threads · T3 Code, Telegram".
export function topicLine(topic: Topic) {
  const places = topic.places.map((place) => PLACES[place]).join(', ');
  if (!topic.threads) return places;
  return `${topic.threads} thread${topic.threads === 1 ? '' : 's'} · ${places}`;
}

// Folded quiet threads read as their topics, most recent first: "x, jev, Leisure and 15 more".
// Under a topic's own head they read as the apps they live in instead.
export function quietLine(entries: Entry[], by: 'topic' | 'place' = 'topic', shown = 6) {
  const names = [
    ...new Set(entries.map((entry) => (by === 'topic' ? entry.topic : PLACES[entry.place]))),
  ];
  if (names.length <= shown) return names.join(', ');
  return `${names.slice(0, shown).join(', ')} and ${names.length - shown} more`;
}

// Search runs over every word a row shows, and its topic.
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
      return [entry.task.name, entry.task.where, entry.task.line];
    case 'stuck':
      return [entry.stuck.title, entry.stuck.why];
    case 'fresh':
      return [entry.fresh.title, entry.fresh.line];
  }
}

// The asks hex already has a pick for, to take in one go. Money stays a call you make one by one,
// and a pick that opens a page isn't an answer.
export function picksOf(entries: Entry[], answered: Record<string, string | null> = {}) {
  return entries.flatMap((entry) => {
    if (entry.kind !== 'ask' || answered[entry.id] || entry.ask.tag === 'money') return [];
    const option = entry.ask.options.find((one) => one.pick && !one.url);
    return option ? [{ ask: entry.ask, option }] : [];
  });
}

// How long an ask has waited, as a short bar: a day fills half of it, and past a day it's late.
export function waited(at: string, now = new Date()) {
  const hours = Math.max(0, (now.getTime() - Date.parse(at)) / 3_600_000);
  return { fill: Math.min(1, hours / 48), late: hours > 24 };
}

// The task a row opens, when it has one.
export function taskOf(entry: Entry) {
  if (entry.kind === 'ask') return entry.ask.task;
  if (entry.kind === 'task') return entry.task.id;
  return undefined;
}
