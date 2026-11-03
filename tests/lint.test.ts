import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('oxlint finds nothing in src and tests, type-aware rules included', () => {
  const lint = spawnSync(
    'node_modules/.bin/oxlint',
    ['--type-aware', '-f', 'unix', 'src', 'tests'],
    {
      encoding: 'utf8',
    },
  );
  assert.equal(lint.status, 0, lint.stdout + lint.stderr);
});
