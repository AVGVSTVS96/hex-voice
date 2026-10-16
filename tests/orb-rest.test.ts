import assert from 'node:assert/strict';
import test from 'node:test';

import { orbRest } from '../src/screens/orb-rest';

const center = 437;
const size = 250;

test('the orb rests on the center of the screen while nothing below reaches it', () => {
  assert.deepEqual(orbRest({ top: 122, bottom: 762 }, center, size), { y: 437, scale: 1 });
});

test('a wrap-up or the half-height sheet lifts it only as far as it must go', () => {
  assert.deepEqual(orbRest({ top: 122, bottom: 468 }, center, size), { y: 319, scale: 1 });
  assert.deepEqual(orbRest({ top: 122, bottom: 437 }, center, size), { y: 288, scale: 1 });
});

test('a room shorter than the orb shrinks it and centers it there', () => {
  const { y, scale } = orbRest({ top: 122, bottom: 372 }, center, size);
  assert.equal(y, 247);
  assert.equal(scale, (250 - 48) / 250);
});

test('held to a smaller size, it draws that size and rests where that size fits', () => {
  assert.deepEqual(orbRest({ top: 122, bottom: 437 }, center, size, 96), {
    y: 365,
    scale: 96 / 250,
  });
});
