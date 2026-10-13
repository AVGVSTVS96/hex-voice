import assert from 'node:assert/strict';
import test from 'node:test';

import { createSessionAPI, createTasksAPI } from '../src/live/api-client';
import {
  groupTasks,
  idleLine,
  openLabel,
  taskTime,
  tasksSubtitle,
  type TaskRow,
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
  where: 'Telegram',
  state,
  line: `${name} line`,
  since: when,
  at: when,
  agents: [],
  ...extra,
});

test('needs you leads, then working, then what finished today; older settled tasks fold into idle', () => {
  const groups = groupTasks(
    [
      row('autofork', 'needs', at(8, 30)),
      row('voiceapp', 'working'),
      row('voice', 'done', at(9, 33)),
      row('Supremacy', 'failed', at(7, 12)),
      row('backlog', 'done', at(15, 0, 12)),
      row('Watcher', 'idle'),
    ],
    now,
  );
  assert.deepEqual(
    groups.map((group) => [group.title, group.tasks.map((task) => task.name)]),
    [
      ['Needs you', ['autofork']],
      ['Working', ['voiceapp']],
      ['Done today', ['voice', 'Supremacy']],
      ['Idle', ['backlog', 'Watcher']],
    ],
  );
  assert.equal(tasksSubtitle(groups), '1 needs you · 1 working · 2 done today');
  assert.equal(tasksSubtitle(groups, true), '1 needs you · 1 working');
  assert.equal(tasksSubtitle([]), 'Nothing running');
});

test('a row says how long it has worked, or since when it waited or finished', () => {
  assert.equal(taskTime(row('voiceapp', 'working', at(9, 46)), now), '14 min');
  assert.equal(taskTime(row('Films', 'working', at(8, 0)), now), '2 hr');
  assert.match(taskTime(row('autofork', 'needs', at(8, 30)), now), /^8:30\sAM$/);
  assert.match(taskTime(row('Cloud', 'needs', at(9, 0, 11)), now), /Oct 11|11 Oct/);
});

test('idle names read as one line, the rest counted', () => {
  const names = [
    'seqno',
    'antibody',
    'Data kit',
    'x',
    'automode',
    'Theo clips',
    'Voice Memos',
    'a',
    'b',
  ];
  assert.equal(
    idleLine(names.map((name) => row(name, 'idle'))),
    'seqno, antibody, Data kit, x, automode, Theo clips, Voice Memos and 2 more',
  );
  assert.equal(idleLine([row('x', 'idle'), row('x', 'idle')]), 'x');
});

test('only a thread hex can link to gets an open button', () => {
  assert.equal(
    openLabel(row('autofork', 'needs', at(8), { link: 'https://t.me/c/1/908' })),
    'Open in Telegram',
  );
  assert.equal(openLabel(row('Forum', 'needs', at(8), { app: 'buzz', where: 'Buzz' })), undefined);
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
