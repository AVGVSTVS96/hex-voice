import assert from 'node:assert/strict';
import test from 'node:test';

import {
  START,
  backLeavesTasks,
  levelsOf,
  move,
  shapeOf,
  spotOf,
  type Level,
  type Move,
  type Room,
  type Shape,
  type Stack,
} from '../src/components/tasks/pages';
import { TaskId } from '../src/live/tasks';
import { screenLayout, type Page } from '../src/screens/layout';

const A = TaskId.parse('a');
const LEVELS: Level[] = ['list', 'topic', 'thread', 'steps', 'check'];

const openUpright = screenLayout(
  { width: 951, height: 669 },
  { top: 0, right: 84, bottom: 21, left: 0 },
  { regular: true, bar: 'right', fold: { x: 455, y: 0, width: 40, height: 669, active: false } },
).duo!.tasks;
const openOnSideDuo = screenLayout(
  { width: 669, height: 951 },
  { top: 54, right: 0, bottom: 34, left: 0 },
  { regular: true, fold: { x: 0, y: 455, width: 669, height: 40, active: true } },
).duo!;
const openOnSide = openOnSideDuo.tasks;
const folded = screenLayout(
  { width: 466, height: 678 },
  { top: 0, right: 84, bottom: 34, left: 0 },
  { regular: false, bar: 'right' },
).duo!.tasks;

type PagedRoom = Extract<Room, { paged: true }>;

const roomOf = (page: Page, inset = { left: 0, right: 0 }): PagedRoom => ({
  width: page.area.width,
  height: page.area.height,
  split: page.split,
  top: page.top,
  foot: page.foot,
  inset,
  paged: true,
});
const sheet: Room = { width: 440, foot: 34, paged: false };

const go = (...moves: Move[]) => moves.reduce(move, START);
const pagesOf = (stack: Stack, room: Room, closes = true) => {
  const shape = shapeOf(room.width, room.paged ? room.split : undefined);
  return { levels: levelsOf(stack, shape), shape, closes };
};
const onScreen = (stack: Stack, room: PagedRoom) => {
  const pages = pagesOf(stack, room);
  return LEVELS.filter((level) => spotOf(level, pages, room).shown);
};
const box = (level: Level, stack: Stack, room: PagedRoom) => {
  const spot = spotOf(level, pagesOf(stack, room), room);
  const { width, maxHeight: height } = spot.frame ?? { width: room.width, maxHeight: room.height };
  return { x: spot.offset.x, y: spot.offset.y, width, height };
};
const overlap = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const stacks: [string, Stack][] = [
  ['the list', go()],
  ['a topic', go({ to: 'topic', id: A })],
  ['a thread', go({ to: 'topic', id: A }, { to: 'thread' })],
  ['its steps', go({ to: 'topic', id: A }, { to: 'thread' }, { to: 'steps', id: A })],
  ['the last check', go({ to: 'check' })],
];

test('the Duo pages split at its fold held wide, on its side and folded it shows one at a time', () => {
  assert.equal(shapeOf(openUpright.area.width, openUpright.split), 'split');
  assert.equal(shapeOf(openOnSide.area.width, openOnSide.split), 'one');
  assert.equal(shapeOf(folded.area.width, folded.split), 'one');
  assert.equal(shapeOf(1000, undefined), 'columns');
});

test('open, the Duo shows the deepest two levels, each step down sliding both along', () => {
  const room = roomOf(openUpright);
  assert.deepEqual(onScreen(go(), room), ['list', 'topic']);
  assert.deepEqual(onScreen(go({ to: 'topic', id: A }), room), ['list', 'topic']);
  assert.deepEqual(onScreen(stacks[2]![1], room), ['topic', 'thread']);
  assert.deepEqual(onScreen(stacks[3]![1], room), ['thread', 'steps']);
});

