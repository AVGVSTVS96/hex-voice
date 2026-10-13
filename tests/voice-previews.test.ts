import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import { VOICES } from '../src/live/voices';

test('every voice has its introduction bundled', () => {
  for (const { id } of VOICES) assert.ok(existsSync(`assets/voices/${id}.m4a`), id);
});
