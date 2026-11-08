import assert from 'node:assert/strict';
import test from 'node:test';

import type * as z from 'zod/mini';

import { Ask, Fresh, Stuck } from '../src/live/asks';
import {
  fitsOneLine,
  headlineOf,
  doneIn,
  pageOf,
  proofLinks,
  taskIn,
  topicIn,
  inboxEntries,
  linkName,
  picksOf,
  problemOf,
  proofWords,
  reachedBy,
  search,
  stageCounts,
  taskOf,
  tilesOf,
  topicsOf,
  type Entry,
} from '../src/live/inbox';
import { Finished, TaskRow } from '../src/live/tasks';

const now = new Date(2026, 9, 13, 10, 0);
const at = (hours: number, minutes = 0, day = 13) =>
  new Date(2026, 9, day, hours, minutes).toISOString();

const row = (
  name: string,
  state: TaskRow['state'],
  when = at(9),
  extra: Partial<z.input<typeof TaskRow>> = {},
): TaskRow =>
  TaskRow.parse({
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
const ask = (id: string, kind: Ask['kind'], extra: Partial<z.input<typeof Ask>> = {}): Ask =>
  Ask.parse({
    id,
    kind,
    task: 'telegram:-100:1',
    app: 'telegram',
    topic: 'autofork',
    at: at(7, 32),
    question: `${id}?`,
    options: [{ label: 'Yes' }, { label: 'No' }],
    places: [],
    ...extra,
  });
const stuck = (id: string, extra: Partial<z.input<typeof Stuck>> = {}): Stuck =>
  Stuck.parse({
    id,
    app: 't3',
    title: `${id} stopped`,
    why: `${id} why`,
    action: 'Retry',
    mark: 'failed',
    at: at(6),
    ...extra,
  });
const fresh = (id: string, topic: string, when = at(9), read = false): Fresh =>
  Fresh.parse({
    id,
    app: 't3',
    topic,
    title: `${id} title`,
    line: `${id} line`,
    at: when,
    read,
  });

const done = (
  id: string,
  topic: string,
  when = at(9),
  extra: Partial<z.input<typeof Finished>> = {},
): Finished =>
  Finished.parse({
    id,
    title: `${id} title`,
    topic,
    app: 'telegram',
    proof: `${id} proof`,
    at: when,
    run: `telegram:${topic}`,
    ...extra,
  });

type Parts = {
  tasks?: TaskRow[];
  finished?: Finished[];
  asks?: Ask[];
  stuck?: Stuck[];
  fresh?: Fresh[];
};
const stream = ({ tasks = [], finished = [], asks = [], stuck = [], fresh = [] }: Parts = {}) =>
  inboxEntries(tasks, finished, { stuck, fresh }, asks, now);
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

test('a thread that waits on your ask is in Needs you by its ask alone, never left quiet; one still working stays in Working', () => {
  const entries = stream({
    asks: [
      ask('draft', 'yesno', { task: 'telegram:x', topic: 'x', at: at(9) }),
      ask('merge', 'yesno', { task: 'telegram:autofork', at: at(8) }),
      ask('shots', 'yesno', { task: 'telegram:Muse', topic: 'Muse', at: at(7) }),
    ],
    tasks: [
      row('x', 'idle', at(9, 30)),
      row('autofork', 'done', at(9, 40)),
      row('Muse', 'working'),
      row('seqno', 'idle'),
    ],
  });
  assert.deepEqual(
    entries.map((entry) => [entry.id, entry.stage]),
    [
      ['draft', 'needs'],
      ['merge', 'needs'],
      ['shots', 'needs'],
      ['telegram:Muse', 'working'],
      ['telegram:seqno', 'quiet'],
    ],
  );
});

test('after what needs you comes what works, then what was done in the last day, then the rest, quiet', () => {
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
      fresh('read-last-night', 'seqno', at(15, 0, 12), true),
      fresh('read-old', 'jev', at(9, 0, 12), true),
      fresh('unread-old', 'jev', at(15, 0, 11)),
      fresh('unread', 'antibody', at(8)),
    ],
  });
  assert.deepEqual(ids(entries), [
    'telegram:working',
    'read-today',
    'unread',
    'read-last-night',
    'telegram:done-late',
    'telegram:idle',
    'telegram:done-early',
    'telegram:failed',
    'telegram:old',
    'telegram:older',
    'unread-old',
  ]);
  assert.deepEqual(
    entries.map((entry) => entry.stage),
    ['working', 'done', 'done', 'done', ...Array(7).fill('quiet')],
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
  );
  assert.deepEqual(
    working.map((topic) => topic.name),
    ['voiceapp', 'autofork'],
  );
});

