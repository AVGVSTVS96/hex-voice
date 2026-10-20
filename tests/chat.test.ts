import assert from 'node:assert/strict';
import test from 'node:test';

import { arrived, newKey } from '../src/live/chat';
import { blocksOf } from '../src/live/markdown';
import type { Chat } from '../src/live/tasks';

const chat = (turns: Chat['turns'], waiting: Chat['waiting'] = [], total = turns.length): Chat => ({
  version: 1,
  sends: true,
  total,
  turns,
  waiting,
});

test('what you sent shows until hex has it waiting under its key, or said after you sent it', () => {
  const sent = { key: 'app-abc12345', text: 'ship it', total: 2 };
  const before = [
    { from: 'me' as const, text: 'ship it' },
    { from: 'hex' as const, text: 'Shipped.' },
  ];
  assert.equal(arrived(chat(before), sent), false);
  assert.equal(
    arrived(chat(before, [{ key: 'telegram:app-abc12345', text: 'ship it', at: '' }]), sent),
    true,
  );
  assert.equal(arrived(chat([...before, { from: 'me', text: 'ship it' }]), sent), true);
});

test('a chat cut to its latest turns still finds what you said after you sent it', () => {
  const sent = { key: 'app-abc12345', text: 'and the docs', total: 150 };
  const latest = Array.from({ length: 100 }, (_, i) => ({ from: 'hex' as const, text: `${i}` }));
  assert.equal(arrived(chat(latest, [], 150), sent), false);
  assert.equal(
    arrived(chat([...latest.slice(1), { from: 'me', text: 'and the docs' }], [], 151), sent),
    true,
  );
});

test('app keys fit what hex takes', () => {
  assert.match(newKey(), /^app-[\w-]{8,60}$/);
});

test("hex's markdown splits into paragraphs, headings, lists, quotes and code", () => {
  assert.deepEqual(
    blocksOf(
      '## Done\n\nShipped it.\nAll green.\n\n- one\n- two\n1. first\n\n> quoted\n\n```\nnpm run check\n```',
    ),
    [
      { kind: 'heading', text: 'Done' },
      { kind: 'text', text: 'Shipped it.\nAll green.' },
      {
        kind: 'list',
        items: [
          { mark: '•', text: 'one' },
          { mark: '•', text: 'two' },
          { mark: '1.', text: 'first' },
        ],
      },
      { kind: 'quote', text: 'quoted' },
      { kind: 'code', text: 'npm run check' },
    ],
  );
});
