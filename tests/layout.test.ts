import assert from 'node:assert/strict';
import test from 'node:test';

import type { Pose } from '../modules/pose';
import { START, levelsOf, pagedRoom, spotOf } from '../src/components/tasks/pages';
import { screenLayout, type Layout } from '../src/screens/layout';
import { roomOf, type Insets, type Size } from '../src/screens/window';
import { metrics, stack } from '../src/ui/tokens';

const layoutOf = (window: Size, insets: Insets, pose: Pose) =>
  screenLayout(roomOf(pose, window, insets));

const phone = { top: 62, right: 0, bottom: 34, left: 0 };

test('the phone keeps its layout: toolbar on top, buttons under the footer, words pulled down', () => {
  const layout = layoutOf({ width: 440, height: 956 }, phone, { regular: false });
  assert.equal(layout.kind, 'single');
  assert.equal(layout.controls, 'inline');
  assert.deepEqual(layout.toolbar, { x: 24, y: 74, width: 392, axis: 'row' });
  assert.equal(layout.orb.size, Math.min(440 * 0.62, 956 * 0.34, 280));
  assert.deepEqual(layout.orb.rest, { x: 220, y: 478 });
  assert.deepEqual(layout.orb.read, { x: 50, y: 956 - 48 - 32, size: 52 });
  assert.deepEqual(layout.words, { x: 24, width: 392, top: 134 });
  assert.deepEqual(layout.footer, { x: 24, width: 392, bottom: 48 });
  assert.deepEqual(layout.agent, { x: 24, width: 392, bottom: 17 });
  assert.deepEqual(layout.calls, { width: 330, place: 'slide' });
  assert.deepEqual(layout.tasks, { width: 380, place: 'sheet' });
  assert.equal(layout.pulls, true);
});

test('iPhone Duo closed moves the toolbar and buttons into the side column, below its camera', () => {
  const layout = layoutOf(
    { width: 466, height: 678 },
    { top: 0, right: 84, bottom: 34, left: 0 },
    {
      regular: false,
      bar: 'right',
      occlusions: [
        { x: 399.7, y: 29.3, width: 37, height: 37 },
        { x: 382, y: 0, width: 84, height: 170 },
      ],
    },
  );
  assert.equal(layout.kind, 'single');
  assert.deepEqual(layout.content, { x: 0, y: 0, width: 382, height: 678 });
  // Centered on the camera at 418.2, a few points in from the inset's middle at 424, as the
  // system draws its own items.
  assert.deepEqual(layout.toolbar, {
    x: 418.2 - 24,
    y: 170,
    width: 48,
    axis: 'column',
    gaps: 'regular',
  });
  assert.deepEqual(layout.controls, {
    right: 466 - 418.2 - 32,
    bottom: 34,
    axis: 'column',
    size: 'regular',
  });
  assert.equal(layout.orb.rest.x, 191);
  assert.deepEqual(layout.calls, { width: 310, place: 'slide' });
  assert.equal(layout.tasks.place, 'page');
});

test('iPhone Duo closed on its side keeps the tools at the column top and the buttons above its camera', () => {
  const layout = layoutOf(
    { width: 678, height: 466 },
    { top: 0, right: 84, bottom: 34, left: 0 },
    {
      regular: false,
      bar: 'right',
      occlusions: [
        { x: 611.7, y: 399.7, width: 37, height: 37 },
        { x: 594, y: 384, width: 84, height: 82 },
      ],
    },
  );
  assert.equal(layout.toolbar.y, 16);
  assert.ok(layout.controls !== 'inline' && 'bottom' in layout.controls);
  assert.equal(layout.controls.bottom, 466 - 384 + 8);
});

const pad = { top: 24, right: 0, bottom: 20, left: 0 };
const iPads = {
  '11-inch portrait': { width: 834, height: 1194 },
  '11-inch landscape': { width: 1194, height: 834 },
  '13-inch portrait': { width: 1032, height: 1376 },
  '13-inch landscape': { width: 1376, height: 1032 },
};

