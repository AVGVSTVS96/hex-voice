import { isAnswered, unreached } from "./asks";
import type { Ask, AskList, Fresh, Stuck, Sent } from "./asks";
import type { Finished, TaskId, TaskRow, Turn } from "./tasks";

export type Stage = "needs" | "working" | "done" | "quiet";

export type Tab = "all" | Stage;

export type Place = "telegram" | "t3" | "buzz" | "discord" | "server";

export type Tile =
  | { kind: "app"; place: Place; label: string; link?: string | undefined }
  | { kind: "call"; label: string; call: string }
  | { kind: "link"; label: string; url: string };

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
    | { kind: "ask"; ask: Ask }
    | { kind: "stuck"; stuck: Stuck }
    | { kind: "task"; task: TaskRow }
    | { kind: "fresh"; fresh: Fresh }
    | { kind: "finished"; finished: Finished }
  );

export interface Topic {
  name: string;
  entries: Entry[];
  marks: Stage[];
}

export const TABS: { key: Tab; title: string }[] = [
  { key: "all", title: "All" },
  { key: "needs", title: "Needs you" },
  { key: "working", title: "Working" },
  { key: "done", title: "Done" },
  { key: "quiet", title: "Quiet" },
];

export const PLACES: Record<Place, string> = {
  telegram: "Telegram",
  t3: "T3 Code",
  buzz: "Buzz",
  discord: "Discord",
  server: "On the server",
};

export const STUCK = "Stuck";

export const placeOf = (app: string): Place =>
  app === "telegram" || app === "t3" || app === "buzz" || app === "discord" ? app : "server";

export const opens = (tile: Tile) => tile.kind !== "app" || (tile.link ?? "") !== "";
const kindOf = (tile: Tile) => (tile.kind === "app" ? tile.place : tile.kind);

const TILES = 3;

export const tilesOf = (ask: Ask): Tile[] => {
  const places = ask.places.map((one): Tile =>
    one.app === "voice" && one.call
      ? { kind: "call", label: one.place, call: one.call }
      : { kind: "app", place: placeOf(one.app), label: one.place, link: one.link },
  );

  const page = ask.links?.at(0);

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
        : { ...tile, label: tile.kind === "app" ? PLACES[tile.place] : "Call" },
    ),
    ...(page ? [{ kind: "link" as const, ...page }] : []),
  ];
};

const threadTile = (place: Place, link?: string): Tile => ({
  kind: "app",
  place,
  label: PLACES[place],
  link,
});

const RANK: Record<Stage, number> = { needs: 0, working: 1, done: 2, quiet: 3 };
const DAY = 24 * 60 * 60_000;

const LINKS = /https?:\/\/[^\s)]*[^\s).,;:!?'"]|telegram:-100\d+:\d+/gu;

