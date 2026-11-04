import assert from 'node:assert/strict';
import test from 'node:test';

import { createHex } from '../src/hex/api';
import { Refused, createClient } from '../src/hex/client';
import { AskId } from '../src/live/asks';
import { CallId } from '../src/live/calls';
import { TaskId } from '../src/live/tasks';

const url = 'https://hex.example:8790';
type Fetch = typeof globalThis.fetch;
const hexAt = (fetch: Fetch, token?: string, at = url) =>
  createHex(createClient({ url: at, token, fetch }));
const answering = (body: unknown, seen?: { url: string; init?: RequestInit }[]) =>
  hexAt(async (input, init) => {
    seen?.push({ url: String(input), init });
    return body === null ? new Response(null, { status: 204 }) : Response.json(body);
  });

const live = CallId.parse('live_1');
const thread = TaskId.parse('telegram:-100:908');
const summary = { id: 'live_1', started: '2026-10-14T06:00:00.000Z', from: 'app' };

test('a build without the hex address says how to set it and asks nothing', async () => {
  for (const missing of [undefined, '', '   ']) {
    const hex = createHex(createClient({ url: missing, fetch: assert.fail }));
    await assert.rejects(hex.calls.list(), /EXPO_PUBLIC_HEX_URL/);
    await assert.rejects(hex.session.create('offer'), /EXPO_PUBLIC_HEX_URL/);
  }
});

test('sends the offer and voice to hex and reads OpenAI’s session back', async () => {
  const seen: { url: string; init?: RequestInit }[] = [];
  const hex = hexAt(
    async (input, init) => {
      seen.push({ url: String(input), init });
      return Response.json(
        { session: { id: 'live_1', model: 'gpt-live-1' }, transport: { sdp: 'answer' } },
        { status: 201 },
      );
    },
    undefined,
    `${url}//`,
  );
  assert.deepEqual(await hex.session.create('offer', 'cedar'), { sdp: 'answer', sessionId: live });
  assert.equal(seen[0]!.url, `${url}/session`);
  assert.equal(seen[0]!.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(seen[0]!.init?.body)), {
    sdp: 'offer',
    voice: 'cedar',
    from: 'app',
  });
});

test('a call started from a task or for your asks tells hex which', async () => {
  const seen: { url: string; init?: RequestInit }[] = [];
  const hex = answering({ session: { id: 'live_1' }, transport: { sdp: 'answer' } }, seen);
  await hex.session.create('offer', 'cedar', { task: thread });
  await hex.session.create('offer', 'cedar', 'asks');
  assert.deepEqual(
    seen.map(({ init }) => (JSON.parse(String(init?.body)) as { about: string }).about),
    [thread, 'asks'],
  );
});

test('ends a call, and marks when the phone takes its audio and gives it back', async () => {
  const seen: { url: string; init?: RequestInit }[] = [];
  const hex = answering(null, seen);
  await hex.session.close(live);
  await hex.session.mark?.(live, 'paused');
  assert.deepEqual(
    seen.map(({ url, init }) => [init?.method, url, JSON.parse(String(init?.body))]),
    [
      ['DELETE', `${url}/session`, { sessionId: 'live_1' }],
      ['POST', `${url}/calls/live_1/moments`, { kind: 'paused' }],
    ],
  );
});

test('shows hex’s and OpenAI’s errors as they are', async () => {
  const plain = hexAt(async () => new Response('Set OPENAI_API_KEY', { status: 503 }));
  await assert.rejects(plain.session.create('offer'), /Set OPENAI_API_KEY/);
  const openai = hexAt(async () =>
    Response.json({ error: { message: 'Invalid voice' } }, { status: 400 }),
  );
  await assert.rejects(openai.session.create('offer'), /^Error: Invalid voice$/);
});

test('an answer this app can’t read names where, instead of reaching the screen', async () => {
  await assert.rejects(
    answering({ session: {} }).session.create('offer'),
    /hex sent \/session in a shape this app can’t read \(session\.id\)/,
  );
  await assert.rejects(answering({ version: 1, calls: [{ id: 3 }] }).calls.list(), /calls\.0/);
});

test('hex turning a request down is a refusal in its own words; its own failure is not', async () => {
  const answer = (response: Response) =>
    hexAt(async () => response).asks.answer(AskId.parse('a'), 'Yes');
  await assert.rejects(
    answer(new Response('that question is already answered or settled', { status: 409 })),
    (error) =>
      error instanceof Refused &&
      error.status === 409 &&
      error.message === 'That question is already answered or settled',
  );
  await assert.rejects(
    answer(new Response('hub is down', { status: 502 })),
    (error) => !(error instanceof Refused) && (error as Error).message === 'Hub is down',
  );
});

test("a thread hex has no steps for is refused as not there, so it isn't asked for again", async () => {
  const hex = hexAt(async () => new Response('no such task', { status: 404 }));
  await assert.rejects(
    hex.tasks.get(thread),
    (error) => error instanceof Refused && error.status === 404,
  );
});

