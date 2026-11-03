import assert from 'node:assert/strict';
import test from 'node:test';

import {
  byDay,
  callLength,
  callName,
  clock,
  endedSeconds,
  liveEntries,
  putBack,
  timeline,
  transcriptText,
  CallId,
  CallSummary,
} from '../src/live/calls';

test('a phone call’s turns read as the live transcript, each keeping its place as it grows', () => {
  const turns = [
    { who: 'you' as const, at: 1000, text: 'is the build' },
    { who: 'voice' as const, at: 2500, text: 'One sec.' },
  ];
  const before = liveEntries(turns);
  const after = liveEntries([{ ...turns[0], text: 'is the build green?' }, turns[1]]);
  assert.deepEqual(before, [
    { id: 'you 1000', role: 'user', text: 'is the build', startMs: 1000 },
    { id: 'voice 2500', role: 'assistant', text: 'One sec.', startMs: 2500 },
  ]);
  assert.deepEqual(
    after.map((entry) => entry.id),
    before.map((entry) => entry.id),
  );
  assert.equal(
    endedSeconds({ started: '2026-10-14T06:00:00.000Z', ended: '2026-10-14T06:03:05.400Z' }),
    185,
  );
});

const call = (id: string, started: string): CallSummary =>
  CallSummary.parse({
    id,
    started,
    from: 'app',
    seconds: 60,
    tasks: 0,
    preview: 'Is the build green?',
  });

test('calls group by day, newest first, as hex sends them', () => {
  const now = new Date(2026, 9, 13, 9);
  const days = byDay(
    [
      call('a', new Date(2026, 9, 13, 3, 5).toISOString()),
      call('b', new Date(2026, 9, 13, 1, 31).toISOString()),
      call('c', new Date(2026, 9, 12, 23, 36).toISOString()),
      call('d', new Date(2026, 8, 30, 12).toISOString()),
    ],
    now,
  );
  assert.deepEqual(
    days.map((day) => [day.label, day.calls.map(({ id }) => id)]),
    [
      ['Today', ['a', 'b']],
      ['Yesterday', ['c']],
      ['September 30', ['d']],
    ],
  );
});

test('a call reads as its title, or your first words until hex names it', () => {
  assert.equal(callName({ title: 'Build check', preview: 'Is the build green?' }), 'Build check');
  assert.equal(callName({ preview: 'Is the build green?' }), 'Is the build green?');
  assert.equal(callLength(14), '14 sec');
  assert.equal(callLength(13 * 60 + 20), '13 min');
  assert.equal(callLength(49 * 60), '49 min');
  assert.equal(callLength(75 * 60), '1 hr 15 min');
  assert.equal(clock(61_200), '1:01');
});

test('each of hex’s tasks is one marker where it started, showing how it ended up', () => {
  const moments = timeline({
    turns: [
      { who: 'you', at: 3000, text: 'Make a plan' },
      { who: 'voice', at: 9000, text: 'Plan’s up.' },
    ],
    tasks: [
      { id: 'plan', state: 'running', at: 4000, text: 'writing the plan' },
      { id: 'plan', state: 'done', at: 12000, text: 'plan page ready' },
    ],
  });
  assert.deepEqual(
    moments.map((moment) => (moment.kind === 'task' ? moment.task : moment.kind)),
    ['turn', { id: 'plan', state: 'done', at: 4000, text: 'plan page ready' }, 'turn'],
  );
});

test('a call shows when the phone took its audio and the time-limit warning, and its copy leads with hex’s wrap-up', () => {
  const call = {
    id: CallId.parse('live_1'),
    started: '2026-10-13T10:00:00.000Z',
    from: 'app' as const,
    summary: 'Checked CI and sent the PR to Telegram.',
    waiting: ['Merge the PR'],
    turns: [{ who: 'you' as const, at: 1000, text: 'Is CI green?' }],
    tasks: [],
    moments: [
      { at: 2000, kind: 'say' as const, text: 'CI is green.' },
      { at: 3000, kind: 'paused' as const, text: 'Your phone took over the audio' },
      { at: 9000, kind: 'resumed' as const, text: 'Back on the call' },
    ],
  };
  assert.deepEqual(
    timeline(call).map((moment) => moment.kind),
    ['turn', 'mark', 'mark'],
  );
  assert.equal(
    transcriptText(call),
    'Checked CI and sent the PR to Telegram.\nWaiting on you:\n- Merge the PR\n\nYou: Is CI green?\n\n[Your phone took over the audio]\n\n[Back on the call]',
  );
});

test('a call that wouldn’t delete goes back where it sat, newest first', () => {
  const at = (id: string, day: number) => call(id, new Date(2026, 9, day, 9).toISOString());
  const [c, b, a] = [at('c', 14), at('b', 13), at('a', 12)];
  const ids = (calls: CallSummary[]) => calls.map(({ id }) => id);
  assert.deepEqual(ids(putBack([c, a], b)), ['c', 'b', 'a']);
  assert.deepEqual(ids(putBack([b, a], c)), ['c', 'b', 'a']);
  assert.deepEqual(ids(putBack([c, b], a)), ['c', 'b', 'a']);
});