export const linkName = (url: string) => {
  const { repo, kind, ref } =
    /^https?:\/\/github\.com\/[^/]+\/(?<repo>[^/#?]+)(?:\/(?<kind>pull|commit)\/(?<ref>\w+))?/u.exec(
      url,
    )?.groups ?? {};

  if (repo !== undefined) {
    return ref === undefined ? repo : `${repo} ${kind === "pull" ? "#" : ""}${ref.slice(0, 7)}`;
  }

  const message = /^https:\/\/t\.me\/c\/\d+\/(?<number>\d+)$/u.exec(url)?.groups;

  if (message) {
    return `message ${message.number}`;
  }

  return url.replace(/^https?:\/\/(?:www\.)?/u, "").replace(/[:/].*$/u, "");
};

const urlOf = (found: string) => {
  const key = /^telegram:-100(?<chat>\d+):(?<message>\d+)$/u.exec(found)?.groups;

  return key ? `https://t.me/c/${key.chat}/${key.message}` : found;
};

export const proofWords = (proof: string) =>
  proof.replaceAll(LINKS, (found) => linkName(urlOf(found))).trim();

export const proofSays = (proof: string) => /\w/u.test(proof.replaceAll(LINKS, ""));

export const proofLinks = (proof: string): Tile[] => {
  const urls = [...new Set((proof.match(LINKS) ?? []).map(urlOf))];

  return urls.map((url) =>
    url.startsWith("https://t.me/")
      ? { kind: "app", place: "telegram", label: linkName(url), link: url }
      : { kind: "link", label: linkName(url), url },
  );
};

export const inboxEntries = (
  tasks: TaskRow[],
  finished: Finished[],
  list: Pick<AskList, "stuck" | "fresh"> | undefined,
  asks: Ask[],
  now = new Date(),
): Entry[] => {
  const since = now.getTime() - DAY;
  const asked = new Set(asks.map((ask) => ask.task));
  const names = new Map(tasks.map((task) => [task.id, task.name]));

  const entries: Entry[] = [
    ...asks.map((ask): Entry => ({
      kind: "ask",
      id: ask.id,
      topic: names.get(ask.task) ?? ask.topic,
      place: placeOf(ask.app),
      tiles: tilesOf(ask),
      stage: "needs",
      at: ask.at,
      ask,
    })),
    ...tasks.flatMap((task): Entry[] =>
      task.state === "working" || !asked.has(task.id)
        ? [
            {
              kind: "task",
              id: task.id,
              topic: task.name,
              place: placeOf(task.app),
              tiles: [threadTile(placeOf(task.app), task.link)],
              stage: task.state === "needs" || task.state === "working" ? task.state : "quiet",
              at: task.state === "needs" ? task.since : task.at,
              task,
            },
          ]
        : [],
    ),
    ...(list?.stuck ?? []).map((stuck): Entry => ({
      kind: "stuck",
      id: stuck.id,
      topic: STUCK,
      place: placeOf(stuck.app),
      tiles: [threadTile(placeOf(stuck.app))],
      stage: "needs",
      at: stuck.at,
      stuck,
    })),
    ...(list?.fresh ?? [])
      .filter((fresh) => !fresh.read || Date.parse(fresh.at) >= since)
      .map((fresh): Entry => ({
        kind: "fresh",
        id: fresh.id,
        topic: fresh.topic,
        place: placeOf(fresh.app),
        tiles: [threadTile(placeOf(fresh.app))],
        stage: Date.parse(fresh.at) >= since ? "done" : "quiet",
        at: fresh.at,
        fresh,
      })),
    ...finished.flatMap((one): Entry[] =>
      Date.parse(one.at) >= since
        ? [
            {
              kind: "finished",
              id: one.id,
              topic: one.topic,
              place: placeOf(one.app),
              tiles: [threadTile(placeOf(one.app), one.link), ...proofLinks(one.proof).slice(0, 1)],
              stage: "done",
              at: one.at,
              finished: one,
            },
          ]
        : [],
    ),
  ];

  const settled = (entry: Entry) => entry.stage === "done" || entry.stage === "quiet";

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

export const openingStage = (counts: Record<Stage, number>): Stage =>
  counts.needs ? "needs" : "working";

export const tabEntries = (entries: Entry[], tab: Tab) => {
  if (tab !== "all") {
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

export const stageTopics = (entries: Entry[], tab: Tab): Topic[] => {
  const shown = tabEntries(entries, tab);

  return tab === "done"
    ? shown.flatMap((entry) => topicsOf([entry], entries))
    : topicsOf(shown, entries);
};

export const stageCounts = (entries: Entry[], answered: Record<string, string | null> = {}) => {
  const counts: Record<Stage, number> = { needs: 0, working: 0, done: 0, quiet: 0 };

  for (const entry of entries) {
    if (!isAnswered(answered, entry.id)) {
      counts[entry.stage] += 1;
    }
  }

  return counts;
};

const wordsOf = (query: string) => query.trim().toLowerCase().split(/\s+/u).filter(Boolean);

export const search = (entries: Entry[], query: string) => {
  const words = wordsOf(query);

  if (!words.length) {
    return entries;
  }

  return entries.filter((entry) => {
    const text = [entry.topic, PLACES[entry.place], ...textOf(entry)].join(" ").toLowerCase();

    return words.every((word) => text.includes(word));
  });
};

export interface Part {
  text: string;
  hit: boolean;
}

export const whyOf = (entry: Entry, query: string): Part[] | undefined => {
  const words = wordsOf(query);
  const shown = `${entry.topic} ${headlineOf(entry)}`.toLowerCase();
  const hidden = words.find((word) => !shown.includes(word));

  if (hidden === undefined) {
    return undefined;
  }

  const text =
    textOf(entry).find((one) => one.toLowerCase().includes(hidden)) ?? PLACES[entry.place];

  const at = text.toLowerCase().indexOf(hidden);

  if (at === -1) {
    return undefined;
  }

  const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, at - WHY_BEFORE)) + 1);
  const end = Math.min(text.length, at + hidden.length + WHY_AFTER);
  const stretch = `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;

  return marked(stretch, words);
};

const WHY_BEFORE = 30;
const WHY_AFTER = 80;

const marked = (text: string, words: string[]): Part[] => {
  const pattern = new RegExp(
    `(${words.map((word) => word.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|")})`,
    "giu",
  );

  return text
    .split(pattern)
    .filter(Boolean)
    .map((piece) => ({ text: piece, hit: words.includes(piece.toLowerCase()) }));
};

export const headlineOf = (entry: Entry) => {
  switch (entry.kind) {
    case "ask": {
      return entry.ask.question;
    }

    case "task": {
      return entry.task.line || entry.task.name;
    }

    case "stuck": {
      return entry.stuck.title;
    }

    case "fresh": {
      return entry.fresh.title;
    }

    case "finished": {
      return entry.finished.title;
    }
  }
};

export const problemOf = (line: string): string | undefined => {
  const message = /^API Error:\s*(?<message>.*)$/su.exec(line.trim())?.groups?.message;

  if (message === undefined) {
    return undefined;
  }

  return /limit/iu.test(message)
    ? "Stopped: the server was limiting requests"
    : "Stopped on an API error";
};

const textOf = (entry: Entry) => {
  switch (entry.kind) {
    case "ask": {
      return [entry.ask.question, entry.ask.context ?? ""];
    }

    case "task": {
      return [entry.task.name, entry.task.place, entry.task.line];
    }

    case "stuck": {
      return [entry.stuck.title, entry.stuck.why];
    }

    case "fresh": {
      return [entry.fresh.title, entry.fresh.line];
    }

    case "finished": {
      return [entry.finished.title, proofWords(entry.finished.proof)];
    }
  }
};

export const picksOf = (entries: Entry[], answered: Record<string, string | null> = {}) =>
  entries.flatMap((entry) => {
    if (entry.kind !== "ask" || isAnswered(answered, entry.id) || entry.ask.tag === "money") {
      return [];
    }

    const option = entry.ask.options.find((one) => one.pick === true);

    return option ? [{ ask: entry.ask, option }] : [];
  });

const TOPIC = "topic:";
const DONE = "done:";

export type PageId = TaskId | `${typeof TOPIC}${string}` | `${typeof DONE}${string}`;

const isTopic = (page: PageId): page is `${typeof TOPIC}${string}` => page.startsWith(TOPIC);
const isDone = (page: PageId): page is `${typeof DONE}${string}` => page.startsWith(DONE);

export const pageOf = (topic: Topic): PageId => {
  const [lead] = topic.entries;

  if (topic.entries.length === 1 && lead?.kind === "finished") {
    return `${DONE}${lead.id}`;
  }

  return topic.entries.map(taskOf).find(Boolean) ?? `${TOPIC}${topic.name}`;
};

export const topicIn = (page: PageId | null) =>
  page !== null && isTopic(page) ? page.slice(TOPIC.length) : undefined;

export const taskIn = (page: PageId | null) =>
  page !== null && page !== "" && !isTopic(page) && !isDone(page) ? page : null;

export const doneIn = (page: PageId | null) =>
  page !== null && isDone(page) ? page.slice(DONE.length) : undefined;

export const tracksOf = (name: string, tasks: TaskRow[]): Turn[][] =>
  tasks.flatMap((task) => (task.name === name && task.track?.length ? [task.track] : []));

export const taskOf = (entry: Entry): TaskId | undefined => {
  if (entry.kind === "ask") {
    return entry.ask.task;
  }

  if (entry.kind === "task") {
    return entry.task.id;
  }

  if (entry.kind === "finished") {
    return entry.finished.run;
  }

  return undefined;
};

export const reachedBy = (ask: Ask, sent: Sent | undefined) => {
  if (!sent) {
    return "";
  }

  const apps = sent.missed
    ? []
    : [...new Set(ask.places.map((place) => placeOf(place.app)))].flatMap((place) =>
        place === "telegram" || place === "discord" ? [PLACES[place]] : [],
      );

  const cleared = sent.settled
    ? ` and cleared its ${apps.length ? `${apps.join(" and ")} ` : ""}buttons`
    : "";

  return sent.missed ? `${cleared}. ${unreached(sent.missed)}` : cleared;
};
