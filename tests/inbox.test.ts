import assert from 'node:assert/strict';
import test from 'node:test';

import type { Ask, Fresh, Stuck } from '../src/live/asks';
import {
  countsLine,
  groupEntries,
  inboxEntries,
  picksOf,
  quietLine,
  search,
  stageCounts,
  taskOf,
  topicLine,
  topicsOf,
  waited,
  type Entry,
  type Group,
} from '../src/live/inbox';
import type { TaskRow } from '../src/live/tasks';

const now = new Date(2026, 9, 13, 10, 0);
const at = (hours: number, minutes = 0, day = 13) =>
  new Date(2026, 9, day, hours, minutes).toISOString();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

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
const ask = (id: string, kind: Ask['kind'], extra: Partial<Ask> = {}): Ask => ({
  id,
  kind,
  task: 'telegram:-100:1',
  topic: 'autofork',
  at: at(7, 32),
  question: `${id}?`,
  options: [{ label: 'Yes' }, { label: 'No' }],
  ...extra,
});
const stuck = (id: string, extra: Partial<Stuck> = {}): Stuck => ({
  id,
  title: `${id} stopped`,
  why: `${id} why`,
  action: 'Retry',
  mark: 'failed',
  at: at(6),
  ...extra,
});
const fresh = (id: string, where: string, when = at(9), read = false): Fresh => ({
  id,
  title: `${id} title`,
  where,
  line: `${id} line`,
  at: when,
  read,
});

type Parts = { tasks?: TaskRow[]; asks?: Ask[]; stuck?: Stuck[]; fresh?: Fresh[] };
const stream = ({ tasks = [], asks = [], stuck = [], fresh = [] }: Parts = {}) =>
  inboxEntries(tasks, { stuck, fresh }, asks, now);
const ids = (entries: Entry[]) => entries.map((entry) => entry.id);
const shape = (groups: Group[]) =>
  groups.map((group) => [group.title, ids(group.live), ids(group.quiet)]);

test('your asks lead in hex’s order, then threads that need you without an ask, then what is stuck', () => {
  const entries = stream({
    asks: [
      ask('late', 'pick', { task: 'telegram:autofork', at: at(9) }),
      ask('early', 'yesno', { task: 'telegram:pigeon', topic: 'pigeon', at: at(7) }),
    ],
    tasks: [
      row('autofork', 'needs', at(8)),
      row('Cloud', 'needs', at(8, 30), { since: at(6, 15) }),
      row('voiceapp', 'working'),
    ],
    stuck: [stuck('t3-limit'), stuck('check:music')],
  });
  assert.deepEqual(ids(entries), [
    'late',
    'early',
    'telegram:Cloud',
    't3-limit',
    'check:music',
    'telegram:voiceapp',
  ]);
  assert.deepEqual(
    entries.map((entry) => entry.kind),
    ['ask', 'ask', 'task', 'stuck', 'stuck', 'task'],
  );
  assert.equal(entries[2]!.at, at(6, 15));
});

test('after what needs you comes what works, then what finished today, then the rest, quiet', () => {
  const entries = stream({
    tasks: [
      row('older', 'done', at(15, 0, 11)),
      row('old', 'done', at(15, 0, 12)),
      row('idle', 'idle'),
      row('failed', 'failed', at(7, 12)),
      row('done-early', 'done', at(9)),
      row('done-late', 'done', at(9, 33)),
      row('working', 'working'),
    ],
    fresh: [
      fresh('read-today', 'T3 · pigeon', at(9, 45), true),
      fresh('read-old', 'T3 · seqno', at(15, 0, 12), true),
      fresh('unread-old', 'T3 · jev', at(15, 0, 11)),
      fresh('unread', 'T3 · antibody', at(8)),
    ],
  });
  assert.deepEqual(ids(entries), [
    'telegram:working',
    'unread',
    'unread-old',
    'read-today',
    'telegram:done-late',
    'telegram:done-early',
    'telegram:failed',
    'telegram:idle',
    'telegram:old',
    'telegram:older',
  ]);
  assert.deepEqual(
    entries.map((entry) => entry.stage),
    ['working', 'done', 'done', 'done', 'done', 'done', 'done', 'quiet', 'quiet', 'quiet'],
  );
});

