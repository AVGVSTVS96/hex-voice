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
import { Chat, STATE_WORDS, TaskCounts, TaskList, TaskOrPage, stepMark } from '../src/live/tasks';

// tests/fixtures holds real answers from hex's voice server, scrubbed (tests/fixtures/capture.mts).
const real = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), 'utf8'));

test('every answer hex gives today reads in this app', () => {
  for (const [name, schema] of [
    ['calls', CallList],
    ['call', CallRecord],
    ['tasks', TaskList],
    ['tasks-summary', TaskCounts],
    ['task', TaskOrPage],
    ['page', TaskOrPage],
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

  const task = TaskOrPage.parse({
    ...(real('task') as object),
    steps: [
      { at: '2026-11-03T08:00:00.000Z', kind: 'browse', text: 'Opened a page', state: 'odd' },
    ],
  });
  assert.ok(task.kind === 'task');
  assert.equal(task.steps[0]!.kind, 'tool');
  assert.equal(stepMark(task.steps[0]!), undefined);
});

test('a thread off the board reads as a page to read, and a task with a broken field never passes for one', () => {
  const page = TaskOrPage.parse(real('page'));
  assert.equal(page.kind, 'page');
  assert.ok(!('steps' in page) && !('running' in page));
  assert.equal(TaskOrPage.parse(real('task')).kind, 'task');
  assert.equal(TaskOrPage.safeParse({ ...(real('task') as object), steps: 'none' }).success, false);
});

test('an ask answered on a call says what its answer reached, and the undo that took one back shows nothing', () => {
  const [ask] = AskList.parse(real('asks')).asks;
  const sent = { thread: 'telegram:-1001:2583', topic: 'voiceapp', settled: 1, missed: 0 };
  const { asks } = AgentActivity.parse({
    ...(real('activity') as object),
    asks: [{ at: 1, ask, answer: 'Yes', sent }],
  });
  assert.deepEqual(asks?.[0]?.sent, sent);
  const record = CallRecord.parse({
    ...(real('call') as object),
    moments: [
      { at: 1, kind: 'answered', text: 'Yes', sent },
      { at: 2, kind: 'undone', text: 'Yes' },
    ],
  });
  assert.deepEqual(
    record.moments?.map((moment) => moment.kind),
    ['answered', 'undone'],
  );
  assert.equal(timeline(record).filter((moment) => moment.kind === 'mark').length, 0);
});
