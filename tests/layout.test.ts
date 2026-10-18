import assert from 'node:assert/strict';
import test from 'node:test';

import { screenLayout } from '../src/screens/layout';

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
  assert.deepEqual(layout.toolbar, { x: 400, y: 170, width: 48, axis: 'column' });
  assert.deepEqual(layout.controls, { right: 10, bottom: 34, axis: 'column' });
  assert.equal(layout.orb.rest.x, 191);
  assert.deepEqual(layout.calls, { width: 310, place: 'over' });
  assert.equal(layout.tasks.place, 'sheet');
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
  assert.equal(layout.tasks.place, 'sheet');
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
  assert.equal(layout.tasks.place, 'sheet');
});
