import assert from 'node:assert/strict';
import test from 'node:test';

import { createSessionAPI, createTasksAPI } from '../src/live/api-client';
import { activityOf, taskTime, type Task, type TaskRow } from '../src/live/tasks';

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
  where: 'Telegram',
  state,
  line: `${name} line`,
  since: when,
  at: when,
  agents: [],
  ...extra,
});

test('a row says how long it has worked, or since when it waited or finished', () => {
  assert.equal(taskTime(row('voiceapp', 'working', at(9, 46)), now), '14 min');
  assert.equal(taskTime(row('Films', 'working', at(8, 0)), now), '2 hr');
  assert.match(taskTime(row('autofork', 'needs', at(8, 30)), now), /^8:30\sAM$/);
  assert.match(taskTime(row('Cloud', 'needs', at(9, 0, 11)), now), /Oct 11|11 Oct/);
});

test("a task's activity is its own session's steps, or one of its agents', marked by whether it still works", () => {
  const steps = (...texts: string[]) => texts.map((text, i) => ({ at: at(9, 59 - i), text }));
  const task: Task = {
    ...row('voiceapp', 'working'),
    steps: steps('Editing tasks-sheet.tsx', 'Reading live-screen.tsx'),
    lately: [],
    agents: [
      { id: 'a1', label: 'Polish pass', state: 'working', steps: steps('Running tsc') },
      { id: 'a2', label: 'Check the server', state: 'done', steps: steps('Server is fine') },
    ],
  };
  assert.deepEqual(activityOf(task, null), {
    title: 'voiceapp',
    state: 'working',
    steps: task.steps,
  });
  assert.equal(activityOf(task, 'a1')?.title, 'Polish pass');
  assert.deepEqual(activityOf(task, 'a2'), {
    title: 'Check the server',
    state: 'done',
    steps: steps('Server is fine'),
  });
  assert.equal(activityOf({ ...task, state: 'done' }, null)?.state, 'done');
  assert.equal(activityOf(task, 'gone'), undefined);
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
