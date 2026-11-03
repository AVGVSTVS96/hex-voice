import assert from 'node:assert/strict';
import test from 'node:test';

import type { Pose } from '../modules/pose';
import { screenLayout, type Layout } from '../src/screens/layout';

const phone = { top: 62, right: 0, bottom: 34, left: 0 };

test('the phone keeps its layout: toolbar on top, buttons under the footer, words pulled down', () => {
  const layout = screenLayout({ width: 440, height: 956 }, phone, { regular: false });
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
  const layout = screenLayout(
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
  assert.deepEqual(layout.toolbar, {
    x: 400,
    y: 170,
    width: 48,
    axis: 'column',
    gaps: { tools: 32, group: 16 },
  });
  assert.deepEqual(layout.controls, {
    right: 10,
    bottom: 34,
    axis: 'column',
    sizes: { mute: 60, call: 64, gap: 12 },
  });
  assert.equal(layout.orb.rest.x, 191);
  assert.deepEqual(layout.calls, { width: 310, place: 'over' });
  assert.equal(layout.tasks.place, 'page');
});

test('iPhone Duo closed on its side keeps the tools at the column top and the buttons above its camera', () => {
  const layout = screenLayout(
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
  const layout = screenLayout({ width: 1180, height: 820 }, pad, { regular: true });
  assert.equal(layout.kind, 'split');
  assert.equal(layout.orb.size, Math.round(820 * 0.32));
  assert.equal(layout.orb.read.x, 295);
  assert.ok(layout.controls !== 'inline' && 'center' in layout.controls);
  const buttons = layout.controls.center.open;
  assert.equal(buttons.x, 295);
  assert.ok(buttons.y - 32 > layout.orb.read.y + layout.orb.size / 2, 'buttons sit under the orb');
  assert.deepEqual(layout.words, { x: 590 + 24, width: 590 - 48, top: 24 + 16 + 48 + 16 });
  assert.equal(layout.text, 19);
  assert.equal(layout.pulls, false);
});

test('iPad portrait stacks the orb over the words, always shown, with no pull-down', () => {
  const layout = screenLayout(iPads['11-inch portrait'], pad, { regular: true });
  assert.equal(layout.kind, 'stacked');
  assert.equal(layout.pulls, false);
  assert.equal(layout.orb.read.x, 834 / 2);
  assert.ok(layout.words.top > layout.orb.read.y + layout.orb.size / 2);
  assert.deepEqual(layout.calls, { width: 360, place: 'beside' });
  assert.deepEqual(layout.tasks, { width: 834 - 368, place: 'beside' });
  assert.equal(layout.inbox, undefined);
});

test('Tasks takes two thirds of a landscape iPad, and standing up leaves the call 368', () => {
  const width = (size: { width: number; height: number }) =>
    screenLayout(size, pad, { regular: true }).tasks.width;
  assert.equal(width(iPads['11-inch landscape']), 796);
  assert.equal(width(iPads['13-inch landscape']), 917);
  assert.equal(width(iPads['11-inch portrait']), 834 - 368);
  assert.equal(width(iPads['13-inch portrait']), 1032 - 368);
});

test('with a pane open the orb leaves the header and the words start under the toolbar', () => {
  const layout = screenLayout(iPads['11-inch landscape'], pad, { regular: true });
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
    const layout = screenLayout(size, pad, { regular: true });
    assert.ok(layout.controls !== 'inline' && 'center' in layout.controls);
    const buttons = layout.controls.center[pane];
    const spot = layout.orb.dock![pane];
    const where = `${size.width} wide, ${pane}: ${card} card`;
    assert.equal(buttons.x, from + card / 2, where);
    assert.equal(Math.round(spot.size * 0.75), 56, `${where}: drawn 56`);
    const mute = buttons.x - (60 + 12 + 64) / 2;
    assert.equal(mute - (spot.x + 28), 12, `${where}: 12 from mute`);
    assert.equal(spot.y, buttons.y, `${where}: centered on the buttons`);
  }
});

test('standing up, the words keep a readable 320 beside Tasks', () => {
  for (const size of [iPads['11-inch portrait'], iPads['13-inch portrait']])
    assert.equal(screenLayout(size, pad, { regular: true }).besideTasks.width, 320);
});

test('on every iPad, with nothing, Calls or Tasks open, the call stays whole in the room left', () => {
  for (const [name, size] of Object.entries(iPads)) {
    const layout = screenLayout(size, pad, { regular: true });
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
      assert.ok(buttons.x - 68 >= from && buttons.x + 68 <= to, `${where}: buttons in the room`);
      assert.ok(buttons.y + 32 <= size.height, `${where}: buttons on screen`);
    }
    if (state(size) === 'landscape')
      assert.ok(layout.inbox && layout.inbox.width === size.width - 96, `${name}: inbox`);
  }
});

