import assert from 'node:assert/strict';
import test from 'node:test';

import { createCallsAPI } from '../src/live/api-client';
import { byDay, callLength, callName, clock, timeline, type CallSummary } from '../src/live/calls';

const hexUrl = 'https://hex.example:8790';

test('asks for the list, then waits on hex for the next change', async () => {
  const urls: string[] = [];
  const api = createCallsAPI({
    hexUrl,
    fetch: async (url) => {
      urls.push(String(url));
      return Response.json({ version: 7, live: 'sess_2', calls: [] });
    },
  });
  assert.deepEqual(await api.list(), { version: 7, live: 'sess_2', calls: [] });
  await api.list(7);
  assert.deepEqual(urls, [`${hexUrl}/calls`, `${hexUrl}/calls?after=7`]);
});

test('closing the list stops its waiting request as it is', async () => {
  const controller = new AbortController();
  const api = createCallsAPI({
    hexUrl,
    fetch: (_url, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError'))),
      ),
  });
  const waiting = api.list(7, controller.signal);
  controller.abort();
  await assert.rejects(waiting, { name: 'AbortError' });
});

test('deletes one call by id', async () => {
  const api = createCallsAPI({
    hexUrl,
    fetch: async (url, init) => {
      assert.equal(url, `${hexUrl}/calls/sess_1`);
      assert.equal(init?.method, 'DELETE');
      return new Response(null, { status: 204 });
    },
  });
  await api.remove('sess_1');
});

const call = (id: string, started: string): CallSummary => ({
  id,
  started,
  from: 'app',
  seconds: 60,
  tasks: 0,
  preview: 'Is the build green?',
});

test('calls group by day, newest first, as hex sends them', () => {
  const now = new Date(2026, 9, 13, 9);
  const days = byDay(
    [
      call('a', new Date(2026, 9, 13, 3, 5).toISOString()),
      call('b', new Date(2026, 9, 13, 1, 31).toISOString()),
      call('c', new Date(2026, 9, 12, 23, 36).toISOString()),
      call('d', new Date(2026, 8, 30, 12).toISOString()),
    ],
    now,
  );
  assert.deepEqual(
    days.map((day) => [day.label, day.calls.map(({ id }) => id)]),
    [
      ['Today', ['a', 'b']],
      ['Yesterday', ['c']],
      ['September 30', ['d']],
    ],
  );
});

test('a call reads as its title, or your first words until hex names it', () => {
  assert.equal(callName({ title: 'Build check', preview: 'Is the build green?' }), 'Build check');
  assert.equal(callName({ preview: 'Is the build green?' }), 'Is the build green?');
  assert.equal(callLength(14), '14 sec');
  assert.equal(callLength(13 * 60 + 20), '13 min');
  assert.equal(callLength(49 * 60), '49 min');
  assert.equal(callLength(75 * 60), '1 hr 15 min');
  assert.equal(clock(61_200), '1:01');
});

test('each of hex’s tasks is one marker where it started, showing how it ended up', () => {
  const moments = timeline({
    turns: [
      { who: 'you', at: 3000, text: 'Make a plan' },
      { who: 'voice', at: 9000, text: 'Plan’s up.' },
    ],
    tasks: [
      { id: 'plan', state: 'running', at: 4000, text: 'writing the plan' },
      { id: 'plan', state: 'done', at: 12000, text: 'plan page ready' },
    ],
  });
  assert.deepEqual(
    moments.map((moment) => (moment.kind === 'task' ? moment.task : moment.kind)),
    ['turn', { id: 'plan', state: 'done', at: 4000, text: 'plan page ready' }, 'turn'],
  );
});
