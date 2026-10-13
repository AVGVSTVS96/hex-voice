import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import {
  OPAL_PALETTES,
  PERSONA_COLORS,
  PERSONA_VARIANTS,
} from '../src/components/persona/variants';
import { activityOrb } from '../src/live/activity-orb';

test('every persona look has its Live Activity orb bundled', () => {
  for (const { id: variant } of PERSONA_VARIANTS)
    for (const { id: color } of PERSONA_COLORS)
      for (const { id: palette } of OPAL_PALETTES) {
        const name = activityOrb(variant, color, palette);
        assert.ok(existsSync(`assets/live-activity/Orbs.xcassets/${name}.imageset/orb.png`), name);
      }
});