test('iPad landscape puts the orb with its buttons under it on the leading half, the words centered on the trailing one', () => {
  const layout = layoutOf({ width: 1180, height: 820 }, pad, { regular: true });
  assert.equal(layout.kind, 'split');
  assert.equal(layout.orb.size, Math.round(820 * 0.32));
  assert.equal(layout.orb.read.x, 295);
  assert.ok(layout.controls !== 'inline' && 'center' in layout.controls);
  const buttons = layout.controls.center.open;
  assert.equal(buttons.x, 295);
  assert.ok(buttons.y - 32 > layout.orb.read.y + layout.orb.size / 2, 'buttons sit under the orb');
  assert.deepEqual(layout.words, { x: 590 + 24, width: 590 - 48, top: 24 + 16 + 48 + 16 });
  assert.equal(layout.text, 'large');
  assert.equal(layout.pulls, false);
});

test('before a call, iPad rests the orb in the middle with its buttons under it, not beside an empty page', () => {
  for (const size of [iPads['11-inch landscape'], iPads['11-inch portrait']]) {
    const layout = layoutOf(size, pad, { regular: true });
    assert.ok(layout.controls !== 'inline' && 'center' in layout.controls);
    const { rest } = layout.controls.center;
    assert.equal(layout.orb.rest.x, size.width / 2);
    assert.equal(rest.x, size.width / 2);
    assert.ok(rest.y - 32 > layout.orb.rest.y + layout.orb.size / 2, 'buttons sit under the orb');
    const middle = Math.abs(layout.orb.rest.y - size.height / 2);
    assert.ok(middle < size.height * 0.12, `orb rests near the middle (${layout.orb.rest.y})`);
  }
});

test('iPad portrait stacks the orb over the words, always shown, with no pull-down', () => {
  const layout = layoutOf(iPads['11-inch portrait'], pad, { regular: true });
  assert.equal(layout.kind, 'stacked');
  assert.equal(layout.pulls, false);
  assert.equal(layout.orb.read.x, 834 / 2);
  assert.ok(layout.words.top > layout.orb.read.y + layout.orb.size / 2);
  assert.deepEqual(layout.calls, { width: 360, place: 'beside' });
  assert.deepEqual(layout.tasks, { width: 834 - 368, place: 'beside' });
});

test('before a call, iPad either way up opens Tasks across the screen with the call waiting in a rail', () => {
  for (const size of Object.values(iPads)) {
    const inbox = layoutOf(size, pad, { regular: true }).inbox!;
    assert.equal(inbox.width, size.width - 96);
    assert.equal(inbox.orb.x, 48, 'the orb waits whole in the rail');
    assert.ok(inbox.orb.x - inbox.orb.size / 2 >= 24, 'clear of the screen’s corner');
  }
});

test('Tasks takes two thirds of a landscape iPad, and standing up leaves the call 368', () => {
  const width = (size: { width: number; height: number }) =>
    layoutOf(size, pad, { regular: true }).tasks.width;
  assert.equal(width(iPads['11-inch landscape']), 796);
  assert.equal(width(iPads['13-inch landscape']), 917);
  assert.equal(width(iPads['11-inch portrait']), 834 - 368);
  assert.equal(width(iPads['13-inch portrait']), 1032 - 368);
});

test('with a pane open the orb leaves the header and the words start under the toolbar', () => {
  const layout = layoutOf(iPads['11-inch landscape'], pad, { regular: true });
  const room = 1194 - 796;
  assert.ok(layout.orb.dock!.tasks.y > layout.besideTasks.top);
  assert.deepEqual(layout.besideTasks, { x: 24, width: room - 48, top: 24 + 16 + 48 + 16 });
});

