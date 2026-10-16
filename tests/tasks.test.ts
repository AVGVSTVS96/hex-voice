import assert from 'node:assert/strict';
import test from 'node:test';

import { createSessionAPI, createTasksAPI } from '../src/live/api-client';
import { stepTimes, taskTime, type TaskRow, type TaskStep } from '../src/live/tasks';

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

test('each step lasts until the next began, the newest while it works so far, and a reply says when it was said', () => {
  const step = (minute: number, second: number, kind: TaskStep['kind'] = 'run'): TaskStep => ({
    at: new Date(2026, 9, 13, 9, minute, second).toISOString(),
    kind,
    text: 'step',
  });
  const steps = [step(59, 20), step(59, 12, 'think'), step(56, 12), step(55, 50)];
  assert.deepEqual(stepTimes(steps, true, now), ['now', '8s', '3 min', '22s']);
  assert.deepEqual(stepTimes(steps, false, now), ['', '8s', '3 min', '22s']);
  assert.deepEqual(stepTimes([step(40, 0)], true, now), ['20 min']);
  assert.deepEqual(stepTimes([], true, now), []);
  const said = stepTimes([step(59, 30, 'run'), step(20, 0, 'say')], true, now);
  assert.equal(said[0], 'now');
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
