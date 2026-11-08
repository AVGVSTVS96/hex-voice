import assert from 'node:assert/strict';
import test from 'node:test';

import type { Pose } from '../modules/pose';
import { barOf, cardOf } from '../src/call/card';
import { screenLayout } from '../src/screens/layout';
import { roomOf } from '../src/screens/window';
import type { Insets, Size } from '../src/screens/window';
import { metrics, radius } from '../src/ui/tokens';

interface Fixture {
  window: Size;
  insets: Insets;
  pose: Pose;
}

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
    pose: { regular: true, bar: 'right', fold: { ...upright } },
  },
  'Duo open, column leading': {
    window: { width: 951, height: 669 },
    insets: { ...column, right: 0, left: 84 },
    pose: { regular: true, bar: 'left', fold: { ...upright, x: 539.5 } },
  },
  'Duo partly open upright': {
    window: { width: 951, height: 669 },
    insets: column,
    pose: { regular: true, bar: 'right', fold: { ...upright } },
  },
  'Duo open on its side': {
    window: { width: 669, height: 951 },
    insets: band,
    pose: {
      regular: true,
      fold: { ...flat },
      occlusions: [{ x: 535, y: 0, width: 134, height: 82 }],
    },
  },
};

const layoutOf = ({ window, insets, pose }: Fixture) => screenLayout(roomOf(pose, window, insets));

test('on every screen, the call card rounds off by the one card corner whenever Calls is in, and meets Calls’ edge', () => {
  for (const [name, screen] of Object.entries(screens)) {
    const layout = layoutOf(screen);
    const card = cardOf(layout, 1, 0, layout.tasks.width);
    assert.equal(card.borderRadius, radius.card, name);
    assert.equal(card.left, layout.content.x + layout.calls.width, `${name}: meets Calls' edge`);
  }
});

test('on every screen, the call card rounds off against Tasks beside it, and Tasks over it leaves it whole', () => {
  for (const [name, screen] of Object.entries(screens)) {
    const layout = layoutOf(screen);
    const card = cardOf(layout, 0, 1, layout.tasks.width);
    assert.equal(card.borderRadius, layout.tasks.place === 'beside' ? radius.card : 0, name);
  }
});

test('on every screen, a call card with nothing beside it fills the screen square', () => {
  for (const [name, screen] of Object.entries(screens)) {
    const layout = layoutOf(screen);
    const card = cardOf(layout, 0, 0, layout.tasks.width);
    assert.deepEqual(
      { top: card.top, left: card.left, right: card.right, corner: card.borderRadius },
      { top: 0, left: 0, right: 0, corner: 0 },
      name,
    );
    assert.equal(card.stage.left, layout.content.x, `${name}: the stage sits on the content`);
  }
});

test('what is on the call card stays put in the window unless the card slides aside to Calls’ edge', () => {
  for (const [name, screen] of Object.entries(screens)) {
    const layout = layoutOf(screen);

    for (const drawer of [0.5, 1]) {
      const card = cardOf(layout, drawer, 0, layout.tasks.width);
      const slid = layout.calls.place === 'slide' ? drawer * layout.calls.width : 0;
      assert.equal(card.left + card.stage.left, layout.content.x + slid, `${name} at ${drawer}`);
      assert.equal(card.top + card.stage.top, 0, `${name} at ${drawer}`);

      if (layout.calls.place === 'slide' && drawer === 1) {
        assert.equal(card.stage.left, 0, `${name}: the call's content peeks from Calls' edge`);
      }
    }
  }
});

// The same rule in every window the app could be given, with or without a side column on either
// side and with or without a fold: there is no screen or pose where Calls leaves the card square
// or the card covers any of Calls.
test('in any window, Calls in rounds the card at Calls’ edge, and nothing in leaves it square', () => {
  const problems: string[] = [];

  for (const width of [375, 440, 466, 669, 834, 951, 1194]) {
    for (const height of [466, 669, 678, 834, 951, 1194]) {
      for (const side of [undefined, 'left', 'right'] as const) {
        for (const folded of [false, true]) {
          const across = width > height;

          const fold = folded
            ? across
              ? { x: width / 2 - 20, y: 0, width: 40, height }
              : { x: 0, y: height / 2 - 20, width, height: 40 }
            : undefined;

          const layout = layoutOf({
            window: { width, height },
            insets: {
              top: side ? 0 : 24,
              bottom: 20,
              left: side === 'left' ? 84 : 0,
              right: side === 'right' ? 84 : 0,
            },
            pose: { regular: width >= 669, bar: side, fold },
          });

          const name = `${width}x${height} ${side ?? 'no'} column${folded ? ', folded' : ''}`;
          const calls = cardOf(layout, 1, 0, layout.tasks.width);

          if (calls.borderRadius !== radius.card) {
            problems.push(`${name}: Calls in, square`);
          }

          if (calls.left !== layout.content.x + layout.calls.width) {
            problems.push(`${name}: card at ${calls.left}, Calls ends at ${layout.calls.width}`);
          }

          if (cardOf(layout, 0, 0, layout.tasks.width).borderRadius !== 0) {
            problems.push(`${name}: nothing in, rounded`);
          }
        }
      }
    }
  }

  assert.deepEqual(problems, []);
});

// barOf takes no pane, so Tasks opening or closing can't move the bar; this checks the one place
// it keeps is clear of Tasks and holds every button.
test('on every screen, the bar across the top keeps one place clear of Tasks beside it, and Calls only carries it', () => {
  const least = 3 * metrics.tool + 2 * metrics.toolbar.row;

  for (const [name, screen] of Object.entries(screens)) {
    const layout = layoutOf(screen);
    const { toolbar, calls, tasks } = layout;

    if (toolbar.axis !== 'row') {
      continue;
    }

    const window = screen.window.width;

    for (const drawer of [0, 0.5, 1]) {
      const { left, right } = barOf(layout, window, drawer);
      const end = window - right;
      const where = `${name}, Calls at ${drawer}`;
      assert.ok(end - left >= least, `${where}: holds its buttons`);

      if (calls.below !== undefined) {
        assert.deepEqual([left, end], [toolbar.x, toolbar.x + toolbar.width], `${where}: whole`);
      }

      if (drawer === 0) {
        assert.ok(left >= 0 && end <= window, `${where}: inside the window`);

        if (tasks.place === 'beside') {
          assert.ok(end <= window - tasks.width, `${where}: clear of Tasks`);
        }
      }
    }

    if (layout.inbox) {
      assert.ok(
        toolbar.y + metrics.tool <= layout.inbox.top,
        `${name}: the inbox starts under the bar`,
      );
    }
  }
});

test('Calls coming in over the call leaves the card where it is', () => {
  for (const [name, screen] of Object.entries(screens)) {
    const layout = layoutOf(screen);
    const over = { ...layout, calls: { width: layout.content.width, place: 'over' as const } };
    assert.deepEqual(
      cardOf(over, 1, 0, layout.tasks.width),
      cardOf(over, 0, 0, layout.tasks.width),
      name,
    );
  }
});