test('with a pane open the orb sits drawn 56 just before mute, 12 from it, at every card width', () => {
  const cards = [
    { size: { width: 1210, height: 834 }, pane: 'calls', from: 360, card: 850 },
    { size: { width: 1210, height: 834 }, pane: 'tasks', from: 0, card: 403 },
    { size: { width: 834, height: 1210 }, pane: 'calls', from: 360, card: 474 },
    { size: { width: 834, height: 1210 }, pane: 'tasks', from: 0, card: 368 },
  ] as const;
  for (const { size, pane, from, card } of cards) {
    const layout = layoutOf(size, pad, { regular: true });
    assert.ok(layout.controls !== 'inline' && 'center' in layout.controls);
    const buttons = layout.controls.center[pane];
    const spot = layout.orb.dock![pane];
    const where = `${size.width} wide, ${pane}: ${card} card`;
    assert.equal(buttons.x - (56 + 12) / 2, from + card / 2, `${where}: orb and buttons centered`);
    assert.ok(spot.x - 28 - from >= 40, `${where}: the orb clear of the card's corner`);
    assert.equal(Math.round(spot.size * 0.75), 56, `${where}: drawn 56`);
    const mute = buttons.x - (60 + 12 + 64) / 2;
    assert.equal(mute - (spot.x + 28), 12, `${where}: 12 from mute`);
    assert.equal(spot.y, buttons.y, `${where}: centered on the buttons`);
  }
});

test('standing up, the words keep a readable 320 beside Tasks', () => {
  for (const size of [iPads['11-inch portrait'], iPads['13-inch portrait']])
    assert.equal(layoutOf(size, pad, { regular: true }).besideTasks.width, 320);
});

const state = (size: { width: number; height: number }) =>
  size.width > size.height ? 'landscape' : 'portrait';

test('on every iPad, with nothing, Calls or Tasks open, the call stays whole in the room left', () => {
  for (const [name, size] of Object.entries(iPads)) {
    const layout = layoutOf(size, pad, { regular: true });
    const { orb, controls } = layout;
    assert.ok(controls !== 'inline' && 'center' in controls, name);
    const rooms = {
      open: [0, size.width],
      calls: [layout.calls.width, size.width],
      tasks: [0, size.width - layout.tasks.width],
    } as const;
    const places = {
      open: { orb: { ...orb.read, size: orb.size }, words: layout.words },
      calls: { orb: orb.dock!.calls, words: layout.besideCalls },
      tasks: { orb: orb.dock!.tasks, words: layout.besideTasks },
    };
    for (const state of ['open', 'calls', 'tasks'] as const) {
      const [from, to] = rooms[state];
      const { orb: spot, words } = places[state];
      const half = (spot.size ?? orb.size) / 2;
      const where = `${name}, ${state}`;
      assert.ok(spot.x - half >= from && spot.x + half <= to, `${where}: orb in the room`);
      assert.ok(spot.y - half >= 0 && spot.y + half <= size.height, `${where}: orb on screen`);
      assert.ok(words.x >= from && words.x + words.width <= to, `${where}: words in the room`);
      assert.ok(words.width >= 320, `${where}: words readable`);
      const buttons = controls.center[state];
      const reach = stack('regular') / 2;
      assert.ok(
        buttons.x - reach >= from && buttons.x + reach <= to,
        `${where}: the whole stack in the room`,
      );
      assert.ok(buttons.y + 32 <= size.height, `${where}: buttons on screen`);
    }
    if (state(size) === 'landscape')
      assert.ok(layout.inbox && layout.inbox.width === size.width - 96, `${name}: inbox`);
  }
});

test('iPhone Duo open flat splits at the middle of the fold, with its bars down the side', () => {
  const layout = layoutOf(
    { width: 951, height: 669 },
    { top: 0, right: 84, bottom: 21, left: 0 },
    { regular: true, bar: 'right', fold: { x: 455, y: 0, width: 40, height: 669 } },
  );
  assert.equal(layout.kind, 'split');
  assert.deepEqual(layout.orb.read, { x: 237.5, y: 334.5 });
  assert.equal(layout.words.x, 483);
  assert.deepEqual(layout.calls, { width: 475, place: 'beside' });
  assert.deepEqual(layout.besideCalls, { x: 483, width: 951 - 84 - 24 - 483, top: 72 });
  assert.equal(layout.tasks.place, 'page');
});

test('iPhone Duo on a table puts the orb above the fold and the words below it', () => {
  const layout = layoutOf(
    { width: 669, height: 951 },
    { top: 54, right: 0, bottom: 34, left: 0 },
    { regular: true, fold: { x: 0, y: 455, width: 669, height: 40 } },
  );
  assert.equal(layout.kind, 'stacked');
  assert.ok(layout.words.top > 475, 'the words start past the fold');
  assert.ok(layout.orb.read.y + layout.orb.size / 2 < 475, 'the orb sits whole above it');
  assert.equal(layout.pulls, false);
  assert.equal(layout.tasks.place, 'page');
});

