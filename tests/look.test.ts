import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { color, space, type } from "../src/ui/tokens";

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return files(at);
    }

    return /\.tsx?$/u.test(entry.name) ? [at] : [];
  });

const notYetOnTokens = new Set([
  "src/components/tasks/tasks-view.tsx",
  "src/screens/duo-tasks.tsx",
]);

const widgetWithoutTokens = "src/live/call-activity.tsx";

const fromTokensOrParent =
  /\b(?:space\[[\d.]+\]|metrics(?:\.\w+)+|radius\.\w+|textOf\([^)]*\)|hairline)/gu;

const halvedToCenter = /\/\s*2\b/gu;

const groupsOf = (match: RegExpExecArray) => {
  assert.ok(match.groups);

  return match.groups;
};

const raw = (value: string, constants: Map<string, string>, whole: boolean): boolean => {
  const rest = value.replaceAll(fromTokensOrParent, "").replaceAll(halvedToCenter, "");

  if (whole && rest.trim()) {
    return true;
  }

  if ([...rest.matchAll(/(?<![\w$.])\d*\.?\d+/gu)].some(([number]) => Number(number) !== 0)) {
    return true;
  }

  return [...rest.matchAll(/\b[A-Z][A-Z\d_]+\b/gu)].some(([name]) => {
    const defined = constants.get(name);

    return defined === undefined || raw(defined, constants, false);
  });
};

const looksOf = (source: string, pattern: RegExp, whole: boolean) =>
  [...source.matchAll(pattern)].map((match) => ({
    found: match[0],
    value: groupsOf(match).value,
    whole,
  }));

const rawLooks = (file: string) => {
  if (!existsSync(file)) {
    return [];
  }

  const source = readFileSync(file, "utf-8");

  const constants = new Map(
    [...source.matchAll(/^(?:export )?const (?<name>[A-Z][A-Z\d_]+) = (?<value>[^;\n]+);/gmu)].map(
      (match): [string, string] => [groupsOf(match).name, groupsOf(match).value],
    ),
  );

  const looks = [
    ...looksOf(source, /\b(?:fontSize|lineHeight|fontWeight): (?<value>[^,}\n]+)/gu, true),
    ...looksOf(source, /\bfont\(\{[^}]*\bsize: (?<value>[^,}]+)/gu, true),
    ...looksOf(source, /\blineSpacing\((?<value>[^)]+)\)/gu, true),
    ...looksOf(
      source,
      /\b(?:borderRadius|cornerRadius|gap|rowGap|columnGap|padding\w*|margin\w*): (?<value>[^,}\n]+)/gu,
      false,
    ),
    ...[...source.matchAll(/\bpadding\(\{(?<inside>[^}]*)\}/gu)].flatMap((match) =>
      looksOf(groupsOf(match).inside, /\b\w+: (?<value>[^,}\n]+)/gu, false).map((look) => ({
        ...look,
        found: `padding(${look.found})`,
      })),
    ),
    ...looksOf(source, /\bspacing=\{(?<value>[^}]+)\}/gu, false),
    ...looksOf(source, /roundedRectangle', (?<value>[^)]+)\)/gu, false),
  ];

  return looks.flatMap(({ found, value, whole }) =>
    !/^(?:number|string)\b/u.test(value.trim()) && raw(value, constants, whole)
      ? [`${file}: ${found.trim()}`]
      : [],
  );
};

test("every look comes from the tokens, so a component looks the same wherever it sits", () => {
  const found = files("src")
    .filter((file) => !file.endsWith("theme.ts") && !file.startsWith("src/ui/"))
    .filter((file) => file !== widgetWithoutTokens && !notYetOnTokens.has(file))
    .flatMap(rawLooks);

  assert.deepEqual(found, []);
});

test("the files left to move onto the tokens still have something to move", () => {
  const done = [...notYetOnTokens].filter((file) => rawLooks(file).length === 0);
  assert.deepEqual(done, [], "take these off the list: they draw only with tokens now");
});

test("every corner comes from the tokens, in every file", () => {
  const corner = /borderRadius: [\d.]|roundedRectangle', [\d.]|cornerRadius: [\d.]/u;

  const found = files("src")
    .filter((file) => !file.endsWith("theme.ts"))
    .flatMap((file) =>
      readFileSync(file, "utf-8")
        .split("\n")
        .flatMap((line, i) => (corner.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
    );

  assert.deepEqual(found, []);
});

const orbPalettesYouPick = new Set([
  "src/components/persona/variants.ts",
  "src/components/persona-colors.tsx",
]);

test("every color comes from the tokens, so mint, blue and red each keep one meaning", () => {
  const found = files("src")
    .filter(
      (file) =>
        file !== "src/ui/tokens.ts" &&
        file !== widgetWithoutTokens &&
        !orbPalettesYouPick.has(file),
    )
    .flatMap((file) =>
      readFileSync(file, "utf-8")
        .split("\n")
        .flatMap((line, i) =>
          /#[\dA-Fa-f]{3,8}\b|\brgba?\(|\bhsla?\(/u.test(line)
            ? [`${file}:${i + 1}: ${line.trim()}`]
            : [],
        ),
    );

  assert.deepEqual(found, []);
});

test("the type is four sizes in two weights, and every gap is on the 4pt grid", () => {
  assert.ok(new Set(Object.values(type).map((style) => style.fontSize)).size <= 4);
  assert.deepEqual(
    [...new Set(Object.values(type).flatMap((style) => ("weight" in style ? [style.weight] : [])))],
    ["medium"],
  );
  assert.deepEqual(
    Object.values(space).filter((gap) => gap !== 2 && gap % 4 !== 0),
    [],
  );
  assert.ok(Object.keys(color).length <= 24);
});
