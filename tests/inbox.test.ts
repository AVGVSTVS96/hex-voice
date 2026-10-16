import assert from 'node:assert/strict';
import test from 'node:test';

import type { Ask, Fresh, Stuck } from '../src/live/asks';
import {
  fitsOneLine,
  inboxEntries,
  picksOf,
  search,
  stageCounts,
  taskOf,
  topicsOf,
  type Entry,
} from '../src/live/inbox';
import type { TaskRow } from '../src/live/tasks';

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
const ask = (id: string, kind: Ask['kind'], extra: Partial<Ask> = {}): Ask => ({
  id,
  kind,
  task: 'telegram:-100:1',
  app: 'telegram',
  topic: 'autofork',
  at: at(7, 32),
  question: `${id}?`,
  options: [{ label: 'Yes' }, { label: 'No' }],
  ...extra,
});
const stuck = (id: string, extra: Partial<Stuck> = {}): Stuck => ({
  id,
  app: 't3',
  title: `${id} stopped`,
  why: `${id} why`,
  action: 'Retry',
  mark: 'failed',
  at: at(6),
  ...extra,
});
const fresh = (id: string, topic: string, when = at(9), read = false): Fresh => ({
  id,
  app: 't3',
  topic,
  title: `${id} title`,
  line: `${id} line`,
  at: when,
  read,
});

type Parts = { tasks?: TaskRow[]; asks?: Ask[]; stuck?: Stuck[]; fresh?: Fresh[] };
const stream = ({ tasks = [], asks = [], stuck = [], fresh = [] }: Parts = {}) =>
  inboxEntries(tasks, { stuck, fresh }, asks, now);
const ids = (entries: Entry[]) => entries.map((entry) => entry.id);

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
      fresh('read-today', 'pigeon', at(9, 45), true),
      fresh('read-old', 'seqno', at(15, 0, 12), true),
      fresh('unread-old', 'jev', at(15, 0, 11)),
      fresh('unread', 'antibody', at(8)),
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

test('a row’s place is the app hex names for it, and anything outside the four apps is on the server', () => {
  const entries = stream({
    asks: [
      ask('ask-telegram', 'pick'),
      ask('ask-t3', 'pick', { task: 't3:abc', app: 't3' }),
      ask('ask-voice', 'pick', { task: 'voice:call-1', app: 'voice' }),
    ],
    tasks: [
      row('voice', 'working', at(9), { app: 'voice' }),
      row('claude', 'working', at(9), { app: 'claude' }),
      row('discord', 'working', at(9), { app: 'discord' }),
      row('buzz', 'working', at(9), { app: 'buzz' }),
    ],
    stuck: [stuck('t3-limit'), stuck('check-music', { app: 'hex' })],
    fresh: [fresh('f-t3', 'pigeon'), { ...fresh('f-telegram', 'General'), app: 'telegram' }],
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
    'check-music': 'server',
    'f-t3': 't3',
    'f-telegram': 'telegram',
  });
  assert.deepEqual(
    entries.filter((entry) => entry.kind === 'fresh').map((entry) => entry.topic),
    ['pigeon', 'General'],
  );
});

test('a tab cuts its entries into topics in the stream’s order, with Stuck where its items fall', () => {
  const entries = stream({
    asks: [
      ask('a1', 'pick', { task: 'telegram:autofork' }),
      ask('p1', 'yesno', { task: 'telegram:pigeon', topic: 'pigeon' }),
      ask('a2', 'yesno', { task: 'telegram:autofork' }),
    ],
    tasks: [
      row('voiceapp', 'working'),
      row('autofork', 'working', at(9), { id: 't3:autofork', app: 't3' }),
    ],
    stuck: [stuck('t3-limit')],
  });
  const needs = topicsOf(
    entries.filter((entry) => entry.stage === 'needs'),
    entries,
    [],
  );
  assert.deepEqual(
    needs.map((topic) => [topic.name, ids(topic.entries)]),
    [
      ['autofork', ['a1', 'a2']],
      ['pigeon', ['p1']],
      ['Stuck', ['t3-limit']],
    ],
  );
  const working = topicsOf(
    entries.filter((entry) => entry.stage === 'working'),
    entries,
    [],
  );
  assert.deepEqual(
    working.map((topic) => topic.name),
    ['voiceapp', 'autofork'],
  );
});