function state(size: { width: number; height: number }) {
  return size.width > size.height ? 'landscape' : 'portrait';
}

test('iPhone Duo open splits at the fold, with its bars down the side', () => {
  const layout = screenLayout(
    { width: 951, height: 669 },
    { top: 0, right: 84, bottom: 21, left: 0 },
    { regular: true, bar: 'right', fold: { x: 455, y: 0, width: 40, height: 669, active: false } },
  );
  assert.equal(layout.kind, 'split');
  assert.deepEqual(layout.orb.read, { x: 227.5, y: 334.5 });
  assert.equal(layout.words.x, 503);
  assert.deepEqual(layout.calls, { width: 455, place: 'over' });
  assert.deepEqual(layout.besideCalls, { x: 503, width: 951 - 84 - 24 - 503, top: 72 });
  assert.equal(layout.tasks.place, 'page');
});

test('iPhone Duo on a table puts the orb above the fold and the words below it', () => {
  const layout = screenLayout(
    { width: 669, height: 951 },
    { top: 54, right: 0, bottom: 34, left: 0 },
    { regular: true, fold: { x: 0, y: 455, width: 669, height: 40, active: true } },
  );
  assert.equal(layout.kind, 'stacked');
  assert.equal(layout.words.top, 503);
  assert.ok(layout.orb.read.y < 455);
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
      fold: { x: 455.5, y: 0, width: 40, height: 669, active: false },
      occlusions: [{ x: 867, y: 0, width: 84, height: 120 }],
    },
  },
  'open on its side': {
    window: { width: 669, height: 951 },
    insets: { top: 82, right: 0, bottom: 34, left: 0 },
    pose: {
      regular: true,
      fold: { x: 0, y: 455.5, width: 669, height: 40, active: false },
      occlusions: [{ x: 535, y: 0, width: 134, height: 82 }],
    },
  },
} satisfies Record<string, { window: Size; insets: Insets; pose: Pose }>;

type Size = { width: number; height: number };
type Insets = { top: number; right: number; bottom: number; left: number };
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
function bar(layout: Layout, window: Size) {
  const { toolbar, controls, duo } = layout;
  const call = duo!.call;
  const placed: Record<string, Box> = {
    orb: around(call.orb.x, call.orb.y, call.orb.size),
    time: { x: call.time.x, y: call.time.y, width: call.time.width, height: 16 },
  };
  if (duo!.beside) placed.switch = around(duo!.beside.button.x, duo!.beside.button.y, 48);
  if (toolbar.axis === 'column') {
    const { tools, group } = toolbar.gaps!;
    placed.tools = { x: toolbar.x, y: toolbar.y, width: 48, height: 3 * 48 + tools + group };
    assert.ok(controls !== 'inline' && 'bottom' in controls);
    const { mute, call: end, gap } = controls.sizes!;
    const height = mute + gap + end;
    const x = window.width - controls.right - 32;
    placed.buttons = { ...around(x, 0, end), y: window.height - controls.bottom - height, height };
  } else {
    placed.tools = { x: toolbar.x, y: toolbar.y, width: 3 * 48 + 2 * 12, height: 48 };
    const { right, top } = call.controls!;
    placed.buttons = { x: window.width - right - 108, y: top, width: 108, height: 48 };
  }
  return placed;
}

