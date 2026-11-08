import assert from 'node:assert/strict';
import test from 'node:test';

import { APART, laneOf } from '../src/live/lane';
import type { Turn } from '../src/live/tasks';

const NOW = Date.parse('2026-11-03T12:00:00Z');
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();
const turn = (minutes: number, state: Turn['state']): Turn => ({ at: ago(minutes), state });

test('a lane has two kinds of mark: where its threads worked, and where a run failed', () => {
  const lane = laneOf(
    [
      [turn(30, 'working'), turn(20, 'done'), turn(19.9, 'working'), turn(10, 'done')],
      [turn(25, 'working'), turn(12, 'failed'), turn(11.9, 'needs')],
    ],
    NOW,
  );
  assert.equal(lane.spans.length, 1, 'work from two threads that touches is one stretch');
  assert.equal(lane.failures.length, 1, 'the failure is its one other mark');
  assert.deepEqual(Object.keys(lane).sort(), ['failures', 'spans']);
});

test('failures too close to tell apart keep the newest, and a quiet project is the line alone', () => {
  const lane = laneOf([[turn(10, 'failed'), turn(9.99, 'failed'), turn(600, 'failed')]], NOW);
  for (const [i, x] of lane.failures.entries()) {
    for (const other of lane.failures.slice(i + 1)) {
      assert.ok(Math.abs(x - other) >= APART);
    }
  }
  assert.deepEqual(laneOf([[turn(60, 'idle'), turn(30, 'done')]], NOW), {
    spans: [],
    failures: [],
  });
});
