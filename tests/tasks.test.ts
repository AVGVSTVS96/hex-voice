import assert from 'node:assert/strict';
import test from 'node:test';

import { createSessionAPI, createTasksAPI } from '../src/live/api-client';
import {
  agentCounts,
  agentMeta,
  agentSteps,
  agentsInOrder,
  agentWords,
  atWork,
  laneX,
  lastRun,
  stepMark,
  stepTimes,
  taskTime,
  type AgentTrail,
  type Task,
  type TaskRow,
  type TaskStep,
} from '../src/live/tasks';

const hexUrl = 'https://hex.example:8790';
const now = new Date(2026, 9, 13, 10, 0);
const at = (hours: number, minutes = 0, day = 13) =>
  new Date(2026, 9, day, hours, minutes).toISOString();
const row = (
  name: string,
  state: TaskRow['state'],
  when = at(9),
  extra: Partial<TaskRow> = {},
): TaskRow => ({
  id: `telegram:${name}`,
  app: 'telegram',
  name,
  place: name,
  state,
  running: state === 'working',
  line: `${name} line`,
  since: when,
  at: when,
  agents: [],
  track: [],
  ...extra,
});

test('a row says how long it has worked, or since when it waited or finished', () => {
  assert.equal(taskTime(row('voiceapp', 'working', at(9, 46)), now), '14 min');
  assert.equal(taskTime(row('Films', 'working', at(8, 0)), now), '2 hr');
  assert.match(taskTime(row('autofork', 'needs', at(8, 30)), now), /^8:30\sAM$/);
  assert.match(taskTime(row('Cloud', 'needs', at(9, 0, 11)), now), /Oct 11|11 Oct/);
});

test('a step without an end lasts until the next began, and a reply says when it was said', () => {
  const step = (minute: number, second: number, kind: TaskStep['kind'] = 'run'): TaskStep => ({
    at: new Date(2026, 9, 13, 9, minute, second).toISOString(),
    kind,
    text: 'step',
  });
  const steps = [step(59, 20), step(59, 12, 'think'), step(56, 12), step(55, 50)];
  assert.deepEqual(stepTimes(steps, now), ['', '8s', '3 min', '22s']);
  assert.deepEqual(stepTimes([], now), []);
  const instant = { at: second(59), end: second(59), kind: 'read', text: 'Read it' } as const;
  assert.deepEqual(stepTimes([steps[0]!, { ...steps[0]!, end: undefined }, instant], now), [
    '',
    '',
    '1s',
  ]);
  const said = stepTimes([step(59, 30, 'run'), step(20, 0, 'say')], now);
  assert.equal(said[0], '');
  assert.match(said[1]!, /^9:20\sAM$/);
});

test('tasks are asked for with the hex token, waiting on the version they last saw', async () => {
  const asked: string[] = [];
  const api = createTasksAPI({
    hexUrl,
    token: 'secret',
    fetch: async (url, init) => {
      asked.push(`${init?.method} ${url}`);
      assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer secret');
      if (String(url).endsWith('/talk')) return new Response(null, { status: 204 });
      if (String(url).includes('summary'))
        return Response.json({ version: 3, needs: 1, working: 2 });
      return Response.json({ version: 7, tasks: [row('autofork', 'needs')] });
    },
  });
  assert.equal((await api.list()).tasks[0].name, 'autofork');
  await api.list(7);
  assert.deepEqual(await api.counts(2), { version: 3, needs: 1, working: 2 });
  await api.talk('telegram:-100:908');
  assert.deepEqual(asked, [
    `GET ${hexUrl}/tasks`,
    `GET ${hexUrl}/tasks?after=7`,
    `GET ${hexUrl}/tasks/summary?after=2`,
    `POST ${hexUrl}/tasks/telegram%3A-100%3A908/talk`,
  ]);
});

test('a call started from a task tells hex which one', async () => {
  const api = createSessionAPI({
    hexUrl,
    fetch: async (_url, init) => {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        sdp: 'offer',
        voice: 'cedar',
        from: 'app',
        about: 'telegram:-100:908',
      });
      return Response.json({ session: { id: 'live_1' }, transport: { sdp: 'answer' } });
    },
  });
  await api.create('offer', 'cedar', 'telegram:-100:908');
});

test('a lane shows the last week on a log scale, now at the right edge', () => {
  const now = Date.parse(at(10));
  const hour = 3_600_000;
  const x = (age: number, width = 84) => laneX(now - age, now, width);
  assert.equal(x(0), 84);
  assert.equal(x(-hour), 84);
  assert.equal(x(7 * 24 * hour), 0);
  assert.equal(x(30 * 24 * hour), 0);
  assert.ok(Math.abs(x(hour, 1) - 0.5973) < 0.001);
  assert.ok(Math.abs(x(24 * hour, 1) - 0.228) < 0.001);
  assert.ok(Math.abs(x(60_000, 1) - 0.952) < 0.001);
  assert.ok(x(15 * 60_000) > x(hour) && x(hour) > x(24 * hour));
});

const second = (minute: number, seconds = 0, hour = 9) =>
  new Date(2026, 9, 13, hour, minute, seconds).toISOString();