test('a row’s place comes from its ask’s task, its app or its stuck id, and a finished item names its topic after the dot', () => {
  const entries = stream({
    asks: [
      ask('ask-telegram', 'pick', { task: 'telegram:-100:1' }),
      ask('ask-t3', 'pick', { task: 't3:abc' }),
      ask('ask-voice', 'pick', { task: 'voice:call-1' }),
    ],
    tasks: [
      row('voice', 'working', at(9), { app: 'voice' }),
      row('claude', 'working', at(9), { app: 'claude' }),
      row('discord', 'working', at(9), { app: 'Discord' }),
      row('buzz', 'working', at(9), { app: 'buzz' }),
    ],
    stuck: [stuck('t3-limit'), stuck('check:music')],
    fresh: [
      fresh('f-t3', 'T3 · pigeon'),
      fresh('f-voice', 'Voice'),
      fresh('f-telegram', 'Telegram · General'),
    ],
  });
  assert.deepEqual(Object.fromEntries(entries.map((entry) => [entry.id, entry.place])), {
    'ask-telegram': 'telegram',
    'ask-t3': 't3',
    'ask-voice': 'server',
    'telegram:voice': 'server',
    'telegram:claude': 'server',
    'telegram:discord': 'discord',
    'telegram:buzz': 'buzz',
    't3-limit': 't3',
    'check:music': 'server',
    'f-t3': 't3',
    'f-voice': 'server',
    'f-telegram': 'telegram',
  });
  assert.deepEqual(
    entries.filter((entry) => entry.kind === 'fresh').map((entry) => entry.topic),
    ['pigeon', 'f-voice title', 'General'],
  );
});

test('by state, each stage is a group and the quiet ones are all folded', () => {
  const entries = stream({
    asks: [ask('a', 'pick', { task: 'telegram:autofork' })],
    tasks: [
      row('voiceapp', 'working'),
      row('voice', 'done', at(9, 33)),
      row('Watcher', 'idle'),
      row('backlog', 'done', at(15, 0, 12)),
    ],
  });
  const groups = groupEntries(entries, 'state');
  assert.deepEqual(
    groups.map((group) => group.key),
    ['needs', 'working', 'done', 'quiet'],
  );
  assert.deepEqual(shape(groups), [
    ['Needs you', ['a'], []],
    ['Working', ['telegram:voiceapp'], []],
    ['Done', ['telegram:voice'], []],
    ['Quiet', [], ['telegram:Watcher', 'telegram:backlog']],
  ]);
  assert.deepEqual(
    groupEntries(
      entries.filter((entry) => entry.stage !== 'done'),
      'state',
    ).map((group) => group.title),
    ['Needs you', 'Working', 'Quiet'],
  );
});

test('by topic, a topic with something going keeps its quiet threads under it and quiet-only topics fold together', () => {
  const entries = stream({
    asks: [ask('a', 'pick', { task: 'telegram:autofork', topic: 'autofork' })],
    tasks: [
      row('voiceapp', 'working'),
      row('autofork', 'idle', at(8), { id: 't3:autofork', app: 't3' }),
      row('Watcher', 'idle', at(9)),
      row('x', 'idle', at(7)),
    ],
    stuck: [stuck('t3-limit')],
  });
  const groups = groupEntries(entries, 'topic');
  assert.deepEqual(shape(groups), [
    ['autofork', ['a'], ['t3:autofork']],
    ['Stuck', ['t3-limit'], []],
    ['voiceapp', ['telegram:voiceapp'], []],
    ['Quiet', [], ['telegram:Watcher', 'telegram:x']],
  ]);
  assert.equal(groups[0]!.topic, 'autofork');
  assert.equal(groups[3]!.key, 'quiet');
  assert.equal(groups[3]!.topic, undefined);

  const noQuietOnly = entries.filter((entry) => entry.topic !== 'Watcher' && entry.topic !== 'x');
  assert.deepEqual(
    groupEntries(noQuietOnly, 'topic').map((group) => group.title),
    ['autofork', 'Stuck', 'voiceapp'],
  );
});

