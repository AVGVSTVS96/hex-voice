import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { TaskId } from '../src/live/tasks';
import { startAt } from '../src/components/tasks/pages';
import { shown, start, step, type Action, type Screen } from '../src/call/screen';

const go = (shared: boolean, ...actions: Action[]) =>
  actions.reduce((now, action) => step(now, action, { shared }), start({}));
const A = TaskId.parse('a');

test('nothing is open at first, unless the link opens something', () => {
  assert.deepEqual(shown(start({}), false), {
    calls: false,
    tasks: false,
    settings: false,
    place: false,
  });
  assert.equal(shown(start({ open: 'calls' }), false).calls, true);
  assert.equal(shown(start({ tasks: { task: A } }), true).tasks, true);
  assert.deepEqual(start({ tasks: { task: A } }).pages, startAt({ task: A }));
});

test('Calls and Tasks come in one at a time: opening one closes the other', () => {
  for (const shared of [false, true]) {
    const tasks = go(shared, { to: 'calls', open: true }, { to: 'tasks', open: true });
    assert.deepEqual([shown(tasks, shared).calls, shown(tasks, shared).tasks], [false, true]);
    const calls = step(tasks, { to: 'calls', open: true }, { shared });
    assert.deepEqual([shown(calls, shared).calls, shown(calls, shared).tasks], [true, false]);
  }
});

test('closing Calls leaves Tasks alone, and closing Tasks leaves Calls alone', () => {
  const tasks = go(false, { to: 'tasks', open: true }, { to: 'calls', open: false });
  assert.equal(shown(tasks, false).tasks, true);
  const calls = go(false, { to: 'calls', open: true }, { to: 'tasks', open: false });
  assert.equal(shown(calls, false).calls, true);
});

test('Tasks opens where it was sent', () => {
  assert.deepEqual(
    go(false, { to: 'tasks', open: true, at: { stage: 'working' } }).pages,
    startAt({ stage: 'working' }),
  );
  assert.deepEqual(go(false, { to: 'tasks', open: true }).pages, startAt({}));
});

test('where settings is a sheet, opening it leaves Tasks open beneath, and closing it brings Tasks back', () => {
  const both = go(false, { to: 'tasks', open: true }, { to: 'settings', open: true });
  assert.deepEqual(shown(both, false), { calls: false, tasks: true, settings: true, place: true });
  const back = step(both, { to: 'settings', open: false }, { shared: false });
  assert.deepEqual(shown(back, false), { calls: false, tasks: true, settings: false, place: true });
});

test('where settings has a place, it and Tasks swap in one tap and only one is open', () => {
  const settings = go(true, { to: 'tasks', open: true }, { to: 'settings', open: true });
  assert.deepEqual(shown(settings, true), {
    calls: false,
    tasks: false,
    settings: true,
    place: true,
  });
  const tasks = step(settings, { to: 'tasks', open: true }, { shared: true });
  assert.deepEqual(shown(tasks, true), { calls: false, tasks: true, settings: false, place: true });
});

test('where settings has a place, closing Tasks closes the place, settings too', () => {
  const both: Screen = { ...go(false, { to: 'tasks', open: true }), settings: true };
  const closed = step(both, { to: 'tasks', open: false }, { shared: true });
  assert.equal(shown(closed, true).place, false);
});

test('unfolding with both open shows the one in front, and a fold brings the other back', () => {
  const both = go(false, { to: 'tasks', open: true }, { to: 'settings', open: true });
  assert.deepEqual([shown(both, true).tasks, shown(both, true).settings], [false, true]);
  assert.deepEqual([shown(both, false).tasks, shown(both, false).settings], [true, true]);
});

test('closing keeps the closed one in front, so its place fades out', () => {
  assert.equal(
    go(true, { to: 'settings', open: true }, { to: 'settings', open: false }).front,
    'settings',
  );
});

test('Calls closes settings; settings is a sheet over Calls, but where it has a place it takes Calls’ place', () => {
  const calls = go(false, { to: 'settings', open: true }, { to: 'calls', open: true });
  assert.deepEqual([shown(calls, false).calls, shown(calls, false).settings], [true, false]);
  const sheet = step(calls, { to: 'settings', open: true }, { shared: false });
  assert.deepEqual([shown(sheet, false).calls, shown(sheet, false).settings], [true, true]);
  const place = step(calls, { to: 'settings', open: true }, { shared: true });
  assert.deepEqual([shown(place, true).calls, shown(place, true).settings], [false, true]);
  // The sheet over Calls, unfolded: settings takes the place, and folding brings Calls back.
  assert.deepEqual([shown(sheet, true).calls, shown(sheet, true).settings], [false, true]);
});