// A thread that handed its research to agents, as hex sends it: two at work, one done, one
// stopped and run again, and one stopped for good.
const agent = (id: string, extra: Partial<AgentTrail>): AgentTrail => ({
  id,
  label: id,
  state: 'done',
  steps: [],
  ...extra,
});
const agents = [
  agent('t3:recipes-1', {
    label: 'recipes: what the pantry can make',
    state: 'stopped',
    who: 'Opus 5.5',
    since: second(10),
    end: second(20),
  }),
  agent('t3:prices', {
    label: 'prices: what a week of groceries costs',
    state: 'stopped',
    who: 'Opus 5.5',
    since: second(12),
    end: second(20),
  }),
  agent('t3:stores', {
    label: 'stores: which ones deliver',
    who: 'Opus 5.5',
    since: second(21),
    end: second(28, 20),
    result: 'Two deliver on Sundays: the co-op and the corner market.',
    steps: [
      {
        at: second(28),
        kind: 'say',
        text: 'Two deliver on Sundays: the co-op and the corner market.',
      },
      { at: second(25), end: second(26), kind: 'web', text: 'Searched the web', state: 'done' },
    ],
  }),
  agent('t3:recipes-2', {
    label: 'recipes: what the pantry can make',
    state: 'working',
    who: 'Opus 5.5',
    since: second(22),
    line: 'Reading pantry.json',
  }),
  agent('t3:review', {
    label: 'review: a second opinion',
    state: 'working',
    who: 'Sol',
    since: second(50),
  }),
];

test('a step takes as long as its result took to come back, and only a running step turns', () => {
  const steps: TaskStep[] = [
    { at: second(59, 50), kind: 'run', text: 'Run the tests', state: 'running' },
    { at: second(59, 0), end: second(59, 8), kind: 'search', text: 'Find the menu', state: 'done' },
    { at: second(56), end: second(58, 30), kind: 'run', text: 'Build it', state: 'failed' },
    { at: second(55), kind: 'agent', text: 'Handed off review', agent: 't3:review' },
    { at: second(50), kind: 'think', text: 'thinking' },
  ];
  assert.deepEqual(stepTimes(steps, now), ['10s', '8s', '3 min', '1 min', '5 min']);
  assert.deepEqual(steps.map(stepMark), ['working', undefined, 'failed', undefined, undefined]);
  assert.equal(stepTimes(steps, new Date(2026, 9, 13, 10, 3))[0], '3 min');
  assert.equal(stepMark(steps[4]!), undefined);
});

test('agents at work come first, newest started first, then the finished, and earlier tries apart', () => {
  const { shown, tries } = agentsInOrder(agents);
  assert.deepEqual(
    shown.map((one) => one.id),
    ['t3:review', 't3:recipes-2', 't3:stores', 't3:prices'],
  );
  assert.deepEqual(
    tries.map((one) => one.id),
    ['t3:recipes-1'],
  );
  assert.equal(agentCounts(shown), '2 working · 1 done · 1 stopped');
  assert.equal(agentCounts([]), '');
  const failed = agentsInOrder([agent('a', { state: 'failed', since: second(1) }), agent('a', {})]);
  assert.equal(failed.tries.length, 0);
});

test('an agent says who it is and how long it has worked or took, or that it stopped', () => {
  const [review, recipes, stores, prices] = agentsInOrder(agents).shown;
  assert.equal(agentMeta(review!, now), 'Sol · 10 min');
  assert.equal(agentMeta(recipes!, now), 'Opus 5.5 · 38 min');
  assert.equal(agentMeta(stores!, now), 'Opus 5.5 · 7 min');
  assert.equal(agentMeta({ ...stores!, end: second(21, 40) }, now), 'Opus 5.5 · 40s');
  assert.equal(agentMeta(prices!, now), 'Opus 5.5 · stopped');
  assert.equal(agentMeta({ ...review!, who: undefined, state: 'failed' }, now), 'failed');
  assert.equal(agentMeta(agent('old', { state: 'working' }), now), '');
});

test("an opened agent's steps leave out a last reply that only repeats its result", () => {
  const stores = agents[2]!;
  assert.deepEqual(
    agentSteps(stores).map((step) => step.text),
    ['Searched the web'],
  );
  assert.equal(agentSteps({ ...stores, result: 'Only the co-op delivers.' }).length, 2);
  assert.equal(agentSteps({ ...stores, result: undefined }).length, 2);
});

test('a thread names the agents still at work, and once done all it ran', () => {
  assert.equal(atWork(agents).length, 2);
  assert.equal(agentWords(agents, true), '2 agents working · review, recipes');
  assert.equal(
    agentWords([agent('x', { label: 'Explore the voice plugin', state: 'working' })], true),
    '1 agent working · Explore the voice plugin',
  );
  const done = agents.filter((one) => one.state !== 'working');
  assert.equal(agentWords(done, true), undefined);
  assert.equal(agentWords(done, false), '3 agents · stores, recipes, prices');
  assert.equal(agentWords([], false), undefined);
});

test("a thread that's done shows its last run while it has steps or agents", () => {
  const task = (extra: Partial<Task>): Task => ({
    ...row('Films', 'done'),
    lately: [],
    plan: [],
    steps: [],
    agents: [],
    ...extra,
  });
  assert.equal(lastRun(task({ steps: [{ at: at(9), kind: 'run', text: 'Build it' }] })), true);
  assert.equal(lastRun(task({ agents })), true);
  assert.equal(lastRun(task({})), false);
  assert.equal(lastRun(task({ state: 'working', agents })), false);
});