// iPhone Duo's four poses as its simulator reports them (rig/shoot poses): the window, the safe area
// and the pose.
const duo = {
  'folded upright': {
    window: { width: 466, height: 678 },
    insets: { top: 0, right: 84, bottom: 34, left: 0 },
    pose: {
      regular: false,
      bar: 'right',
      occlusions: [
        { x: 399.7, y: 29.3, width: 37, height: 37 },
        { x: 382, y: 0, width: 84, height: 170 },
      ],
    },
  },
  'folded on its side': {
    window: { width: 678, height: 466 },
    insets: { top: 0, right: 84, bottom: 34, left: 0 },
    pose: {
      regular: false,
      bar: 'right',
      occlusions: [
        { x: 611.7, y: 399.7, width: 37, height: 37 },
        { x: 594, y: 384, width: 84, height: 82 },
      ],
    },
  },
  'open upright': {
    window: { width: 951, height: 669 },
    insets: { top: 0, right: 84, bottom: 34, left: 0 },
    pose: {
      regular: true,
      bar: 'right',
      fold: { x: 455.5, y: 0, width: 40, height: 669 },
      occlusions: [{ x: 867, y: 0, width: 84, height: 120 }],
    },
  },
  'open on its side': {
    window: { width: 669, height: 951 },
    insets: { top: 82, right: 0, bottom: 34, left: 0 },
    pose: {
      regular: true,
      fold: { x: 0, y: 455.5, width: 669, height: 40 },
      occlusions: [{ x: 535, y: 0, width: 134, height: 82 }],
    },
  },
} satisfies Record<string, { window: Size; insets: Insets; pose: Pose }>;

// The panes iOS arranges the open screen into held wide flat, as the simulator reports them
// (arrange-proto 90789e4): they meet on the crease.
const arranged = { first: { x: 0, width: 475.5 }, second: { x: 475.5, width: 475.5 } };

type Box = { x: number; y: number; width: number; height: number };

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const around = (x: number, y: number, width: number, height = width) => ({
  x: x - width / 2,
  y: y - height / 2,
  width,
  height,
});

// What sits in the bar with Tasks open on a call: the tools, the call buttons, the docked orb with
// its time and, open, the words' switch.
const bar = (layout: Layout, window: Size) => {
  const { toolbar, controls, duo } = layout;
  const call = duo!.call;
  const placed: Record<string, Box> = {
    orb: around(call.orb.x, call.orb.y, call.orb.size),
    time: { x: call.time.x, y: call.time.y, width: call.time.width, height: 16 },
  };
  if (duo!.beside) placed.switch = around(duo!.beside.button.x, duo!.beside.button.y, 48);
  if (toolbar.axis === 'column') {
    const { tools, group } = metrics.toolbar[toolbar.gaps!];
    placed.tools = { x: toolbar.x, y: toolbar.y, width: 48, height: 4 * 48 + tools + 2 * group };
    assert.ok(controls !== 'inline' && 'bottom' in controls);
    const end = metrics[metrics.controls[controls.size!].call];
    const height = stack(controls.size!);
    const x = window.width - controls.right - 32;
    placed.buttons = { ...around(x, 0, end), y: window.height - controls.bottom - height, height };
  } else {
    placed.calls = { x: toolbar.x, y: toolbar.y, width: 48, height: 48 };
    placed.pair = { x: toolbar.x + toolbar.width - 168, y: toolbar.y, width: 168, height: 48 };
    const { right, top } = call.controls!;
    placed.buttons = {
      x: window.width - right - stack('tool'),
      y: top,
      width: stack('tool'),
      height: 48,
    };
  }
  return placed;
};

