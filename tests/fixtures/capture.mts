import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import * as z from "zod";

const Json = z.json();

type Json = z.infer<typeof Json>;

const Item = z.record(z.string(), Json);

type Item = z.infer<typeof Item>;

const Items = z.array(Item);
const List = z.array(Json);
const Scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]).optional();

const hex = z.string().default("http://127.0.0.1:8790").parse(process.env.HEX_URL);
const token = z.string().optional().parse(process.env.EXPO_PUBLIC_HEX_TOKEN);
const records = path.join(homedir(), ".claude/channels/voice/calls");
const out = import.meta.dirname;

const readWithoutStartingACheck = async (route: string) => {
  const response = await fetch(`${hex}${route}${route.includes("?") ? "&" : "?"}after=1`, {
    headers: { Authorization: `Bearer ${String(token)}` },
    signal: AbortSignal.timeout(900_000),
  });

  if (!response.ok) {
    throw new Error(`${route}: HTTP ${response.status}`);
  }

  return Item.parse(await response.json());
};

const text = (value: Json | undefined) => String(Scalar.parse(value));

const firstOfEachKindThenUpTo = (items: Json, kind: (item: Item) => string, most: number) => {
  const list = Items.parse(items);
  const firsts = list.filter((item, i) => list.findIndex((one) => kind(one) === kind(item)) === i);

  return [...firsts, ...list.filter((item) => !firsts.includes(item))].slice(
    0,
    Math.max(most, firsts.length),
  );
};

const field = (key: string) => (item: Item) => text(item[key]);

const BRANCHED_ON = new Set([
  "kind",
  "state",
  "from",
  "end",
  "who",
  "app",
  "via",
  "mark",
  "tag",
  "voice",
]);

const IDS = new Set(["id", "task", "call", "live", "agent", "claude", "thread", "key", "ask"]);
const TIME = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/u;
const standIns = new Map<string, string>();

const fake = (value: string, as: (n: number) => string) => {
  const known = standIns.get(value);

  if (known !== undefined) {
    return known;
  }

  const made = as(standIns.size + 1);
  standIns.set(value, made);

  return made;
};

const scrub = (value: Json, key = ""): Json => {
  if (Array.isArray(value)) {
    return value.map((one) => scrub(one, key));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrub(v, k)]));
  }

  if (key === "dollars") {
    return 0;
  }

  if (typeof value !== "string" || BRANCHED_ON.has(key) || TIME.test(value)) {
    return value;
  }

  if (IDS.has(key)) {
    return fake(value, (n) => `${key}-${n}`);
  }

  if (key === "link" || key === "url") {
    return fake(value, (n) => `https://example.com/${n}`);
  }

  return key || "text";
};

const write = (name: string, value: Json) => {
  writeFileSync(path.join(out, `${name}.json`), `${JSON.stringify(scrub(value), null, 2)}\n`);
};

const calls = await readWithoutStartingACheck("/calls");

write("calls", {
  ...calls,
  calls: firstOfEachKindThenUpTo(calls.calls, (call) => `${text(call.from)} ${text(call.end)}`, 8),
});

const record = (name: string) =>
  Item.parse(JSON.parse(readFileSync(path.join(records, `${name}.json`), "utf-8")));

const kinds = (call: Item) => new Set(Items.parse(call.moments ?? []).map(field("kind"))).size;

const all = readdirSync(records)
  .filter((name) => name.startsWith("live_"))
  .map((name) => record(name.slice(0, -5)));

const [fullest] = all.toSorted((a, b) => kinds(b) - kinds(a));

if (fullest === undefined) {
  throw new Error(`${records} has no live_ call records`);
}

write("call", {
  ...fullest,
  turns: List.parse(fullest.turns).slice(0, 4),
  tasks: firstOfEachKindThenUpTo(fullest.tasks, field("state"), 4),
  moments: firstOfEachKindThenUpTo(
    all.flatMap((call) => List.parse(call.moments ?? [])),
    field("kind"),
    0,
  ),
});

const tasks = await readWithoutStartingACheck("/tasks");
const rows = Items.parse(tasks.tasks);

write("tasks", {
  ...tasks,
  tasks: firstOfEachKindThenUpTo(tasks.tasks, field("state"), 6).map((row) => ({
    ...row,
    agents: List.parse(row.agents).slice(0, 2),
    track: List.parse(row.track).slice(0, 3),
  })),
});

write("tasks-summary", await readWithoutStartingACheck("/tasks/summary"));

const working = rows.find((row) => row.state === "working");
const id = encodeURIComponent(text(working?.id));
const task = await readWithoutStartingACheck(`/tasks/${id}`);

write("task", {
  ...task,
  steps: firstOfEachKindThenUpTo(task.steps, field("kind"), 0),
  agents: Items.parse(task.agents)
    .slice(0, 2)
    .map((agent) => ({ ...agent, steps: List.parse(agent.steps).slice(0, 2) })),
  lately: List.parse(task.lately).slice(0, 2),
});

const chat = await readWithoutStartingACheck(`/tasks/${id}/chat`);

write("chat", { ...chat, turns: firstOfEachKindThenUpTo(chat.turns, field("from"), 4) });

const asks = await readWithoutStartingACheck("/asks");
const linked = (ask: Item) => (ask.links === undefined ? "" : "links");

const called = (ask: Item) =>
  Items.parse(ask.places).some((place) => place.call !== undefined) ? "call" : "";

write("asks", {
  ...asks,
  asks: firstOfEachKindThenUpTo(
    asks.asks,
    (ask) => `${text(ask.kind)} ${linked(ask)} ${called(ask)}`,
    6,
  ),
  stuck: firstOfEachKindThenUpTo(asks.stuck, field("mark"), 0),
  fresh: List.parse(asks.fresh).slice(0, 2),
});

const check = await readWithoutStartingACheck("/asks/check");

write("check", {
  ...check,
  asks: List.parse(check.asks).slice(0, 1),
  stuck: List.parse(check.stuck).slice(0, 1),
  fixed: List.parse(check.fixed).slice(0, 2),
  flagged: List.parse(check.flagged).slice(0, 2),
});

write("activity", await readWithoutStartingACheck("/activity"));

const askOffBoard = Items.parse(asks.asks).find((ask) => !rows.some((row) => row.id === ask.task));

if (askOffBoard !== undefined) {
  const page = await readWithoutStartingACheck(
    `/tasks/${encodeURIComponent(text(askOffBoard.task))}`,
  );

  write("page", { ...page, asks: List.parse(page.asks).slice(0, 1) });
}
