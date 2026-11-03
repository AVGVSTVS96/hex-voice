import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

// Files still drawing with numbers of their own, until each moves onto the tokens. This list only
// shrinks.
const unmigrated = new Set([
  'src/components/tasks/ask-card.tsx',
  'src/components/tasks/last-check.tsx',
  'src/components/tasks/list.tsx',
  'src/components/tasks/pinned.tsx',
  'src/components/tasks/rows.tsx',
  'src/components/tasks/said.tsx',
  'src/components/tasks/task-page.tsx',
  'src/components/tasks/tasks-view.tsx',
  'src/components/tasks/thread.tsx',
  'src/components/tasks/trace.tsx',
  'src/components/voice-settings.tsx',
  'src/live/call-activity.tsx',
  'src/screens/duo-tasks.tsx',
]);

// A token, a value React Native or SwiftUI was given by its parent, or a constant made of those.
const token = /\b(?:space\[[\d.]+\]|metrics(?:\.\w+)+|radius\.\w+|textOf\([^)]*\)|hairline)/g;

function raw(value: string, constants: Map<string, string>, strict: boolean): boolean {
  const rest = value.replace(token, '');
  if (strict && rest.trim()) return true;
  if ([...rest.matchAll(/(?<![\w$.])\d*\.?\d+/g)].some(([number]) => Number(number) !== 0))
    return true;
  return [...rest.matchAll(/\b[A-Z][A-Z\d_]+\b/g)].some(([name]) => {
    const defined = constants.get(name);
    return defined === undefined || raw(defined, constants, false);
  });
}

function rawLooks(file: string) {
  if (!existsSync(file)) return [];
  const source = readFileSync(file, 'utf8');
  const constants = new Map(
    [...source.matchAll(/^(?:export )?const ([A-Z][A-Z\d_]+) = ([^;\n]+);/gm)].map(
      ([, name, value]) => [name, value] as [string, string],
    ),
  );
  const looks = [
    // Type comes from a text style, whole.
    ...[...source.matchAll(/\b(?:fontSize|lineHeight|fontWeight): ([^,}\n]+)/g)].map(
      ([found, value]) => ({ found, value, strict: true }),
    ),
    ...[...source.matchAll(/\bfont\(\{[^}]*\bsize: ([^,}]+)/g)].map(([found, value]) => ({
      found,
      value,
      strict: true,
    })),
    ...[
      ...source.matchAll(
        /\b(?:borderRadius|cornerRadius|gap|rowGap|columnGap|padding\w*|margin\w*): ([^,}\n]+)/g,
      ),
    ].map(([found, value]) => ({ found, value, strict: false })),
    ...[...source.matchAll(/\bpadding\(\{([^}]*)\}/g)].flatMap(([, inside]) =>
      [...inside.matchAll(/\b\w+: ([^,}\n]+)/g)].map(([found, value]) => ({
        found: `padding(${found})`,
        value,
        strict: false,
      })),
    ),
    ...[...source.matchAll(/\bspacing=\{([^}]+)\}/g)].map(([found, value]) => ({
      found,
      value,
      strict: false,
    })),
    ...[...source.matchAll(/roundedRectangle', ([^)]+)\)/g)].map(([found, value]) => ({
      found,
      value,
      strict: false,
    })),
  ];
  return looks
    .filter(({ value }) => !/^(?:number|string)\b/.test(value.trim()))
    .filter(({ value, strict }) => raw(value, constants, strict))
    .map(({ found }) => `${file}: ${found.trim()}`);
}

test('every look comes from the tokens, so a component looks the same wherever it sits', () => {
  const found = files('src')
    .filter((file) => !file.endsWith('theme.ts') && !file.startsWith('src/ui/'))
    .filter((file) => !unmigrated.has(file))
    .flatMap(rawLooks);
  assert.deepEqual(found, []);
});

test('the files left to move onto the tokens still have something to move', () => {
  const done = [...unmigrated].filter((file) => rawLooks(file).length === 0);
  assert.deepEqual(done, [], 'take these off the list: they draw only with tokens now');
});

test('every corner comes from theme.ts, in every file', () => {
  const corner = /borderRadius: [\d.]|roundedRectangle', [\d.]|cornerRadius: [\d.]/;
  const found = files('src')
    .filter((file) => !file.endsWith('theme.ts'))
    .flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) => (corner.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
    );
  assert.deepEqual(found, []);
});