test('on iPhone Duo, Tasks reaches the bar but never under its buttons, which keep clear of each other and the status items', () => {
  for (const [name, { window, insets, pose }] of Object.entries(duo)) {
    const layout = layoutOf(window, insets, pose);
    const placed = bar(layout, window);
    const pages = [layout.duo!.tasks, ...(layout.duo!.beside ? [layout.duo!.beside.tasks] : [])];
    for (const [what, box] of Object.entries(placed)) {
      const where = `${name}: ${what}`;
      assert.ok(box.x >= 0 && box.x + box.width <= window.width, `${where} on screen`);
      assert.ok(box.y >= 0 && box.y + box.height <= window.height, `${where} on screen`);
      for (const page of pages) assert.ok(!overlaps(page.area, box), `${where} clear of Tasks`);
      for (const status of pose.occlusions)
        assert.ok(!overlaps(status, box), `${where} clear of the status items`);
      for (const [other, them] of Object.entries(placed))
        if (other !== what) assert.ok(!overlaps(box, them), `${where} clear of ${other}`);
    }
  }
});

test('folded upright, Tasks runs from the screen edge to the column buttons and the tools start under the status items', () => {
  const { window, insets, pose } = duo['folded upright'];
  const layout = layoutOf(window, insets, pose);
  assert.equal(layout.toolbar.y, 170);
  assert.deepEqual(layout.duo!.tasks, {
    area: { x: 0, y: 0, width: 418.2 - 32, height: 678 },
    margin: { top: 0, right: 466 - (418.2 - 32), bottom: 0, left: 0 },
    foot: 34,
  });
  assert.equal(layout.duo!.beside, undefined, 'folded, Tasks keeps the one screen');
});

test('opening the Duo upright leaves Tasks’ margins to the window as they were, so it fills the opened window in the frame it opens', () => {
  const marginOf = (pose: keyof typeof duo) => {
    const { window, insets, pose: at } = duo[pose];
    return layoutOf(window, insets, at).duo!.tasks.margin;
  };
  const folded = marginOf('folded upright');
  const open = marginOf('open upright');
  // Only the right edge moves, and only by how far the cover's camera sits from its column's middle,
  // which the open screen, with nothing in its column to center on, doesn't have.
  assert.deepEqual({ ...open, right: folded.right }, folded);
  assert.ok(Math.abs(open.right - folded.right) < 6);
});

test('folded on its side, the short column keeps the tools at its top and its smaller buttons above the status items', () => {
  const { window, insets, pose } = duo['folded on its side'];
  const layout = layoutOf(window, insets, pose);
  assert.equal(layout.toolbar.y, 16);
  assert.deepEqual(layout.duo!.tasks.area, { x: 0, y: 0, width: 630.2 - 26, height: 466 });
  assert.equal(layout.duo!.beside, undefined);
});

test('open upright, Tasks takes both pages, or the trailing one while the call’s words take the leading page', () => {
  const { window, insets, pose } = duo['open upright'];
  const layout = layoutOf(window, insets, pose);
  const { tasks, beside } = layout.duo!;
  assert.equal(layout.toolbar.y, 120, 'the tools start under the status items');
  assert.deepEqual(tasks.area, { x: 0, y: 0, width: 909 - 32, height: 669 });
  assert.deepEqual(tasks.margin, { top: 0, right: 951 - 877, bottom: 0, left: 0 });
  assert.deepEqual(beside!.tasks, {
    area: { x: 475.5, y: 0, width: 877 - 475.5, height: 669 },
    margin: { top: 0, right: 951 - 877, bottom: 0, left: 475.5 },
    foot: 34,
  });
  assert.ok(layout.words.x >= 475.5, 'alone, the words are past the middle of the fold');
  assert.deepEqual(beside!.words, {
    x: 24,
    width: 475.5 - 8 - 24,
    top: layout.words.top,
    raise: 0,
  });
});

