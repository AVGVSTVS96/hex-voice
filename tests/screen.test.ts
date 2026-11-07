import assert from 'node:assert/strict';
import test from 'node:test';

import { TaskId } from '../src/live/tasks';
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
  assert.deepEqual(start({ tasks: { task: A } }).at, { task: A });
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
  assert.deepEqual(go(false, { to: 'tasks', open: true, at: { stage: 'working' } }).at, {
    stage: 'working',
  });
  assert.deepEqual(go(false, { to: 'tasks', open: true }).at, {});
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

test('Calls closes settings; settings over Calls leaves Calls open', () => {
  const settings = go(false, { to: 'settings', open: true }, { to: 'calls', open: true });
  assert.deepEqual([shown(settings, false).calls, shown(settings, false).settings], [true, false]);
  const over = step(settings, { to: 'settings', open: true }, { shared: true });
  assert.deepEqual([shown(over, true).calls, shown(over, true).settings], [true, true]);
});

test('opening a past call pulls the words, and letting them go goes back to the live call', () => {
  const past = go(false, { to: 'call', id: 'c1' });
  assert.deepEqual(past.words, { pulled: true, call: 'c1' });
  assert.deepEqual(step(past, { to: 'words', pulled: false }, { shared: false }).words, {
    pulled: false,
    call: null,
  });
  assert.deepEqual(step(past, { to: 'call', id: null }, { shared: false }).words, {
    pulled: true,
    call: null,
  });
});

test('what is open never touches the words, and the words never touch what is open', () => {
  const words = go(false, { to: 'words', pulled: true }, { to: 'call', id: 'c1' });
  const opened = step(words, { to: 'tasks', open: true }, { shared: false });
  assert.deepEqual(opened.words, words.words);
  assert.equal(step(opened, { to: 'words', pulled: false }, { shared: false }).over, 'tasks');
});