test('an unreachable hex points at Tailscale', async () => {
  const hex = hexAt(async () => {
    throw new TypeError('Network request failed');
  });
  await assert.rejects(hex.session.create('offer'), /Tailscale/);
  await assert.rejects(hex.activity.watch(undefined, new AbortController().signal), /Tailscale/);
});

test('every request carries the hex token when the app has one', async () => {
  const seen: (string | null)[] = [];
  const fetch: Fetch = async (_input, init) => {
    seen.push(new Headers(init?.headers).get('authorization'));
    return Response.json({ version: 1, call: null, tasks: [] });
  };
  const signal = new AbortController().signal;
  await hexAt(fetch, 'secret').session.close(live);
  await hexAt(fetch, 'secret').activity.watch(undefined, signal);
  await hexAt(fetch).session.close(live);
  assert.deepEqual(seen, ['Bearer secret', 'Bearer secret', null]);
});

test('lists are asked for, then waited on from the version they last saw', async () => {
  const seen: { url: string; init?: RequestInit }[] = [];
  const signal = new AbortController().signal;
  await answering({ version: 7, live: 'live_2', calls: [] }, seen).calls.list();
  await answering({ version: 7, calls: [] }, seen).calls.list(7);
  await answering({ version: 8, turns: [], tasks: [], ...summary }, seen).calls.get(live, 8);
  await answering({ version: 7, call: 'live_1', tasks: [] }, seen).activity.watch(7, signal);
  await answering({ version: 7, tasks: [] }, seen).tasks.list(7);
  await answering({ version: 3, needs: 1, working: 2 }, seen).tasks.counts(2);
  await answering({ version: 4, sends: true, total: 0, turns: [], waiting: [] }, seen).tasks.chat(
    thread,
    4,
  );
  await answering({ version: 5, asks: [], stuck: [], fresh: [], check: null }, seen).asks.list(5);
  assert.deepEqual(
    seen.map(({ url }) => url.slice(url.indexOf('/', 8))),
    [
      '/calls',
      '/calls?after=7',
      '/calls/live_1?after=8',
      '/activity?after=7',
      '/tasks?after=7',
      '/tasks/summary?after=2',
      '/tasks/telegram%3A-100%3A908/chat?after=4',
      '/asks?after=5',
    ],
  );
});

test('closing a list stops its waiting request as it is', async () => {
  const controller = new AbortController();
  const hex = hexAt(
    (_input, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new DOMException('', 'AbortError'))),
      ),
  );
  const waiting = hex.calls.list(7, controller.signal);
  controller.abort();
  await assert.rejects(waiting, { name: 'AbortError' });
});

test('each tap goes to hex where it belongs, by id', async () => {
  const seen: { url: string; init?: RequestInit }[] = [];
  const hex = answering(null, seen);
  await hex.calls.remove(live);
  await hex.tasks.talk(thread);
  await hex.tasks.send(thread, 'Ship it', 'app-1');
  await hex.tasks.stop(thread);
  await hex.asks.undo(AskId.parse('check:music'));
  await hex.asks.act('t3-limit');
  await hex.asks.read('fresh-1');
  await hex.asks.talk();
  assert.deepEqual(
    seen.map(({ url, init }) =>
      `${init?.method} ${url.slice(url.indexOf('/', 8))} ${init?.body ?? ''}`.trim(),
    ),
    [
      'DELETE /calls/live_1',
      'POST /tasks/telegram%3A-100%3A908/talk',
      'POST /tasks/telegram%3A-100%3A908/chat {"text":"Ship it","key":"app-1"}',
      'POST /tasks/telegram%3A-100%3A908/stop',
      'POST /asks/check%3Amusic/undo',
      'POST /stuck/t3-limit/act',
      'POST /fresh/fresh-1/read',
      'POST /asks/talk',
    ],
  );
});

test('an answer, a note and a not needed each go to their ask and say what they reached', async () => {
  const seen: { url: string; init?: RequestInit }[] = [];
  const reached = { thread: 'telegram:-100:1', topic: 'hex', settled: 2, missed: 1 };
  const hex = answering(reached, seen);
  const ask = AskId.parse('telegram:-100:1:7');
  assert.deepEqual(await hex.asks.answer(ask, 'Deep'), reached);
  assert.deepEqual(await hex.asks.note(ask, 'Only if it ships today'), reached);
  assert.deepEqual(await hex.asks.dismiss(ask), reached);
  assert.deepEqual(
    seen.map(({ url, init }) =>
      `${init?.method} ${url.slice(url.indexOf('/', 8))} ${init?.body ?? ''}`.trim(),
    ),
    [
      'POST /asks/telegram%3A-100%3A1%3A7/answer {"label":"Deep"}',
      'POST /asks/telegram%3A-100%3A1%3A7/note {"text":"Only if it ships today"}',
      'POST /asks/telegram%3A-100%3A1%3A7/dismiss',
    ],
  );
  await assert.rejects(answering(null).asks.note(ask, 'x'), /asks\/.*note/);
});
