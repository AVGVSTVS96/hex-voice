import assert from 'node:assert/strict';
import test from 'node:test';

import type * as z from 'zod/mini';

import {
  checkLine,
  failedOn,
  keepInPlace,
  openAsks,
  unreached,
  wholeQuestion,
  yours,
  Ask,
  type AskList,
  type Yours,
} from '../src/live/asks';
import { pinSections } from '../src/live/pinned';

const ask = (id: string, kind: Ask['kind'], extra: Partial<z.input<typeof Ask>> = {}): Ask =>
  Ask.parse({
    id,
    kind,
    task: 'telegram:-100:1',
    app: 'telegram',
    topic: 'autofork',
    at: new Date(2026, 9, 13, 7, 32).toISOString(),
    question: `${id}?`,
    options: [{ label: 'Yes' }, { label: 'No' }],
    places: [],
    ...extra,
  });

test('the check strip says what the check did', () => {
  const { did } = checkLine({
    at: new Date().toISOString(),
    why: 'a call ended',
    fixed: 4,
    flagged: 3,
  });
  assert.equal(did, 'fixed 4 · flagged 3');
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

const list = (...ids: string[]): AskList => ({
  version: 1,
  asks: ids.map((id) => ask(id, 'yesno')),
  stuck: [],
  fresh: [],
  check: null,
});
const ids = (state: Yours) => state.list?.asks.map((one) => one.id);

test('an answered ask stays where it sat after hex drops it, folded, until the sheet closes', () => {
  let state = yours({ answered: {} }, { type: 'list', list: list('a', 'b', 'c') });
  state = yours(state, { type: 'answer', id: 'b', label: 'Done' });
  assert.deepEqual(
    openAsks(state).map((one) => one.id),
    ['a', 'c'],
  );
  state = yours(state, { type: 'list', list: list('a', 'c', 'd') });
  assert.deepEqual(ids(state), ['a', 'b', 'c', 'd']);
  assert.equal(state.answered.b, 'Done');
  state = yours(state, { type: 'close' });
  assert.deepEqual(ids(state), ['a', 'c', 'd']);
  assert.deepEqual(state.answered, {});
});

test('undo opens the card in its place and holds it there until hex lists it again', () => {
  let state = yours({ answered: {} }, { type: 'list', list: list('a', 'b') });
  state = yours(state, { type: 'answer', id: 'a', label: 'Yes' });
  state = yours(state, { type: 'list', list: list('b') });
  state = yours(state, { type: 'undo', id: 'a' });
  assert.deepEqual(
    openAsks(state).map((one) => one.id),
    ['a', 'b'],
  );
  state = yours(state, { type: 'list', list: list('b') });
  assert.deepEqual(ids(state), ['a', 'b']);
  state = yours(state, { type: 'list', list: list('b', 'a') });
  assert.deepEqual(ids(state), ['b', 'a']);
  assert.deepEqual(state.answered, {});
});

test('an answer hex could not take opens its card again', () => {
  let state = yours({ answered: {} }, { type: 'list', list: list('a') });
  state = yours(state, { type: 'answer', id: 'a', label: 'Yes' });
  state = yours(state, { type: 'failed', id: 'a' });
  assert.deepEqual(
    openAsks(state).map((one) => one.id),
    ['a'],
  );
});

test('held asks go back after the ask they followed, or first when none of those is left', () => {
  const before = ['x', 'a', 'y', 'b'].map((id) => ask(id, 'do'));
  const after = ['b', 'c'].map((id) => ask(id, 'do'));
  const held = (id: string) => id === 'x' || id === 'y';
  assert.deepEqual(
    keepInPlace(before, after, held).map((one) => one.id),
    ['x', 'y', 'b', 'c'],
  );
});

test('a pinned section’s heading drops its own emoji, which its mark already says', () => {
  const [done] = pinSections('**🟢 Done:**\n- shipped the band');
  assert.deepEqual([done!.title, done!.mark], ['Done', 'done']);
});

test('a pinned text line shows a markdown link’s label and opens its url, as an item does', () => {
  const [section] = pinSections(
    'Signed with xtool. [Paper](https://app.paper.design/file/abc)\nNo link here.',
  );
  assert.deepEqual(section!.lines, [
    { kind: 'text', text: 'Signed with xtool. Paper', url: 'https://app.paper.design/file/abc' },
    { kind: 'text', text: 'No link here.' },
  ]);
});

test('a pinned line keeps its bold and code for the screen to draw, and a title ahead of them', () => {
  const [section] = pinSections(
    '📌 **Running:** the **Mac** build of `main`\n- **iPad** needs `devicectl`',
  );
  assert.deepEqual(
    [section!.title, section!.lines.map((line) => line.kind === 'item' && line.text)],
    ['Running', ['the **Mac** build of `main`', '**iPad** needs `devicectl`']],
  );
});

test('a pinned title bold to the end of its line, colon inside, leaves no stray mark', () => {
  const [section] = pinSections('**Running: the Mac build**');
  assert.deepEqual(
    [section!.title, section!.lines.map((line) => line.kind === 'item' && line.text)],
    ['Running', ['the Mac build']],
  );
});

test('what didn’t go through shows on the item it was about, and nowhere else', () => {
  const stuck = {
    id: 's',
    app: 't3',
    title: 'Limit',
    why: '',
    action: 'Ask',
    mark: 'paused',
  } as const;
  const failed = failedOn(
    { ...list('a', 'b'), stuck: [{ ...stuck, at: '' }] },
    {
      b: 'Not answered · That question is already answered or settled',
      s: 'Not sent · No General',
    },
  );
  assert.deepEqual(
    failed.asks.map((one) => one.failed),
    [undefined, 'Not answered · That question is already answered or settled'],
  );
  assert.equal(failed.stuck[0]!.failed, 'Not sent · No General');
});

test('an answer that missed a place says how many still ask it, on that ask alone', () => {
  const shown = failedOn(list('a', 'b'), { a: 'Not sent again · Cannot reach hex' }, { a: 2 });
  assert.deepEqual(
    shown.asks.map((one) => [one.failed, one.missed]),
    [
      ['Not sent again · Cannot reach hex', 2],
      [undefined, undefined],
    ],
  );
  assert.equal(unreached(1), 'One place was out of reach and still asks it');
  assert.equal(unreached(2), '2 places were out of reach and still ask it');
});

test('an answer still missing a place stays folded through the sheet closing, and the rest go', () => {
  let state = yours({ answered: {} }, { type: 'list', list: list('a', 'b', 'c') });
  state = yours(state, { type: 'answer', id: 'a', label: 'Yes' });
  state = yours(state, { type: 'answer', id: 'b', label: 'Not needed' });
  state = yours(state, { type: 'close', keep: ['a', 'c'] });
  assert.deepEqual(ids(state), ['a', 'c']);
  assert.deepEqual(state.answered, { a: 'Yes' });
  assert.deepEqual(
    openAsks(state).map((one) => one.id),
    ['c'],
  );
});

test("an ask hex's check took up keeps the ids it was listed under, so what was typed on them follows it", () => {
  const taken = ask('check:twilio', 'yesno', { was: ['telegram:-100:1:7', 'telegram:-100:1:8'] });
  assert.deepEqual(taken.was, ['telegram:-100:1:7', 'telegram:-100:1:8']);
  assert.equal(ask('telegram:-100:1:7', 'yesno').was, undefined);
});

test('a question hex cut with … reads whole, its context carrying on after it', () => {
  assert.deepEqual(
    wholeQuestion({
      question: 'The button sits beside its search…',
      context: '…field.\nI took it out of the tray.',
    }),
    { question: 'The button sits beside its search field.', context: 'I took it out of the tray.' },
  );
  assert.deepEqual(wholeQuestion({ question: 'Ship it?', context: 'It passed.' }), {
    question: 'Ship it?',
    context: 'It passed.',
  });
});

test('a pinned line ticked with a plain ✓ is done, drawn with its mark and not the tick', () => {
  const [section] = pinSections('- ✓ Tap X and it breaks into dust');
  assert.deepEqual(section?.lines, [
    { kind: 'item', text: 'Tap X and it breaks into dust', mark: 'done' },
  ]);
});