test('where settings has a place, only one of Calls, Tasks and settings is ever lit', () => {
  const actions = [
    { to: 'calls', open: true },
    { to: 'tasks', open: true },
    { to: 'settings', open: true },
    { to: 'calls', open: false },
    { to: 'tasks', open: false },
    { to: 'settings', open: false },
  ] as const;
  for (const a of actions)
    for (const b of actions)
      for (const c of actions) {
        const now = go(true, a, b, c);
        const { calls, tasks, settings } = shown(now, true);
        assert.ok([calls, tasks, settings].filter(Boolean).length <= 1, JSON.stringify([a, b, c]));
      }
});

test('opening a past call pulls the words, and letting them go goes back to the live call', () => {
  const past = go(false, { to: 'call', id: 'c1' });
  assert.deepEqual(past.words, { pulled: true, call: 'c1', beside: false });
  assert.deepEqual(step(past, { to: 'words', pulled: false }, { shared: false }).words, {
    pulled: false,
    call: null,
    beside: false,
  });
  assert.deepEqual(step(past, { to: 'call', id: null }, { shared: false }).words, {
    pulled: true,
    call: null,
    beside: false,
  });
});

test('what is open never touches the words, and the words never touch what is open', () => {
  const words = go(false, { to: 'words', pulled: true }, { to: 'call', id: 'c1' });
  const opened = step(words, { to: 'tasks', open: true }, { shared: false });
  assert.deepEqual(opened.words, words.words);
  assert.equal(step(opened, { to: 'words', pulled: false }, { shared: false }).over, 'tasks');
});

test('the words chosen beside Tasks stay chosen as Tasks, settings and the words move, until unchosen', () => {
  const chosen = go(true, { to: 'tasks', open: true }, { to: 'beside', on: true });
  const moved = [
    { to: 'settings', open: true },
    { to: 'tasks', open: true },
    { to: 'words', pulled: false },
    { to: 'call', id: 'c1' },
  ] as const;
  const after = moved.reduce((now, action) => step(now, action, { shared: true }), chosen);
  assert.equal(after.words.beside, true);
  assert.equal(step(after, { to: 'beside', on: false }, { shared: true }).words.beside, false);
});

test('where you are in Tasks lasts through everything but opening it again', () => {
  const there = go(
    false,
    { to: 'tasks', open: true },
    { to: 'pages', move: { to: 'stage', stage: 'done' } },
    { to: 'pages', move: { to: 'search', query: 'fold' } },
    { to: 'pages', move: { to: 'topic', id: A } },
    { to: 'pages', move: { to: 'thread' } },
  );
  const others: Action[] = [
    { to: 'settings', open: true },
    { to: 'settings', open: false },
    { to: 'calls', open: true },
    { to: 'calls', open: false },
    { to: 'words', pulled: true },
    { to: 'call', id: 'c1' },
    { to: 'beside', on: true },
    { to: 'tasks', open: false },
  ];
  for (const shared of [false, true]) {
    const after = others.reduce((now, action) => step(now, action, { shared }), there);
    assert.deepEqual(after.pages, there.pages);
    assert.deepEqual(step(after, { to: 'tasks', open: true }, { shared }).pages, startAt({}));
  }
});

// The window's size picks which container shows Tasks (the iPad's pane, the sheet, the Duo's pages)
// and can swap it at any time, so none of them may keep where you are: only the screen moves it.
test('only the call screen moves through Tasks; its containers only lay out where it is', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? files(join(dir, entry.name))
        : /\.tsx?$/.test(entry.name)
          ? [join(dir, entry.name)]
          : [],
    );
  const movers = files('src').filter((file) =>
    /import \{[^}]*\b(?:move|startAt|START)\b[^}]*\} from '@\/components\/tasks\/pages'/.test(
      readFileSync(file, 'utf8'),
    ),
  );
  assert.deepEqual(movers, ['src/call/screen.ts']);
});
