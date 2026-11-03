import assert from 'node:assert/strict';
import test from 'node:test';

import { laneOf } from '../src/live/lane';
import type { Turn } from '../src/live/tasks';

const NOW = Date.parse('2026-11-03T12:00:00Z');
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
const turn = (minutes: number, state: Turn['state']): Turn => ({ at: ago(minutes), state });

test('a project’s threads share one lane: touching work merges, and no two marks crowd', () => {
  const lane = laneOf(
    [
      [turn(30, 'working'), turn(20, 'done'), turn(19.9, 'working'), turn(10, 'done')],
      [turn(25, 'working'), turn(10.05, 'failed')],
    ],
    NOW,
    120,
  );
  assert.equal(lane.spans.length, 1, 'overlapping work from two threads is one stretch');
  for (const [i, end] of lane.ends.entries())
    for (const other of lane.ends.slice(i + 1))
      assert.ok(Math.abs(end.x - other.x) >= 7, 'marks keep apart');
  assert.ok(
    lane.ends.some((end) => end.failed),
    'a failure folded into a nearby mark still shows',
  );
});

test('the ring marks only the newest time it asked, and nothing sits on it', () => {
  const lane = laneOf(
    [[turn(600, 'needs'), turn(500, 'working'), turn(5, 'done'), turn(4.9, 'needs')]],
    NOW,
    120,
  );
  assert.ok(lane.asked !== undefined && lane.asked > 100, 'the latest ask, near now');
  assert.ok(lane.ends.every((end) => Math.abs(end.x - lane.asked!) >= 7));
  const idle = laneOf([[turn(60, 'idle')]], NOW, 120);
  assert.deepEqual(idle, { spans: [], ends: [], asked: undefined });
});

test('a run’s end inside a stretch of work isn’t marked, unless it failed', () => {
  const lane = laneOf(
    [[turn(120, 'working'), turn(60, 'done'), turn(59.5, 'working'), turn(30, 'done')]],
    NOW,
    120,
  );
  const [span] = lane.spans;
  assert.ok(span);
  assert.ok(
    lane.ends.every((end) => end.x < span.from - 3 || end.x > span.to + 3),
    'no grey dot sits on the mint',
  );
  const failed = laneOf(
    [[turn(120, 'working'), turn(60, 'failed'), turn(59.5, 'working')]],
    NOW,
    120,
  );
  assert.ok(
    failed.ends.some((end) => end.failed),
    'a failure inside it still shows',
  );
});
