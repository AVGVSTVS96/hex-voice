import assert from 'node:assert/strict';
import test from 'node:test';

import { columnOf } from '../src/screens/column';

const insets = { top: 0, right: 84, bottom: 34, left: 0 };

test('the column centers on the camera and the items under it, not the inset’s middle', () => {
  // Folded upright, as the simulator reports it; the time and wifi measure 418 across in its film.
  const column = columnOf({
    size: { width: 466, height: 678 },
    insets,
    bar: 'right',
    occlusions: [
      { x: 399.7, y: 29.3, width: 37, height: 37 },
      { x: 382, y: 0, width: 84, height: 170 },
    ],
  })!;
  assert.equal(Math.round(466 - 42 + column.shift), 418);
  assert.deepEqual(
    { ...column, shift: 0 },
    {
      bar: 'right',
      width: 84,
      shift: 0,
      top: 170,
      foot: 34,
      tight: false,
    },
  );
});

test('folded on its side the camera is at the column’s foot, and the column is short', () => {
  const column = columnOf({
    size: { width: 678, height: 466 },
    insets,
    bar: 'right',
    occlusions: [
      { x: 611.7, y: 399.7, width: 37, height: 37 },
      { x: 594, y: 384, width: 84, height: 82 },
    ],
  })!;
  assert.equal(Math.round(678 - 42 + column.shift), 630);
  assert.equal(column.foot, 466 - 384 + 8);
  assert.equal(column.tight, true);
});

test('with only an occlusion as wide as the column, its middle is all there is', () => {
  const column = columnOf({
    size: { width: 951, height: 669 },
    insets,
    bar: 'right',
    occlusions: [{ x: 867, y: 0, width: 84, height: 120 }],
  })!;
  assert.equal(column.shift, 0);
  assert.equal(column.top, 120);
});

test('no bar down the side, no column', () => {
  const size = { width: 669, height: 951 };
  const top = { top: 82, right: 0, bottom: 34, left: 0 };
  assert.equal(columnOf({ size, insets: top, occlusions: [] }), undefined);
});
