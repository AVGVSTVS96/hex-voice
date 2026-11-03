import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );

test('every corner comes from theme.ts, so a component looks the same in every pose', () => {
  const raw = /borderRadius: [\d.]|roundedRectangle', [\d.]|cornerRadius: [\d.]/;
  const found = files('src')
    .filter((file) => !file.endsWith('theme.ts'))
    .flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) => (raw.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
    );
  assert.deepEqual(found, []);
});