test('on iPhone Duo, Tasks reaches the bar but never under its buttons, which keep clear of each other and the status items', () => {
  for (const [name, { window, insets, pose }] of Object.entries(duo)) {
    const layout = screenLayout(window, insets, pose);
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
  const layout = screenLayout(window, insets, pose);
  assert.equal(layout.toolbar.y, 170);
  assert.deepEqual(layout.duo!.tasks, {
    area: { x: 0, y: 0, width: 424 - 32, height: 678 },
    inset: { left: 0, right: 0 },
    top: 0,
    foot: 34,
  });
  assert.equal(layout.duo!.beside, undefined, 'folded, Tasks keeps the one screen');
});

test('folded on its side, the short column keeps the tools at its top and its smaller buttons above the status items', () => {
  const { window, insets, pose } = duo['folded on its side'];
  const layout = screenLayout(window, insets, pose);
  assert.equal(layout.toolbar.y, 16);
  assert.deepEqual(layout.duo!.tasks.area, { x: 0, y: 0, width: 636 - 26, height: 466 });
  assert.equal(layout.duo!.beside, undefined);
});

test('open upright, Tasks takes both pages, or the leading one while the words keep the trailing page', () => {
  const { window, insets, pose } = duo['open upright'];
  const layout = screenLayout(window, insets, pose);
  const { tasks, beside } = layout.duo!;
  assert.equal(layout.toolbar.y, 120, 'the tools start under the status items');
  assert.deepEqual(tasks.area, { x: 0, y: 0, width: 909 - 32, height: 669 });
  assert.deepEqual(tasks.fold, { axis: 'row', at: 455.5, band: 40 });
  assert.deepEqual(beside!.tasks, {
    area: { x: 0, y: 0, width: 455.5, height: 669 },
    inset: { left: 0, right: 0 },
    top: 0,
    foot: 34,
  });
  assert.deepEqual(layout.besideTasks, layout.words, 'the words keep their page beside Tasks');
  assert.ok(layout.words.x >= 455.5 + 40, 'past the fold');
});

test('open on its side, the toolbar sits in the status band level with the status items, and Tasks starts under it', () => {
  const { window, insets, pose } = duo['open on its side'];
  const layout = screenLayout(window, insets, pose);
  const { toolbar } = layout;
  assert.equal(layout.kind, 'stacked');
  assert.equal(toolbar.axis, 'row');
  assert.equal(toolbar.y + 24, 48, 'level with the time and battery, drawn centered 48 down');
  assert.ok(toolbar.y + 48 <= 82, 'inside the band');
  assert.equal(toolbar.x + toolbar.width, 535 - 12, 'ending before them');
  const { tasks, beside, call } = layout.duo!;
  assert.deepEqual(tasks.area, { x: 0, y: 82, width: 669, height: 951 - 82 });
  assert.deepEqual(tasks.fold, { axis: 'column', at: 455.5 - 82, band: 40 });
  assert.deepEqual(beside!.tasks.area, { x: 0, y: 82, width: 669, height: 455.5 - 82 });
  assert.equal(beside!.tasks.foot, 'fold', 'the top page stops at the fold');
  assert.deepEqual(call.controls, { right: 669 - 523, top: toolbar.y });
});

test('open, the orb and the words each keep a page of their own off the fold, so Tasks can share the words page', () => {
  for (const name of ['open upright', 'open on its side'] as const) {
    const { window, insets, pose } = duo[name];
    const layout = screenLayout(window, insets, pose);
    const { fold } = pose;
    const row = fold.height > fold.width;
    const words = {
      ...layout.words,
      y: layout.words.top,
      height: window.height - layout.words.top,
    };
    const orb = around(layout.orb.read.x, layout.orb.read.y, layout.orb.size);
    assert.equal(layout.pulls, false, `${name}: the words always show`);
    assert.ok(!overlaps(orb, fold) && !overlaps(words, fold), `${name}: neither sits on the hinge`);
    assert.ok(
      row ? orb.x + orb.width <= fold.x : orb.y + orb.height <= fold.y,
      `${name}: orb first`,
    );
    assert.ok(!overlaps(words, layout.duo!.beside!.tasks.area), `${name}: words beside Tasks`);
    assert.deepEqual(layout.besideTasks, layout.words, `${name}: the words stay put beside Tasks`);
  }
});