test('back goes a level up, and from the list backLeavesTasks for the call', () => {
  const cases: [Shape, Stack, Level[] | 'call'][] = [
    ['one', go(), 'call'],
    ['one', go({ to: 'topic', id: A }), ['list']],
    ['one', go({ to: 'topic', id: A }, { to: 'thread' }), ['list', 'topic']],
    ['one', go({ to: 'check' }), ['list']],
    ['split', go(), 'call'],
    ['split', go({ to: 'topic', id: A }), 'call'],
    ['split', go({ to: 'check' }), 'call'],
    ['split', go({ to: 'topic', id: A }, { to: 'thread' }), ['list', 'topic']],
    ['split', stacks[3]![1], ['list', 'topic', 'thread']],
    ['columns', go({ to: 'topic', id: A }), 'call'],
    ['columns', go({ to: 'check' }), ['list', 'topic']],
  ];
  for (const [shape, stack, after] of cases) {
    const result = backLeavesTasks(stack, shape)
      ? 'call'
      : levelsOf(move(stack, { to: 'back' }), shape);
    assert.deepEqual(result, after, `${shape} from ${levelsOf(stack, shape).join(' > ')}`);
  }
});

test('Tasks opened on a topic goes back to the list before the call', () => {
  const stack = go({ to: 'start', at: { task: A } });
  assert.deepEqual(levelsOf(stack, 'one'), ['list', 'topic']);
  assert.equal(backLeavesTasks(stack, 'one'), false);
  assert.equal(backLeavesTasks(move(stack, { to: 'back' }), 'one'), true);
});

test('the leading page has Back named for where it goes, the list’s for the call', () => {
  const room = roomOf(openUpright);
  const backOf = (level: Level, stack: Stack) => spotOf(level, pagesOf(stack, room), room).back;
  assert.equal(backOf('list', go()), 'call');
  assert.equal(backOf('topic', go()), undefined);
  assert.equal(backOf('topic', stacks[2]![1]), 'list');
  assert.equal(backOf('thread', stacks[2]![1]), undefined);
  const one = roomOf(folded);
  assert.equal(spotOf('list', pagesOf(go(), one), one).back, 'call');
  assert.equal(spotOf('list', pagesOf(go(), one, false), one).back, undefined);
});

test('on the Duo pages cross only while one fades, and never sit on the hinge, so clear pages work', () => {
  const walks: Stack[][] = [
    [stacks[0]![1], stacks[1]![1], stacks[2]![1], stacks[3]![1]],
    [stacks[0]![1], stacks[4]![1]],
  ];
  for (const [name, page] of [
    ['open upright', openUpright],
    ['open on its side', openOnSide],
    ['folded', folded],
  ] as const) {
    const room = roomOf(page);
    const screen = { x: 0, y: 0, width: room.width, height: room.height };
    const seen = (from: Stack, to: Stack, t: number) =>
      LEVELS.map((level) => {
        const [a, b] = [box(level, from, room), box(level, to, room)];
        const mix = (p: number, q: number) => p + (q - p) * t;
        return [
          level,
          {
            x: mix(a.x, b.x),
            y: mix(a.y, b.y),
            width: mix(a.width, b.width),
            height: mix(a.height, b.height),
          },
        ] as const;
      }).filter(([, frame]) => overlap(frame, screen));
    for (const walk of walks)
      for (const [i, from] of walk.slice(0, -1).entries())
        for (const [a, b] of [
          [from, walk[i + 1]!],
          [walk[i + 1]!, from],
        ])
          for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            const frames = seen(a!, b!, t);
            const fades = (level: Level) =>
              spotOf(level, pagesOf(a!, room), room).shown !==
              spotOf(level, pagesOf(b!, room), room).shown;
            for (const [j, [one, first]] of frames.entries())
              for (const [other, second] of frames.slice(j + 1))
                assert.ok(
                  !overlap(first, second) || fades(one) || fades(other),
                  `${name}, t ${t}: ${one} covers ${other}`,
                );
          }
    const split = room.split;
    if (!split) continue;
    const hinge = { x: split.at, y: 0, width: split.band, height: room.height };
    for (const [at, stack] of stacks)
      for (const level of LEVELS)
        assert.ok(
          !overlap(box(level, stack, room), hinge),
          `${name}, ${at}: ${level} on the hinge`,
        );
  }
});

