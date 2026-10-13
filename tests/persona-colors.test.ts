import assert from 'node:assert/strict';
import test from 'node:test';

import { OPAL_PALETTES, PERSONA_COLORS } from '../src/components/persona/variants';

test('every persona fills the same number of color slots', () => {
  assert.equal(PERSONA_COLORS.length + 1, OPAL_PALETTES.length);
});