test('open on its side, the toolbar sits in the status band level with the status items, and Tasks starts under it as one page', () => {
  const { window, insets, pose } = duo['open on its side'];
  const layout = layoutOf(window, insets, pose);
  const { toolbar } = layout;
  assert.equal(layout.kind, 'stacked');
  assert.equal(toolbar.axis, 'row');
  assert.equal(toolbar.y + 24, 48, 'level with the time and battery, drawn centered 48 down');
  assert.ok(toolbar.y + 48 <= 82, 'inside the band');
  assert.equal(toolbar.x + toolbar.width, 535 - 12, 'ending before them');
  const { tasks, beside, call } = layout.duo!;
  assert.deepEqual(tasks.area, { x: 0, y: 82, width: 669, height: 951 - 82 });
  assert.deepEqual(beside!.tasks.area, { x: 0, y: 475.5, width: 669, height: 951 - 475.5 });
  assert.equal(beside!.tasks.foot, 34, 'the bottom page');
  assert.equal(beside!.words.top, 82 + 12, 'the words start under the band');
  assert.equal(
    951 - layout.agent.bottom - beside!.words.raise,
    475.5 - 8,
    'the agent line under them ends short of the fold',
  );
  assert.deepEqual(
    call.controls,
    { right: 669 - (523 - 60 - 108 - 12), top: toolbar.y },
    'the call buttons come in before Tasks, settings and Back, which stay put',
  );
});

test('on its side, Tasks types on the page above the fold, out of the keyboard’s half', () => {
  const side = layoutOf(
    duo['open on its side'].window,
    duo['open on its side'].insets,
    duo['open on its side'].pose,
  ).duo!;
  const typing = side.beside!.typing!;
  assert.deepEqual(typing.area, { x: 0, y: 82, width: 669, height: 475.5 - 82 });
  assert.equal(typing.foot, 'fold');
  const upright = layoutOf(
    duo['open upright'].window,
    duo['open upright'].insets,
    duo['open upright'].pose,
  ).duo!;
  assert.equal(upright.beside!.typing, undefined);
});

// The fold as the window's room has it: a line, held as a box with no width or no height.
const lineOf = (window: Size, insets: Insets, pose: Pose): Box => {
  const fold = roomOf(pose, window, insets).fold!;
  return 'x' in fold
    ? { x: fold.x, y: 0, width: 0, height: window.height }
    : { x: 0, y: fold.y, width: window.width, height: 0 };
};

test('open, the orb and the words each keep a page of their own across the fold, and beside Tasks the words take the orb’s', () => {
  for (const name of ['open upright', 'open on its side'] as const) {
    const { window, insets, pose } = duo[name];
    const layout = layoutOf(window, insets, pose);
    const fold = lineOf(window, insets, pose);
    const row = fold.height > fold.width;
    const words = {
      ...layout.words,
      y: layout.words.top,
      height: window.height - layout.words.top,
    };
    const orb = around(layout.orb.read.x, layout.orb.read.y, layout.orb.size);
    assert.equal(layout.pulls, false, `${name}: the words have a page of their own`);
    assert.ok(!overlaps(orb, fold) && !overlaps(words, fold), `${name}: neither crosses the fold`);
    assert.ok(
      row ? orb.x + orb.width <= fold.x : orb.y + orb.height <= fold.y,
      `${name}: orb first`,
    );
    const beside = layout.duo!.beside!;
    const before = {
      ...beside.words,
      y: beside.words.top,
      height: (row ? window.height : fold.y) - beside.words.top,
    };
    assert.ok(!overlaps(before, fold), `${name}: the words beside Tasks keep to their page`);
    assert.ok(!overlaps(before, beside.tasks.area), `${name}: and clear of Tasks`);
  }
});

test('before a call, the open Duo rests the orb in the middle of the call, not on a page', () => {
  for (const name of ['open upright', 'open on its side'] as const) {
    const { window, insets, pose } = duo[name];
    const { orb, content } = layoutOf(window, insets, pose);
    assert.deepEqual(orb.rest, { x: content.width / 2, y: content.height / 2 }, name);
    assert.notDeepEqual(orb.rest, orb.read, `${name}: it moves to its page once there are words`);
  }
});

test('on iPhone Duo Calls never lies over the call: the call yields it an edge and rounds off against it', () => {
  for (const [name, { window, insets, pose }] of Object.entries(duo)) {
    const { calls } = layoutOf(window, insets, pose);
    assert.notEqual(calls.place, 'over', name);
  }
  const { window, insets, pose } = duo['open upright'];
  const { calls } = layoutOf(window, insets, pose);
  assert.deepEqual(calls, { width: 475.5, place: 'beside' }, 'open upright, the leading page');
});

