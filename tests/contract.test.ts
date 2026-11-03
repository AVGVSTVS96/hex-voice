import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { AgentActivity } from '../src/live/agents';
import { AskList, Check } from '../src/live/asks';
import {
  CallList,
  CallRecord,
  ENDINGS,
  SOURCES,
  callDetails,
  callName,
  timeline,
} from '../src/live/calls';
import { Chat, STATE_WORDS, Task, TaskCounts, TaskList, stepMark } from '../src/live/tasks';

// tests/fixtures holds real answers from hex's voice server, scrubbed (tests/fixtures/capture.mts).
const real = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), 'utf8'));

test('every answer hex gives today reads in this app', () => {
  for (const [name, schema] of [
    ['calls', CallList],
    ['call', CallRecord],
    ['tasks', TaskList],
    ['tasks-summary', TaskCounts],
    ['task', Task],
    ['chat', Chat],
    ['asks', AskList],
    ['check', Check],
    ['activity', AgentActivity],
  ] as const) {
    const answer = schema.safeParse(real(name));
    assert.ok(answer.success, `${name}: ${answer.error?.message}`);
  }
});

test('every call hex lists shows where it came from and how it ended', () => {
  const { calls } = CallList.parse(real('calls'));
  for (const call of calls) {
    assert.ok(SOURCES[call.from].symbol, call.from);
    if (call.end) assert.ok(ENDINGS[call.end].line, call.end);
    assert.ok(callName(call) && callDetails(call));
  }
});

test('a Discord call, as hex records one from its Discord voice channel, says so', () => {
  const call = CallRecord.parse({ ...(real('call') as object), from: 'discord' });
  assert.equal(SOURCES[call.from].started, 'You called from Discord');
});

test('a value hex adds later reads as the nearest one this app knows, and no list fails over it', () => {
  const record = CallRecord.parse({
    ...(real('call') as object),
    from: 'zoom',
    end: 'timeout',
    moments: [{ at: 1, kind: 'joined', text: 'Someone joined' }],
  });
  assert.equal(SOURCES[record.from].symbol, 'phone');
  assert.equal(record.end, undefined);
  assert.equal(timeline(record).filter((moment) => moment.kind === 'mark').length, 0);

  const [row] = TaskList.parse({
    version: 1,
    tasks: [{ ...(real('tasks') as { tasks: object[] }).tasks[0], state: 'paused' }],
  }).tasks;
  assert.equal(STATE_WORDS[row!.state], 'idle');

  const task = Task.parse({
    ...(real('task') as object),
    steps: [
      { at: '2026-11-03T08:00:00.000Z', kind: 'browse', text: 'Opened a page', state: 'odd' },
    ],
  });
  assert.equal(task.steps[0]!.kind, 'tool');
  assert.equal(stepMark(task.steps[0]!), undefined);
});