test('by app, places come in their fixed order with the empty ones left out', () => {
  const entries = stream({
    asks: [ask('a', 'pick', { task: 't3:pigeon', topic: 'pigeon' })],
    tasks: [
      row('Zed', 'working', at(9), { app: 'voice' }),
      row('voiceapp', 'working'),
      row('Wire', 'idle', at(8)),
    ],
  });
  const groups = groupEntries(entries, 'app');
  assert.deepEqual(
    groups.map((group) => group.place),
    ['telegram', 't3', 'server'],
  );
  assert.deepEqual(shape(groups), [
    ['Telegram', ['telegram:voiceapp'], ['telegram:Wire']],
    ['T3 Code', ['a'], []],
    ['On the server', ['telegram:Zed'], []],
  ]);
});

test('topics list what needs you first, then what works, then the latest, with one mark per thread', () => {
  const entries = stream({
    asks: [
      ask('a1', 'pick', { task: 'telegram:1', topic: 'autofork' }),
      ask('a2', 'yesno', { task: 'telegram:1', topic: 'autofork' }),
      ask('p1', 'pick', { task: 'telegram:pigeon', topic: 'pigeon' }),
    ],
    tasks: [
      row('autofork', 'working', at(9), { id: 't3:autofork', app: 't3' }),
      row('pigeon', 'working'),
      row('voiceapp', 'working'),
      row('voiceapp', 'working', at(9, 30), { id: 't3:voiceapp', app: 't3' }),
      row('jev', 'idle', at(8)),
      row('Leisure', 'idle', at(9)),
    ],
    stuck: [stuck('t3-limit')],
  });
  const topics = topicsOf(entries);
  assert.deepEqual(
    topics.map((topic) => [topic.name, topic.needs, topic.working, topic.threads, topic.marks]),
    [
      ['autofork', 2, 1, 2, ['needs', 'working']],
      ['pigeon', 1, 1, 1, ['needs']],
      ['voiceapp', 0, 2, 2, ['working', 'working']],
      ['Leisure', 0, 0, 1, ['quiet']],
      ['jev', 0, 0, 1, ['quiet']],
    ],
  );
  assert.deepEqual(topics[0]!.places, ['telegram', 't3']);
  assert.equal(topics[2]!.at, at(9, 30));
  assert.deepEqual(topics.slice(0, 3).map(topicLine), [
    '2 threads · Telegram, T3 Code',
    '1 thread · Telegram',
    '2 threads · Telegram, T3 Code',
  ]);
});

test('what just finished is news of a topic, not a thread: it names where a topic lives only when nothing else does', () => {
  const topics = topicsOf(
    stream({
      tasks: [row('pigeon', 'idle', at(8))],
      fresh: [fresh('p', 'T3 · pigeon'), fresh('j', 'T3 · jev', at(7))],
    }),
  );
  assert.deepEqual(
    topics.map((topic) => [topic.name, topic.threads, topic.marks, topicLine(topic)]),
    [
      ['pigeon', 1, ['quiet'], '1 thread · Telegram'],
      ['jev', 0, [], 'T3 Code'],
    ],
  );
});

test('the header counts skip asks you answered here, and reads as the plain stages that are not zero', () => {
  const entries = stream({
    asks: [ask('a', 'pick'), ask('b', 'yesno')],
    tasks: [row('voiceapp', 'working'), row('Watcher', 'idle'), row('Cloud', 'idle')],
    stuck: [stuck('t3-limit')],
    fresh: [fresh('f', 'T3 · pigeon')],
  });
  assert.deepEqual(stageCounts(entries), { needs: 3, working: 1, done: 1, quiet: 2 });
  assert.deepEqual(stageCounts(entries, { a: 'Yes', b: null }), {
    needs: 2,
    working: 1,
    done: 1,
    quiet: 2,
  });

  assert.equal(
    countsLine({ needs: 7, working: 4, done: 4, quiet: 24 }),
    '7 need you · 4 working · 4 done · 24 quiet',
  );
  assert.equal(countsLine({ needs: 1, working: 0, done: 0, quiet: 3 }), '1 needs you · 3 quiet');
  assert.equal(countsLine({ needs: 0, working: 2, done: 0, quiet: 0 }), '2 working');
  assert.equal(countsLine({ needs: 0, working: 0, done: 0, quiet: 0 }), 'Nothing yet');
});