test('on iPhone Duo, beside Calls the orb rests whole in the room the call has left, and reads clear of the words', () => {
  for (const [name, { window, insets, pose }] of Object.entries(duo)) {
    const { calls, orb, besideCalls } = layoutOf(window, insets, pose);
    if (calls.place !== 'beside') continue;
    const { x, y, size } = orb.dock!.calls;
    const resting = around(x, y, size);
    assert.ok(resting.x >= calls.width && resting.x + resting.width <= window.width, name);
    const reading = orb.dock!.read ?? orb.dock!.calls;
    const docked = around(reading.x, reading.y, reading.size);
    const words = { x: besideCalls.x, y: besideCalls.top, width: besideCalls.width, height: 400 };
    assert.ok(!overlaps(docked, words), `${name}: reads clear of the words`);
  }
});

test('open on its side, Calls comes in under the band, which stays whole above it', () => {
  const { window, insets, pose } = duo['open on its side'];
  const { calls, toolbar } = layoutOf(window, insets, pose);
  assert.equal(calls.below, insets.top);
  assert.ok(toolbar.y + 48 <= calls.below!, 'the band’s buttons sit above it');
});

test('open on its side, Calls would leave the call less than a page, so it slides over all but a peek of it, under the band', () => {
  const { window, insets, pose } = duo['open on its side'];
  const { calls, toolbar } = layoutOf(window, insets, pose);
  assert.equal(calls.place, 'slide');
  assert.equal(calls.width, window.width - 72, 'a peek of the call stays to tap back to');
  assert.ok(toolbar.y + 48 <= calls.below!, 'the band stays whole above it');
});

test('where Calls leaves the call a page under the band, it sits beside it and the words keep to the room left', () => {
  const { insets, pose } = duo['open on its side'];
  const window = { width: 900, height: 951 };
  const { calls, besideCalls } = layoutOf(window, insets, pose);
  assert.equal(calls.place, 'beside');
  assert.ok(besideCalls.x >= calls.width, 'right of Calls');
  assert.ok(besideCalls.x + besideCalls.width <= window.width, 'on screen');
});

test('the call stage lays out from its own box, wherever the screen puts it', () => {
  const { window, insets, pose } = duo['folded upright'];
  const right = layoutOf(window, insets, pose);
  const left = layoutOf(
    window,
    { ...insets, right: 0, left: 84 },
    { ...pose, bar: 'left', occlusions: [] },
  );
  assert.equal(left.content.x, 84);
  assert.deepEqual([left.orb, left.words, left.footer], [right.orb, right.words, right.footer]);
});

test('held wide, Tasks’ two pages meet where iOS’s panes meet open flat: the window’s middle', () => {
  const { window, insets, pose } = duo['open upright'];
  const { tasks, beside } = layoutOf(window, insets, pose).duo!;
  const room = pagedRoom(tasks);
  const pages = { levels: levelsOf(START, 'panes'), shape: 'panes' as const, closes: true };
  assert.equal(spotOf('list', pages, room).width, arranged.first.width);
  assert.equal(beside!.tasks.area.x, arranged.second.x);
});

test('held wide, the call takes the panes: the orb on the first, the words from the second', () => {
  const { window, insets, pose } = duo['open upright'];
  const layout = layoutOf(window, insets, pose);
  assert.deepEqual(layout.orb.read, { x: arranged.first.width / 2, y: 669 / 2 });
  assert.ok(layout.words.x >= arranged.second.x);
  const before = layout.duo!.beside!.words;
  assert.ok(before.x + before.width <= arranged.first.width);
});

test('on iPhone Duo with no call to show, Calls comes in over the whole content, short of its own page open upright', () => {
  for (const [name, { window, insets, pose }] of Object.entries(duo)) {
    const room = roomOf(pose, window, insets);
    const called = screenLayout(room);
    const { calls, content } = screenLayout(room, { call: false });
    if (name === 'open upright') assert.deepEqual(calls, called.calls, name);
    else assert.deepEqual(calls, { ...called.calls, width: content.width, place: 'over' }, name);
  }
});
