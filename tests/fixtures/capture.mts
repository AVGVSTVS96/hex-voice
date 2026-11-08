// Real answers from hex's voice server, cut to a few of each and scrubbed of everything private, for
// tests/contract.test.ts. On the server: `EXPO_PUBLIC_HEX_TOKEN=… npx tsx tests/fixtures/capture.mts`.
// It only reads, and asks with `after=1` because a bare GET /asks starts a check.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
interface Item {
  [key: string]: Json;
}

const hex = process.env.HEX_URL ?? 'http://127.0.0.1:8790';
const records = join(homedir(), '.claude/channels/voice/calls');
const out = import.meta.dirname;

const read = async (path: string) => {
  const response = await fetch(`${hex}${path}${path.includes('?') ? '&' : '?'}after=1`, {
    headers: { Authorization: `Bearer ${process.env.EXPO_PUBLIC_HEX_TOKEN}` },
    signal: AbortSignal.timeout(900_000),
  });
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
  }
  return (await response.json()) as Item;
};

// The first item of each kind, then the next ones up to `most`.
const sample = (items: Json, kind: (item: Item) => string, most: number) => {
  const list = items as Item[];
  const firsts = list.filter((item, i) => list.findIndex((one) => kind(one) === kind(item)) === i);
  return [...firsts, ...list.filter((item) => !firsts.includes(item))].slice(
    0,
    Math.max(most, firsts.length),
  );
};
const field = (key: string) => (item: Item) => String(item[key]);

// Words become the name of their field, ids and links stand-ins that still match across files, and
// the values the app branches on stay as hex sent them.
const KEPT = new Set(['kind', 'state', 'from', 'end', 'who', 'app', 'via', 'mark', 'tag', 'voice']);
const IDS = new Set(['id', 'task', 'call', 'live', 'agent', 'claude', 'thread', 'key', 'ask']);
const TIME = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;
const fakes = new Map<string, string>();
const fake = (value: string, as: (n: number) => string) =>
  fakes.get(value) ?? fakes.set(value, as(fakes.size + 1)).get(value)!;

const scrub = (value: Json, key = ''): Json => {
  if (Array.isArray(value)) {
    return value.map((one) => scrub(one, key));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrub(v, k)]));
  }
  if (key === 'dollars') {
    return 0;
  }
  if (typeof value !== 'string' || KEPT.has(key) || TIME.test(value)) {
    return value;
  }
  if (IDS.has(key)) {
    return fake(value, (n) => `${key}-${n}`);
  }
  if (key === 'link' || key === 'url') {
    return fake(value, (n) => `https://example.com/${n}`);
  }
  return key || 'text';
};

const write = (name: string, value: Json) =>
  writeFileSync(join(out, `${name}.json`), `${JSON.stringify(scrub(value), null, 2)}\n`);

const calls = await read('/calls');
write('calls', { ...calls, calls: sample(calls.calls, (call) => `${call.from} ${call.end}`, 8) });

const record = (name: string) =>
  JSON.parse(readFileSync(join(records, `${name}.json`), 'utf-8')) as Item;
const kinds = (call: Item) => new Set(((call.moments ?? []) as Item[]).map(field('kind'))).size;
const all = readdirSync(records)
  .filter((name) => name.startsWith('live_'))
  .map((name) => record(name.slice(0, -5)));
const fullest = all.toSorted((a, b) => kinds(b) - kinds(a))[0]!;
write('call', {
  ...fullest,
  turns: (fullest.turns as Json[]).slice(0, 4),
  tasks: sample(fullest.tasks, field('state'), 4),
  moments: sample(
    all.flatMap((call) => (call.moments ?? []) as Json[]),
    field('kind'),
    0,
  ),
});

const tasks = await read('/tasks');
write('tasks', {
  ...tasks,
  tasks: sample(tasks.tasks, field('state'), 6).map((row) => ({
    ...row,
    agents: (row.agents as Json[]).slice(0, 2),
    track: (row.track as Json[]).slice(0, 3),
  })),
});
write('tasks-summary', await read('/tasks/summary'));

const working = (tasks.tasks as Item[]).find((row) => row.state === 'working') ?? tasks.tasks;
const id = encodeURIComponent(String((working as Item).id));
const task = await read(`/tasks/${id}`);
write('task', {
  ...task,
  steps: sample(task.steps, field('kind'), 0),
  agents: (task.agents as Item[])
    .slice(0, 2)
    .map((agent) => ({ ...agent, steps: (agent.steps as Json[]).slice(0, 2) })),
  lately: (task.lately as Json[]).slice(0, 2),
});
const chat = await read(`/tasks/${id}/chat`);
write('chat', { ...chat, turns: sample(chat.turns, field('from'), 4) });

const asks = await read('/asks');
const linked = (ask: Item) => (ask.links ? 'links' : '');
const called = (ask: Item) => ((ask.places as Item[]).some((place) => place.call) ? 'call' : '');
write('asks', {
  ...asks,
  asks: sample(asks.asks, (ask) => `${String(ask.kind)} ${linked(ask)} ${called(ask)}`, 6),
  stuck: sample(asks.stuck, field('mark'), 0),
  fresh: (asks.fresh as Json[]).slice(0, 2),
});
const check = await read('/asks/check');
write('check', {
  ...check,
  asks: (check.asks as Json[]).slice(0, 1),
  stuck: (check.stuck as Json[]).slice(0, 1),
  fixed: (check.fixed as Json[]).slice(0, 2),
  flagged: (check.flagged as Json[]).slice(0, 2),
});
write('activity', await read('/activity'));

// An ask whose thread has left the board opens that thread's page.
const left = (asks.asks as Item[]).find(
  (ask) => !(tasks.tasks as Item[]).some((row) => row.id === ask.task),
);
if (left) {
  const page = await read(`/tasks/${encodeURIComponent(String(left.task))}`);
  write('page', { ...page, asks: (page.asks as Json[]).slice(0, 1) });
}