test('folded quiet threads read as their topics, newest first, each once, the rest counted', () => {
  const names = Array.from({ length: 8 }, (_, i) => `n${i}`);
  const entries = stream({
    tasks: [
      ...names.map((name, i) => row(name, 'idle', at(8 - i + 1))),
      row('n0', 'idle', at(1), { id: 't3:n0', app: 't3' }),
    ],
  });
  assert.equal(quietLine(entries), 'n0, n1, n2, n3, n4, n5 and 2 more');
  assert.equal(quietLine(entries, 'topic', 8), names.join(', '));
  assert.equal(quietLine(entries, 'place'), 'Telegram, T3 Code');
  assert.equal(quietLine(entries.slice(0, 2)), 'n0, n1');
});

test('search needs every word, in any case, across the question, the line, the topic and the place', () => {
  const entries = stream({
    asks: [
      ask('twilio', 'yesno', {
        task: 'telegram:calls',
        topic: 'calls',
        question: 'Upgrade Twilio from trial?',
        context: 'Card ends 9355',
      }),
    ],
    tasks: [row('autofork', 'working', at(9), { line: 'rendering videos' })],
    stuck: [stuck('t3-limit', { title: 'T3 rate limit', why: 'Opus is out until 4am' })],
    fresh: [{ ...fresh('shipped', 'T3 · pigeon'), line: 'npm 0.1.0 is live' }],
  });
  const found = (query: string) => ids(search(entries, query));
  assert.deepEqual(found('twilio'), ['twilio']);
  assert.deepEqual(found('TWILIO trial'), ['twilio']);
  assert.deepEqual(found('twilio rendering'), []);
  assert.deepEqual(found('card 9355'), ['twilio']);
  assert.deepEqual(found('rendering'), ['telegram:autofork']);
  assert.deepEqual(found('opus until'), ['t3-limit']);
  assert.deepEqual(found('npm pigeon'), ['shipped']);
  assert.deepEqual(found('t3 code'), ['t3-limit', 'shipped']);
  assert.deepEqual(found('telegram'), ['twilio', 'telegram:autofork']);
  assert.equal(search(entries, '   '), entries);
});

test('hex’s picks are the open asks with a pick that is an answer, never money or a page', () => {
  const entries = stream({
    asks: [
      ask('ok', 'pick', { options: [{ label: 'Other' }, { label: 'Deep', pick: true }] }),
      ask('money', 'yesno', { tag: 'money', options: [{ label: 'Pay', pick: true }] }),
      ask('page', 'do', {
        options: [{ label: 'Open the page', pick: true, url: 'https://example.com' }],
      }),
      ask('mixed', 'pick', {
        options: [
          { label: 'Open', pick: true, url: 'https://example.com' },
          { label: 'Later', pick: true },
        ],
      }),
      ask('plain', 'yesno'),
      ask('answered', 'yesno', { options: [{ label: 'Yes', pick: true }] }),
    ],
    tasks: [row('voiceapp', 'working')],
    stuck: [stuck('t3-limit')],
  });
  const taken = (answered?: Record<string, string | null>) =>
    picksOf(entries, answered).map(({ ask, option }) => [ask.id, option.label]);
  assert.deepEqual(taken({ answered: 'Yes' }), [
    ['ok', 'Deep'],
    ['mixed', 'Later'],
  ]);
  assert.deepEqual(taken(), [
    ['ok', 'Deep'],
    ['mixed', 'Later'],
    ['answered', 'Yes'],
  ]);
});

test('an ask waits for a day to fill half its bar and is late past that', () => {
  assert.deepEqual(waited(hoursAgo(12), now), { fill: 0.25, late: false });
  assert.deepEqual(waited(hoursAgo(24), now), { fill: 0.5, late: false });
  assert.deepEqual(waited(hoursAgo(25), now), { fill: 25 / 48, late: true });
  assert.deepEqual(waited(hoursAgo(100), now), { fill: 1, late: true });
  assert.deepEqual(waited(hoursAgo(-2), now), { fill: 0, late: false });
});

test('a row opens the task it came from, when it has one', () => {
  const entries = stream({
    asks: [ask('a', 'pick', { task: 'telegram:autofork' })],
    tasks: [row('voiceapp', 'working')],
    stuck: [stuck('t3-limit')],
    fresh: [fresh('shipped', 'T3 · pigeon')],
  });
  assert.deepEqual(
    entries.map((entry) => taskOf(entry)),
    ['telegram:autofork', undefined, 'telegram:voiceapp', undefined],
  );
});
