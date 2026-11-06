import assert from 'node:assert/strict';
import test from 'node:test';

import { closed, inView, opened, type Places } from '../src/call/places';

const none: Places = { tasks: false, settings: false, front: 'tasks' };

test('where settings is a sheet, opening it leaves Tasks open beneath, and closing it brings Tasks back', () => {
  const tasks = opened(none, 'tasks', false);
  const both = opened(tasks, 'settings', false);
  assert.deepEqual(inView(both, false), { tasks: true, settings: true });
  assert.deepEqual(inView(closed(both, 'settings'), false), { tasks: true, settings: false });
});

test('where settings has a place, it and Tasks swap in one tap and only one is open', () => {
  const tasks = opened(none, 'tasks', true);
  const settings = opened(tasks, 'settings', true);
  assert.deepEqual(inView(settings, true), { tasks: false, settings: true });
  assert.deepEqual(inView(opened(settings, 'tasks', true), true), { tasks: true, settings: false });
});

test('unfolding with both open shows the one in front, and a fold brings the other back', () => {
  const both = opened(opened(none, 'tasks', false), 'settings', false);
  assert.deepEqual(inView(both, true), { tasks: false, settings: true });
  assert.deepEqual(inView(both, false), { tasks: true, settings: true });
});

test('closing keeps the closed one in front, so its place fades out', () => {
  assert.equal(closed(opened(none, 'settings', true), 'settings').front, 'settings');
});