test('content keeps its inset from the screen edges and none at the hinge', () => {
  const inset = { left: 12, right: 30 };
  const room = roomOf(openUpright, inset);
  const pages = pagesOf(go(), room);
  const list = spotOf('list', pages, room);
  const task = spotOf('topic', pages, room);
  assert.deepEqual([list.pad.leading, list.pad.trailing], [12, 0]);
  assert.deepEqual([task.pad.leading, task.pad.trailing], [0, 30]);
  assert.equal(list.width, openUpright.split!.at - 12);
  assert.equal(
    task.width,
    openUpright.area.width - openUpright.split!.at - openUpright.split!.band - 30,
  );
  const side = roomOf(openOnSide, inset);
  const top = spotOf('list', pagesOf(go(), side), side);
  assert.deepEqual([top.pad.leading, top.pad.trailing, top.width], [12, 30, side.width - 42]);
});

test('beside the transcript, Tasks lays out one page wide with the list’s Back to the call', () => {
  const room: Room = {
    width: 455,
    height: 669,
    top: 0,
    foot: 21,
    inset: { left: 16, right: 16 },
    paged: true,
  };
  const pages = pagesOf(go(), room);
  assert.equal(pages.shape, 'one');
  const list = spotOf('list', pages, room);
  assert.deepEqual([list.shown, list.back, list.width], [true, 'call', 423]);
  const deeper = pagesOf(go({ to: 'topic', id: A }), room);
  assert.equal(spotOf('list', deeper, room).offset.x, -455);
  assert.equal(spotOf('topic', deeper, room).back, 'list');
});

test('the phone’s sheet: a page waits a third behind, and Back goes a level up', () => {
  const pages = pagesOf(go({ to: 'topic', id: A }), sheet, false);
  const list = spotOf('list', pages, sheet);
  const task = spotOf('topic', pages, sheet);
  assert.equal(list.offset.x, -440 / 3);
  assert.equal(list.back, undefined);
  assert.deepEqual([task.offset.x, task.back], [0, 'list']);
  assert.equal(spotOf('thread', pages, sheet).offset.x, 440);
});

test('writing focuses the composer once, and going back lets it go', () => {
  const writing = go({ to: 'topic', id: A }, { to: 'thread', write: true });
  assert.equal(writing.focusComposer, true);
  assert.equal(move(writing, { to: 'composerFocused' }).focusComposer, false);
  assert.equal(move(writing, { to: 'back' }).focusComposer, false);
});

test('a page ending at the fold keeps nothing clear below it, and Back always says where it goes', () => {
  const typing = roomOf(openOnSideDuo.beside!.typing!);
  assert.equal(spotOf('list', pagesOf(go(), typing), typing).foot, 0);
  const beside = roomOf(openOnSideDuo.beside!.tasks);
  assert.equal(spotOf('list', pagesOf(go(), beside), beside).back, 'call');
});

test('on its side, flat or partly open, Tasks is one page: the list fills it and a topic pushes over it', () => {
  for (const active of [false, true]) {
    const page = screenLayout(
      { width: 669, height: 951 },
      { top: 82, right: 0, bottom: 34, left: 0 },
      { regular: true, fold: { x: 0, y: 455.5, width: 669, height: 40, active } },
    ).duo!.tasks;
    const room = roomOf(page);
    assert.equal(room.split, undefined);
    assert.deepEqual(onScreen(go(), room), ['list']);
    assert.deepEqual(onScreen(go({ to: 'topic', id: A }), room), ['topic']);
    const topic = spotOf('topic', pagesOf(go({ to: 'topic', id: A }), room), room);
    assert.deepEqual([topic.back, topic.width], ['list', 669]);
  }
});