test('an ask sits in the topic of the thread that asked it, and in its own once that thread is off the board', () => {
  const entries = stream({
    asks: [
      ask('g1', 'pick', { task: 'telegram:-100', topic: 'hex' }),
      ask('o1', 'pick', { task: 'discord:gone', topic: 'Data kit' }),
    ],
    tasks: [row('General', 'needs', at(9), { id: 'telegram:-100' })],
  });
  assert.deepEqual(
    topicsOf(entries, entries).map((topic) => [topic.name, ids(topic.entries)]),
    [
      ['General', ['g1']],
      ['Data kit', ['o1']],
    ],
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
        context: 'Card ends 4242',
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
  assert.deepEqual(found('card 4242'), ['twilio']);
  assert.deepEqual(found('rendering'), ['telegram:autofork']);
  assert.deepEqual(found('opus until'), ['t3-limit']);
  assert.deepEqual(found('npm pigeon'), ['shipped']);
  assert.deepEqual(found('t3 code'), ['t3-limit', 'shipped']);
  assert.deepEqual(found('telegram'), ['twilio', 'telegram:autofork']);
  assert.equal(search(entries, '   '), entries);
});

test('hex’s picks are the open asks with a pick, never money', () => {
  const entries = stream({
    asks: [
      ask('ok', 'pick', { options: [{ label: 'Other' }, { label: 'Deep', pick: true }] }),
      ask('money', 'yesno', { tag: 'money', options: [{ label: 'Pay', pick: true }] }),
      ask('page', 'do', {
        options: [{ label: 'Later', pick: true }],
        links: [{ label: 'PR #2', url: 'https://example.com' }],
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
    ['page', 'Later'],
  ]);
  assert.deepEqual(taken(), [
    ['ok', 'Deep'],
    ['page', 'Later'],
    ['answered', 'Yes'],
  ]);
});

test('an ask’s choices answer in its row only when every one fits one line of the room it has', () => {
  const short = [{ label: 'Neon via Vercel', pick: true }, { label: 'Something else' }];
  const long = [
    { label: 'Plan B $20/mo' },
    { label: 'Photon free first' },
    { label: '2nd Apple ID on Mac' },
  ];
  assert.equal(fitsOneLine(short, 330), true);
  assert.equal(fitsOneLine(long, 330), false);
  assert.equal(fitsOneLine(long, 700), true);
  assert.equal(fitsOneLine([{ label: 'Done' }, { label: 'Later' }], 120), true);
  assert.equal(fitsOneLine([{ label: 'Done' }, { label: 'Later' }], 90), false);
});

test('a topic’s page measures its answers at its own size', () => {
  const answers = [{ label: 'Do the prompt change', pick: true }, { label: 'Leave it' }];
  assert.equal(fitsOneLine(answers, 300), true);
  assert.equal(fitsOneLine(answers, 300, 17), false);
  assert.equal(fitsOneLine(answers, 362, 17), true);
});

const duo = ask('check:duo-order', 'do', {
  question: 'Is there an Apple order in for the Duo?',
  options: [{ label: 'Ordered', value: 'Done' }, { label: 'Not yet' }],
  links: [{ label: 'Apple Store', url: 'https://www.apple.com/shop' }],
  places: [
    {
      app: 'telegram',
      place: 'General',
      task: 'telegram:-1001234567890',
      link: 'https://t.me/c/1234567890/3451',
    },
    { app: 'voice', place: 'Hub-next live, voice split', call: 'live_1' },
    { app: 'voice', place: 'Hub fix, log lag, RAM site, T3 MCP', call: 'live_2' },
    { app: 'voice', place: 'Duo date history', call: 'live_3' },
  ],
});

test('an ask shows three tiles at most: its places that open, newest first, then its first page', () => {
  assert.deepEqual(tilesOf(duo), [
    { kind: 'app', place: 'telegram', label: 'Telegram', link: 'https://t.me/c/1234567890/3451' },
    { kind: 'call', label: 'Call', call: 'live_1' },
    { kind: 'link', label: 'Apple Store', url: 'https://www.apple.com/shop' },
  ]);
  assert.deepEqual(
    tilesOf({ ...duo, links: [] }).map((tile) => tile.label),
    ['Telegram', 'Hub-next live, voice split', 'Hub fix, log lag, RAM site, T3 MCP'],
  );
});

test('a place that can’t open comes after every one that can, and a call opens', () => {
  const tiles = tilesOf(
    ask('ghosts', 'yesno', {
      places: [
        { app: 't3', place: 'autofork' },
        { app: 'telegram', place: 'DM' },
        { app: 'discord', place: 'fix hex NOW', link: 'https://discord.com/channels/1/2' },
        { app: 'voice', place: 'Duo date history', call: 'live_3' },
      ],
    }),
  );
  assert.deepEqual(tiles, [
    {
      kind: 'app',
      place: 'discord',
      label: 'Discord',
      link: 'https://discord.com/channels/1/2',
    },
    { kind: 'call', label: 'Call', call: 'live_3' },
    { kind: 'app', place: 't3', label: 'T3 Code', link: undefined },
  ]);
});

test('two places in one app are each named by their thread', () => {
  const buried = ask('check:antibody', 'yesno', {
    places: [
      { app: 'telegram', place: 'antibody', link: 'https://t.me/c/1/10' },
      { app: 'telegram', place: 'hex', link: 'https://t.me/c/1/20' },
      { app: 'telegram', place: 'DM' },
    ],
  });
  assert.deepEqual(
    tilesOf(buried).map((tile) => tile.label),
    ['antibody', 'hex', 'Telegram'],
  );
});

test('every row has a tile where it lives, filled only when it has a link', () => {
  const entries = stream({
    asks: [duo],
    tasks: [
      row('voiceapp', 'working', at(9), { link: 'https://t.me/c/1/5' }),
      row('autofork', 'working', at(9), { id: 't3:autofork', app: 't3' }),
    ],
    stuck: [stuck('t3-limit')],
    fresh: [fresh('shipped', 'pigeon')],
  });
  assert.deepEqual(
    entries.map((entry) =>
      entry.tiles.map((tile) => (tile.kind === 'app' ? tile.link : tile.kind)),
    ),
    [
      ['https://t.me/c/1234567890/3451', 'call', 'link'],
      [undefined],
      ['https://t.me/c/1/5'],
      [undefined],
      [undefined],
    ],
  );
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

test('an entry’s headline is what it asks or says', () => {
  const entries = stream({ tasks: [row('voiceapp', 'needs', at(3), { line: 'Plug the Duo in' })] });
  assert.deepEqual(entries.map(headlineOf), ['Plug the Duo in']);
});

test('a project opens on its leading thread, or on a page of its own when it has none', () => {
  const [entry] = stream({ tasks: [row('voiceapp', 'needs', at(3))] });
  assert.ok(entry?.kind === 'task');
  const topic = { name: 'voiceapp', entries: [entry], marks: [] };
  assert.equal(pageOf(topic), entry.task.id);
  const stuck = { name: 'Stuck', entries: [], marks: [] };
  assert.equal(topicIn(pageOf(stuck)), 'Stuck');
  assert.equal(topicIn(entry.task.id), undefined);
});

test('an answer says it cleared buttons only when hex says it settled some, names where only when it missed none, and says what it missed', () => {
  const asked = ask('a', 'pick', {
    places: [
      { app: 'telegram', place: 'General', link: 'https://t.me/c/1/2' },
      { app: 'voice', place: 'Desk setup', call: 'call_1' },
    ],
  });
  const sent = { thread: 'telegram:-1:2', topic: 'hex', settled: 0, missed: 0 };
  assert.equal(reachedBy(asked, undefined), '');
  assert.equal(reachedBy(asked, sent), '');
  assert.equal(reachedBy(asked, { ...sent, settled: 1 }), ' and cleared its Telegram buttons');
  assert.equal(
    reachedBy(asked, { ...sent, settled: 1, missed: 1 }),
    ' and cleared its buttons. One place was out of reach and still asks it',
  );
  assert.equal(
    reachedBy(ask('b', 'pick'), { ...sent, missed: 2 }),
    '. 2 places were out of reach and still ask it',
  );
});

test('a run that ended on an API error says so in words, and any other line stays as hex wrote it', () => {
  assert.equal(
    problemOf('API Error: Server is temporarily limiting requests (not your usage limit) · All…'),
    'Stopped: the server was limiting requests',
  );
  assert.equal(problemOf('API Error: 500 internal'), 'Stopped on an API error');
  assert.equal(problemOf('remade hero clip sent'), undefined);
});

test('each task hex finished in the last day is in Done, while its project works on in another tab', () => {
  const entries = stream({
    tasks: [row('voiceapp', 'working'), row('iikb', 'needs'), row('seqno', 'idle')],
    finished: [
      done('t-2', 'voiceapp', at(9, 30)),
      done('t-1', 'voiceapp', at(8)),
      done('t-3', 'iikb', at(9, 45)),
      done('t-4', 'seqno', at(7)),
      done('t-0', 'voiceapp', at(9, 0, 12)),
    ],
  });
  const tab = entries.filter((entry) => entry.stage === 'done');
  assert.deepEqual(ids(tab), ['t-3', 't-2', 't-1', 't-4']);
  assert.deepEqual(
    topicsOf(tab, entries).map(({ name, entries }) => [name, entries.length]),
    [
      ['iikb', 1],
      ['voiceapp', 2],
      ['seqno', 1],
    ],
  );
  assert.deepEqual(stageCounts(entries), { needs: 1, working: 1, done: 4, quiet: 1 });
  assert.equal(pageOf(topicsOf(tab, entries)[1]!), 'telegram:voiceapp');
  assert.equal(headlineOf(tab[0]!), 't-3 title');
  const [row3] = tab.flatMap((entry) => topicsOf([entry], entries));
  assert.equal(doneIn(pageOf(row3!)), 't-3');
  assert.equal(taskIn(pageOf(row3!)), null);
});

test('Done is what was done, not who stopped: a thread between runs is quiet', () => {
  const entries = stream({
    tasks: [row('voiceapp', 'done', at(9, 40)), row('pigeon', 'done', at(9, 50))],
    finished: [done('t-1', 'voiceapp', at(9, 30))],
  });
  assert.deepEqual(
    entries.map((entry) => [entry.id, entry.stage]),
    [
      ['t-1', 'done'],
      ['telegram:pigeon', 'quiet'],
      ['telegram:voiceapp', 'quiet'],
    ],
  );
});

test('a finished task with no thread on the board still opens its own page, and its proof link is a tile', () => {
  const [entry] = stream({
    finished: [
      done('t-5', 'Launch plan', at(9), {
        run: undefined,
        link: 'https://t.me/c/1/1',
        proof: 'https://github.com/AVGVSTVS96/hex/pull/180 (5b2b282, live)',
      }),
    ],
  });
  assert.equal(taskOf(entry!), undefined);
  assert.equal(pageOf(topicsOf([entry!], [entry!])[0]!), 'done:t-5');
  assert.deepEqual(entry!.tiles, [
    { kind: 'app', place: 'telegram', label: 'Telegram', link: 'https://t.me/c/1/1' },
    { kind: 'link', label: 'hex #180', url: 'https://github.com/AVGVSTVS96/hex/pull/180' },
  ]);
  assert.deepEqual(ids(search([entry!], 'hex #180')), ['t-5']);
});

test('a proof reads with each link by its name', () => {
  assert.equal(
    proofWords(
      'https://github.com/AVGVSTVS96/iikb/commit/b9330a0c1 and https://github.com/AVGVSTVS96/grokx',
    ),
    'iikb b9330a0 and grokx',
  );
  assert.equal(linkName('https://x.com/avgvstvs96/status/2118'), 'x.com');
  assert.equal(
    proofWords('(see http://100.64.0.7:4800/iikb-context)'),
    '(see 100.64.0.7)',
  );
  assert.equal(proofWords('iikb 7e9ac84, build 501 on Duo'), 'iikb 7e9ac84, build 501 on Duo');
  assert.equal(
    proofWords('site https://autofork.com; PR https://github.com/AVGVSTVS96/hex/pull/180, live.'),
    'site autofork.com; PR hex #180, live.',
  );
  assert.equal(proofWords('telegram:-1001234567890:7350'), 'message 7350');
  assert.deepEqual(
    proofLinks('telegram:-1001234567890:7350, and again telegram:-1001234567890:7350'),
    [{ kind: 'link', label: 'message 7350', url: 'https://t.me/c/1234567890/7350' }],
  );
  assert.deepEqual(proofLinks('telegram:123456789:12 in the DM'), []);
  const [entry] = stream({
    finished: [done('t-6', 'autofork', at(9), { proof: 'https://autofork.com; npm' })],
  });
  assert.deepEqual(entry!.tiles.at(-1), {
    kind: 'link',
    label: 'autofork.com',
    url: 'https://autofork.com',
  });
});
