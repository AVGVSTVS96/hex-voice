import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { color, space, type } from '../src/ui/tokens';

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
const unmigrated = new Set(['src/components/tasks/tasks-view.tsx', 'src/screens/duo-tasks.tsx']);

// The Live Activity runs as a string in the widget extension, where the tokens don't exist.
const widget = 'src/live/call-activity.tsx';

// A token, a value React Native or SwiftUI was given by its parent, or a constant made of those,
// halved to center one on another.
const token = /\b(?:space\[[\d.]+\]|metrics(?:\.\w+)+|radius\.\w+|textOf\([^)]*\)|hairline)/g;

function raw(value: string, constants: Map<string, string>, strict: boolean): boolean {
  const rest = value.replace(token, '').replace(/\/\s*2\b/g, '');
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
    ...[...source.matchAll(/\blineSpacing\(([^)]+)\)/g)].map(([found, value]) => ({
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
    .filter((file) => file !== widget && !unmigrated.has(file))
    .flatMap(rawLooks);
  assert.deepEqual(found, []);
});

test('the files left to move onto the tokens still have something to move', () => {
  const done = [...unmigrated].filter((file) => rawLooks(file).length === 0);
  assert.deepEqual(done, [], 'take these off the list: they draw only with tokens now');
});

test('every corner comes from the tokens, in every file', () => {
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

// The orb's palettes are what you pick, not the app's look.
const art = new Set(['src/components/persona/variants.ts', 'src/components/persona-colors.tsx']);

test('every color comes from the tokens, so mint, blue and red each keep one meaning', () => {
  const found = files('src')
    .filter((file) => file !== 'src/ui/tokens.ts' && file !== widget && !art.has(file))
    .flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          /#[\dA-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(/.test(line)
            ? [`${file}:${i + 1}: ${line.trim()}`]
            : [],
        ),
    );
  assert.deepEqual(found, []);
});

test('every symbol takes its size from the scale', () => {
  const found = files('src')
    .filter((file) => file !== widget)
    .flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          /\bsize=\{\d/.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [],
        ),
    );
  assert.deepEqual(found, []);
});

test('the type is four sizes in two weights, and every gap is on the 4pt grid', () => {
  assert.ok(new Set(Object.values(type).map((style) => style.fontSize)).size <= 4);
  assert.ok(
    Object.values(type).every(
      (style) => !('weight' in style) || ['regular', 'semibold'].includes(style.weight),
    ),
  );
  assert.ok(Object.values(space).every((gap) => gap === 2 || gap % 4 === 0));
  assert.ok(Object.keys(color).length <= 17);
});