test('a topic marks each of its threads once, by its most pressing stage, whichever tab it is in', () => {
  const tasks = [
    row('autofork', 'working', at(9), { id: 't3:autofork', app: 't3' }),
    row('autofork', 'idle', at(8), { id: 'buzz:autofork', app: 'buzz' }),
    row('pigeon', 'working'),
  ];
  const entries = stream({
    asks: [
      ask('a1', 'pick', { task: 'telegram:autofork' }),
      ask('a2', 'yesno', { task: 'telegram:autofork' }),
      ask('p1', 'pick', { task: 'telegram:pigeon', topic: 'pigeon' }),
    ],
    tasks,
    fresh: [fresh('f', 'autofork')],
  });
  const marks = (stage: Entry['stage']) =>
    topicsOf(
      entries.filter((entry) => entry.stage === stage),
      entries,
      tasks,
    ).map((topic) => [topic.name, topic.marks]);
  assert.deepEqual(marks('needs'), [
    ['autofork', ['needs', 'working', 'quiet']],
    ['pigeon', ['needs']],
  ]);
  assert.deepEqual(marks('working'), [
    ['autofork', ['needs', 'working', 'quiet']],
    ['pigeon', ['needs']],
  ]);
});

test('a topic’s lane is every one of its threads’ last 12 hours that has any', () => {
  const worked = [
    { at: at(2), state: 'working' as const },
    { at: at(3), state: 'done' as const },
  ];
  const asked = [{ at: at(7), state: 'needs' as const }];
  const tasks = [
    row('autofork', 'done', at(3), { id: 't3:autofork', app: 't3', track: worked }),
    row('autofork', 'needs', at(7), { track: asked }),
    row('autofork', 'idle', at(1), { id: 'buzz:autofork', app: 'buzz' }),
  ];
  const entries = stream({ tasks });
  const [topic] = topicsOf(entries, entries, tasks);
  assert.deepEqual(topic!.tracks, [asked, worked]);
});

test('each tab counts its stage, leaving out the asks you answered here', () => {
  const entries = stream({
    asks: [ask('a', 'pick'), ask('b', 'yesno')],
    tasks: [row('voiceapp', 'working'), row('Watcher', 'idle'), row('Cloud', 'idle')],
    stuck: [stuck('t3-limit')],
    fresh: [fresh('f', 'pigeon')],
  });
  assert.deepEqual(stageCounts(entries), { needs: 3, working: 1, done: 1, quiet: 2 });
  assert.deepEqual(stageCounts(entries, { a: 'Yes', b: null }), {
    needs: 2,
    working: 1,
    done: 1,
    quiet: 2,
  });
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
    fresh: [{ ...fresh('shipped', 'pigeon'), line: 'npm 0.1.0 is live' }],
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

test('an ask’s choices answer in its row only when every one fits one line of the room it has', () => {
  const short = [{ label: 'Neon via Vercel', pick: true }, { label: 'Something else' }];
  const long = [
    { label: 'Sendblue $100/mo' },
    { label: 'Photon free first' },
    { label: '2nd Apple ID on Mac' },
  ];
  assert.equal(fitsOneLine(short, 330), true);
  assert.equal(fitsOneLine(long, 330), false);
  assert.equal(fitsOneLine(long, 700), true);
  assert.equal(fitsOneLine([{ label: 'Done' }, { label: 'Later' }], 120), true);
  assert.equal(fitsOneLine([{ label: 'Done' }, { label: 'Later' }], 90), false);
});

test('a row opens the task it came from, when it has one', () => {
  const entries = stream({
    asks: [ask('a', 'pick', { task: 'telegram:autofork' })],
    tasks: [row('voiceapp', 'working')],
    stuck: [stuck('t3-limit')],
    fresh: [fresh('shipped', 'pigeon')],
  });
  assert.deepEqual(
    entries.map((entry) => taskOf(entry)),
    ['telegram:autofork', undefined, 'telegram:voiceapp', undefined],
  );
});
