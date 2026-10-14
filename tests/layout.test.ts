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

test('iPad landscape splits the orb and the words, with the buttons bottom right', () => {
  const layout = screenLayout(
    { width: 1180, height: 820 },
    { top: 24, right: 0, bottom: 20, left: 0 },
    { regular: true },
  );
  assert.equal(layout.kind, 'split');
  assert.deepEqual(layout.orb.read, { x: 295, y: 410 });
  assert.equal(layout.orb.size, 300);
  assert.deepEqual(layout.words, { x: 590, width: 520, top: 104 });
  assert.deepEqual(layout.controls, { right: 24, bottom: 34, axis: 'row' });
  assert.deepEqual(layout.calls, { width: 360, place: 'beside' });
  assert.deepEqual(layout.besideCalls, { x: 430, width: 680 });
  assert.equal(layout.pulls, false);
});

test('iPad landscape keeps Tasks open beside the call, the words centered in what is left', () => {
  const layout = screenLayout(
    { width: 1180, height: 820 },
    { top: 24, right: 0, bottom: 20, left: 0 },
    { regular: true },
  );
  assert.deepEqual(layout.tasks, { width: 380, place: 'beside' });
  assert.deepEqual(layout.besideTasks, { x: 70, width: 660 });
});

test('iPad portrait is the phone layout with the words kept to a readable width', () => {
  const layout = screenLayout(
    { width: 820, height: 1180 },
    { top: 24, right: 0, bottom: 20, left: 0 },
    { regular: true },
  );
  assert.equal(layout.kind, 'single');
  assert.deepEqual(layout.words, { x: 110, width: 600, top: 24 + 16 + 48 + 12 });
  assert.deepEqual(layout.calls, { width: 330, place: 'slide' });
  assert.deepEqual(layout.tasks, { width: 380, place: 'slide' });
});

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
  assert.deepEqual(layout.besideCalls, { x: 503, width: 951 - 84 - 24 - 503 });
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
