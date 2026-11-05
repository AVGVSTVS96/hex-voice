import assert from 'node:assert/strict';
import test from 'node:test';

import type { Pose } from '../modules/pose';
import { barOf, cardOf } from '../src/call/card';
import { screenLayout } from '../src/screens/layout';
import { metrics, radius } from '../src/ui/tokens';

type Fixture = {
  window: { width: number; height: number };
  insets: { top: number; right: number; bottom: number; left: number };
  pose: Pose;
};

const pad = { top: 24, right: 0, bottom: 20, left: 0 };
const column = { top: 0, right: 84, bottom: 34, left: 0 };
const band = { top: 82, right: 0, bottom: 34, left: 0 };
const upright = { x: 455.5, y: 0, width: 40, height: 669 };
const flat = { x: 0, y: 455.5, width: 669, height: 40 };

// Every screen the app lays out for: the phone, iPad both ways up, and iPhone Duo's poses with its
// column on either side.
const screens: Record<string, Fixture> = {
  phone: {
    window: { width: 440, height: 956 },
    insets: { top: 62, right: 0, bottom: 34, left: 0 },
    pose: { regular: false },
  },
  'iPad landscape': { window: { width: 1194, height: 834 }, insets: pad, pose: { regular: true } },
  'iPad portrait': { window: { width: 834, height: 1194 }, insets: pad, pose: { regular: true } },
  'Duo folded upright': {
    window: { width: 466, height: 678 },
    insets: column,
    pose: { regular: false, bar: 'right', occlusions: [{ x: 382, y: 0, width: 84, height: 170 }] },
  },
  'Duo folded, column leading': {
    window: { width: 466, height: 678 },
    insets: { ...column, right: 0, left: 84 },
    pose: { regular: false, bar: 'left', occlusions: [{ x: 0, y: 0, width: 84, height: 170 }] },
  },
  'Duo open upright': {
    window: { width: 951, height: 669 },
    insets: column,
    pose: { regular: true, bar: 'right', fold: { ...upright, active: false } },
  },
  'Duo open, column leading': {
    window: { width: 951, height: 669 },
    insets: { ...column, right: 0, left: 84 },
    pose: { regular: true, bar: 'left', fold: { ...upright, x: 539.5, active: false } },
  },
  'Duo partly open upright': {
    window: { width: 951, height: 669 },
    insets: column,
    pose: { regular: true, bar: 'right', fold: { ...upright, active: true } },
  },
  'Duo open on its side': {
    window: { width: 669, height: 951 },
    insets: band,
    pose: {
      regular: true,
      fold: { ...flat, active: false },
      occlusions: [{ x: 535, y: 0, width: 134, height: 82 }],
    },
  },
};

test('on every screen, the call card rounds off by the one card corner whenever Calls is in', () => {
  for (const [name, { window, insets, pose }] of Object.entries(screens)) {
    const layout = screenLayout(window, insets, pose);
    const card = cardOf(layout, 1, 0, layout.tasks.width);
    assert.equal(card.borderRadius, radius.card, name);
    assert.equal(card.left, layout.content.x + layout.calls.width, `${name}: meets Calls' edge`);
  }
});

test('on every screen, the call card rounds off against Tasks beside it, and Tasks over it leaves it whole', () => {
  for (const [name, { window, insets, pose }] of Object.entries(screens)) {
    const layout = screenLayout(window, insets, pose);
    const card = cardOf(layout, 0, 1, layout.tasks.width);
    assert.equal(card.borderRadius, layout.tasks.place === 'beside' ? radius.card : 0, name);
  }
});

test('on every screen, a call card with nothing beside it fills the screen square', () => {
  for (const [name, { window, insets, pose }] of Object.entries(screens)) {
    const layout = screenLayout(window, insets, pose);
    const card = cardOf(layout, 0, 0, layout.tasks.width);
    assert.deepEqual(
      { top: card.top, left: card.left, right: card.right, corner: card.borderRadius },
      { top: 0, left: 0, right: 0, corner: 0 },
      name,
    );
  }
});

test('what is on the call card stays put in the window unless the card slides aside', () => {
  for (const [name, { window, insets, pose }] of Object.entries(screens)) {
    const layout = screenLayout(window, insets, pose);
    const card = cardOf(layout, 1, 0, layout.tasks.width);
    const moved = layout.calls.place === 'slide' ? card.left : 0;
    assert.equal(card.left + card.stage.left, moved, name);
    assert.equal(card.top + card.stage.top, 0, name);
  }
});

// barOf takes no pane, so Tasks opening or closing can't move the bar; this checks the one place
// it keeps is clear of Tasks and holds every button.
test('on every screen, the bar across the top keeps one place clear of Tasks beside it, and Calls only carries it', () => {
  const least = 3 * metrics.tool + 2 * metrics.toolbar.row;
  for (const [name, { window, insets, pose }] of Object.entries(screens)) {
    const layout = screenLayout(window, insets, pose);
    if (layout.toolbar.axis !== 'row') continue;
    for (const drawer of [0, 0.5, 1]) {
      const { left, right } = barOf(layout, window.width, drawer);
      const end = window.width - right;
      assert.ok(end - left >= least, `${name}, Calls at ${drawer}: holds its buttons`);
      if (layout.tasks.place === 'beside' && drawer === 0)
        assert.ok(end <= window.width - layout.tasks.width, `${name}: clear of Tasks`);
    }
    if (layout.inbox)
      assert.ok(
        layout.toolbar.y + metrics.tool <= layout.inbox.top,
        `${name}: the inbox starts under the bar`,
      );
  }
});
