import assert from 'node:assert/strict';
import test from 'node:test';

import { createAsksAPI } from '../src/live/api-client';
import {
  checkLine,
  filterAsks,
  filterCounts,
  foldNote,
  placesLine,
  stacked,
  yoursSubtitle,
  type Ask,
} from '../src/live/asks';
import { pinSections } from '../src/live/pinned';

const ask = (id: string, kind: Ask['kind'], extra: Partial<Ask> = {}): Ask => ({
  id,
  kind,
  task: 'telegram:-100:1',
  topic: 'autofork',
  at: new Date(2026, 9, 13, 7, 32).toISOString(),
  question: `${id}?`,
  options: [{ label: 'Yes' }, { label: 'No' }],
  ...extra,
});

test('the filters split asks into decisions, things only your hands can do, and things to look at', () => {
  const asks = [ask('a', 'pick'), ask('b', 'yesno'), ask('c', 'do'), ask('d', 'look')];
  assert.deepEqual(filterCounts(asks), { all: 4, decide: 2, do: 1, look: 1 });
  assert.deepEqual(
    filterAsks(asks, 'decide').map((one) => one.id),
    ['a', 'b'],
  );
  assert.deepEqual(filterAsks(asks, 'all'), asks);
});

test('the sheet says what is yours, stuck and working, and what the check did', () => {
  assert.equal(yoursSubtitle(43, 6, 4), '43 yours · 6 stuck · 4 working');
  assert.equal(yoursSubtitle(0, 0, 0), 'Nothing waits on you');
  const { did } = checkLine({
    at: new Date().toISOString(),
    why: 'a call ended',
    fixed: 4,
    flagged: 3,
  });
  assert.equal(did, 'fixed 4 · flagged 3');
});

test('several choices stack, two sit side by side, and repeats name where else they were asked', () => {
  assert.equal(
    stacked(ask('m', 'pick', { options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] })),
    true,
  );
  assert.equal(stacked(ask('y', 'yesno')), false);
  assert.equal(
    stacked(ask('l', 'yesno', { options: [{ label: 'Keep the Fly app' }, { label: 'No' }] })),
    true,
  );
  assert.equal(stacked(ask('o', 'do', { options: [{ label: 'Open the sign-in page' }] })), false);
  assert.equal(
    placesLine(['calls', 'autofork', 'General']),
    'Asked in calls, autofork and General',
  );
  assert.equal(placesLine(['calls']), undefined);
  assert.equal(
    foldNote(ask('t', 'pick', { link: 'https://t.me/c/1/2/3' }), 'Deep'),
    'Telegram’s buttons now say Answered in the app: Deep',
  );
});

test('a pinned post reads as sections: what waits on you, what runs, known problems, Done folded', () => {
  const sections = pinSections(
    [
      '📌 **calls · status** (Oct 13)',
      '',
      '**🟥 Waiting on you**',
      '• Upgrade Twilio from trial',
      '',
      'Running (Opus 5.5 high):',
      '• Twilio upgrade watcher',
      '',
      'Known: herdr fork’s sync has failed since Sep 16',
      '```',
      'claude setup-token',
      '```',
      'Done:',
      '• ✅ [Launch review](https://example.com/review) is live',
    ].join('\n'),
  );
  assert.deepEqual(
    sections.map((section) => [section.title, section.mark, section.folded]),
    [
      ['', 'idle', false],
      ['Waiting on you', 'needs', false],
      ['Running (Opus 5.5 high)', 'working', false],
      ['Known', 'failed', false],
      ['Done', 'done', true],
    ],
  );
  assert.deepEqual(sections[3]!.lines, [
    { kind: 'item', text: 'herdr fork’s sync has failed since Sep 16', mark: 'failed' },
    { kind: 'code', text: 'claude setup-token' },
  ]);
  assert.deepEqual(sections[4]!.lines[0], {
    kind: 'item',
    text: 'Launch review is live',
    mark: 'done',
    url: 'https://example.com/review',
  });
});

test('an answer, an undo and a stuck item’s action each go to hex with the app’s token', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const api = createAsksAPI({
    hexUrl: 'https://hex.example:8790/',
    token: 'secret',
    fetch: (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(null, { status: 204 });
    }) as typeof fetch,
  });
  await api.answer('telegram:-100:1:7', 'Deep');
  await api.undo('check:music');
  await api.act('t3-limit');
  assert.deepEqual(
    calls.map(({ url }) => url),
    [
      'https://hex.example:8790/asks/telegram%3A-100%3A1%3A7/answer',
      'https://hex.example:8790/asks/check%3Amusic/undo',
      'https://hex.example:8790/stuck/t3-limit/act',
    ],
  );
  assert.equal(calls[0]!.init?.body, JSON.stringify({ label: 'Deep' }));
  assert.equal((calls[0]!.init?.headers as Record<string, string>).Authorization, 'Bearer secret');
});
