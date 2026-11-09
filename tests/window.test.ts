import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { parseSync, Visitor } from "oxc-parser";
import type { BindingPattern, BindingRestElement, Span } from "oxc-parser";

import type { Pose } from "../modules/pose";
import { pagedRoom, shapeOf } from "../src/components/tasks/pages";
import { screenLayout } from "../src/screens/layout";
import type { Layout } from "../src/screens/layout";
import { roomOf } from "../src/screens/window";
import type { Insets, Room, Size } from "../src/screens/window";
import { metrics } from "../src/ui/tokens";

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return files(at);
    }

    return /\.tsx?$/u.test(entry.name) ? [at] : [];
  });

test("only the window module reads the device’s pose; the call screen mounts it and the check reports it", () => {
  const readers = files("src").filter((file) =>
    /from ["'](?:\.\.\/)+modules\/pose["']/u.test(readFileSync(file, "utf-8")),
  );

  assert.deepEqual(readers.toSorted(), [
    "src/call/call-screen.tsx",
    "src/call/pose-report.tsx",
    "src/screens/window.ts",
  ]);
  const screen = readFileSync("src/call/call-screen.tsx", "utf-8");
  assert.deepEqual(
    [...screen.matchAll(/\bpose\.\w+/gu)].map(([read]) => read),
    [],
    "the call screen hands the pose to roomOf and reads none of it itself",
  );
});

test("a view’s identity never comes from the window’s size or pose", () => {
  const layoutWords =
    /\b(?:beside|paired|shape|width|height|compact|wide|duo|panes|split|layout|room|pose|regular|placed)\b/u;

  const identities = files("src").flatMap((file) =>
    [
      ...readFileSync(file, "utf-8").matchAll(
        /\bkey=\{(?<key>(?:[^{}]|\{[^{}]*\})*)\}|\bid\((?<id>[^)]*)\)/gu,
      ),
    ].flatMap((match) =>
      layoutWords.test(match.groups?.key ?? match.groups?.id ?? "") ? [`${file}: ${match[0]}`] : [],
    ),
  );

  assert.deepEqual(
    identities,
    [],
    "a key or SwiftUI id made from the layout rebuilds its view, scroll and state whenever a resize, a turn or Split View changes the layout",
  );
});

const parse = (file: string) => {
  const text = readFileSync(file, "utf-8");
  const lineOf = (at: number) => text.slice(0, at).split("\n").length;

  return { lineOf, program: parseSync(file, text).program, text };
};

type Named = Span & { name: string };

const holds = (outer: Span, inner: Span) => outer.start <= inner.start && inner.end <= outer.end;

test("an animated style styles only views that mount with the component making it", () => {
  const found = files("src")
    .filter((file) => file.endsWith(".tsx"))
    .flatMap((file) => {
      const { lineOf, program } = parse(file);
      const scopes: Span[] = [];
      const gates: Span[] = [];
      const names: Named[] = [];
      const styles: Named[] = [];

      const scope = (node: Span) => {
        scopes.push(node);
        gates.push(node);
      };

      const gate = (node: Span) => {
        gates.push(node);
      };

      new Visitor({
        ArrowFunctionExpression: scope,
        ConditionalExpression: gate,
        FunctionDeclaration: (node) => {
          scopes.push(node);
        },
        FunctionExpression: scope,
        Identifier: (node) => {
          names.push(node);
        },
        IfStatement: gate,
        LogicalExpression: gate,
        VariableDeclarator: ({ id, init }) => {
          if (
            id.type === "Identifier" &&
            init?.type === "CallExpression" &&
            init.callee.type === "Identifier" &&
            init.callee.name === "useAnimatedStyle"
          ) {
            styles.push(id);
          }
        },
      }).visit(program);

      return styles.flatMap((style) => {
        const home = scopes.findLast((each) => holds(each, style));

        return names.flatMap((name) =>
          home &&
          name !== style &&
          name.name === style.name &&
          gates.some((each) => each !== home && holds(home, each) && holds(each, name))
            ? [`${file}:${lineOf(name.start)} ${name.name}`]
            : [],
        );
      });
    });

  assert.deepEqual(
    found,
    [],
    "Reanimated draws a view’s first frame by its style’s first worklet, so a style that outlives the view it styles draws a view mounting later at an old layout: a view only some layouts or moments show is an AnimatedView, which makes its style as it mounts",
  );
});

test("Tasks’ rows and pages never take a width from JS", () => {
  const found = files("src/components/tasks")
    .filter((file) => file.endsWith(".tsx") && !file.endsWith("tasks-view.tsx"))
    .flatMap((file) => {
      const { lineOf, program, text } = parse(file);
      const say = ({ start, end }: Span) => text.slice(start, end);
      const widths: Span[] = [];

      const named = (name: Span, at: Span = name) => {
        if (say(name) === "width") {
          widths.push(at);
        }
      };

      const bound = (target: BindingPattern | BindingRestElement | null) => {
        if (target?.type === "AssignmentPattern") {
          named(target.left, target);
        } else if (target?.type === "RestElement") {
          named(target.argument, target);
        } else if (target) {
          named(target);
        }
      };

      new Visitor({
        ArrayPattern: ({ elements }) => {
          for (const each of elements) {
            bound(each);
          }
        },
        JSXAttribute: (node) => {
          if (!(node.value && say(node.value).startsWith("{metrics."))) {
            named(node.name, node);
          }
        },
        ObjectPattern: ({ properties }) => {
          for (const each of properties) {
            bound(each.type === "Property" ? each.value : each);
          }
        },
        TSPropertySignature: (node) => {
          named(node.key, node);
        },
      }).visit(program);

      return widths.map(({ start }) => `${file}:${lineOf(start)}`);
    });

  assert.deepEqual(found, []);
});

const openWide = { width: 951, height: 669 };
const rightColumn = { top: 0, right: 84, bottom: 34, left: 0 };
const openFold = { x: 455.5, y: 0, width: 40, height: 669 };

const openPose: Pose = {
  regular: true,
  bar: "right",
  fold: openFold,
  occlusions: [{ x: 867, y: 0, width: 84, height: 120 }],
};

const inSplitView = (x: number, width: number, insets: Insets, pose: Pose) => ({
  window: { width, height: openWide.height },
  insets,
  pose: {
    ...pose,
    fold: pose.fold && { ...pose.fold, x: pose.fold.x - x },
    occlusions: pose.occlusions?.map((area) => ({ ...area, x: area.x - x })),
  },
});

test("the open Duo’s whole screen keeps its column, and its fold as the line down the middle of iOS’s", () => {
  const room = roomOf(openPose, openWide, rightColumn);
  assert.deepEqual(room.fold, { x: 475.5 });
  assert.equal(room.bar, "right");
  assert.deepEqual(room.occlusions, openPose.occlusions);
});

test("in Split View the fold at a window’s edge isn’t the window’s, and a column it has no inset for isn’t either", () => {
  const right = inSplitView(480, 471, rightColumn, { ...openPose, regular: false });
  const rightRoom = roomOf(right.pose, right.window, right.insets);
  assert.equal(rightRoom.fold, undefined, "the fold lies at the right app’s leading edge");
  assert.equal(rightRoom.bar, "right", "the right app keeps the column it has an inset for");
  assert.deepEqual(rightRoom.occlusions, [{ x: 387, y: 0, width: 84, height: 120 }]);

  const left = inSplitView(0, 471, { top: 0, right: 0, bottom: 34, left: 0 }, openPose);
  const leftRoom = roomOf(left.pose, left.window, left.insets);
  assert.equal(leftRoom.fold, undefined, "the fold lies at the left app’s trailing edge");
  assert.equal(
    leftRoom.bar,
    undefined,
    "the device prefers its bars on the right, outside this window",
  );
  assert.deepEqual(leftRoom.occlusions, [], "the camera is over the other app");
});

test("a window the fold crosses keeps it", () => {
  const belowPictureInPicture = roomOf(
    { ...openPose, fold: { ...openFold, y: -200, height: 669 } },
    { width: 951, height: 469 },
    rightColumn,
  );

  assert.deepEqual(belowPictureInPicture.fold, { x: 475.5 });
  const narrow = roomOf(openPose, { width: 700, height: 669 }, rightColumn);
  assert.equal(narrow.fold, undefined, "past the fold only 204 of a page is left");
});

const layoutIn = (window: Size, insets: Insets, pose: Pose) =>
  screenLayout(roomOf(pose, window, insets));

test("in Split View each app lays out as one page in the window it has, as the Duo does folded", () => {
  for (const [side, { window, insets, pose }] of Object.entries({
    right: inSplitView(480, 471, rightColumn, { ...openPose, regular: false }),
    left: inSplitView(
      0,
      471,
      { top: 24, right: 0, bottom: 34, left: 0 },
      {
        ...openPose,
        regular: false,
      },
    ),
  })) {
    const layout = layoutIn(window, insets, pose);
    assert.equal(layout.kind, "single", side);
    const tasks = layout.duo?.tasks;
    assert.ok(!tasks || shapeOf(pagedRoom(tasks)) === "one", `${side}: Tasks is one page`);
    assert.equal(layout.duo?.beside, undefined, `${side}: nothing to put beside Tasks`);

    for (const span of [layout.words, layout.footer, layout.agent]) {
      assert.ok(span.x >= 0 && span.x + span.width <= window.width, `${side}: inside the window`);
    }

    assert.ok(layout.toolbar.y >= 0 && layout.toolbar.x >= 0, `${side}: the toolbar is on screen`);
    assert.ok(
      layout.toolbar.x + (layout.toolbar.axis === "row" ? layout.toolbar.width : 48) <=
        window.width,
      `${side}: the toolbar ends inside the window`,
    );
  }
});

const foldAt = (at: number, extent: number) => (at > -1 && at <= 1.1 ? at * extent : at);

const foldAcross = (window: Size, at: number) => {
  const { width, height } = window;

  return width > height
    ? { x: foldAt(at, width) - 20, y: 0, width: 40, height }
    : { x: 0, y: foldAt(at, height) - 20, width, height: 40 };
};

const spanProblems = (name: string, layout: Layout) => {
  const { content } = layout;

  const spans = {
    words: layout.words,
    footer: layout.footer,
    agent: layout.agent,
    besideCalls: layout.besideCalls,
    besideTasks: layout.besideTasks,
  };

  return Object.entries(spans).flatMap(([what, span]) =>
    span.width > 0 && span.x >= -0.5 && span.x + span.width <= content.width + 0.5
      ? []
      : [`${name}: ${what} ${span.x}+${span.width} in ${content.width}`],
  );
};

const callsProblems = (name: string, layout: Layout, window: Size) => {
  const { calls, content } = layout;
  const problems: string[] = [];

  if (!(calls.width > 0 && calls.width < window.width)) {
    problems.push(`${name}: Calls ${calls.width} wide`);
  }

  if (calls.place === "beside" && content.width - calls.width < 320) {
    problems.push(`${name}: beside Calls the call keeps ${content.width - calls.width}`);
  }

  return problems;
};

const addProblems = (name: string, layout: Layout, crease: Room["fold"]) => {
  const { add, content } = layout;
  const half = metrics.docked / 2;
  const problems: string[] = [];

  if (
    !(
      add.x - half >= 0 &&
      add.x + half <= content.width &&
      add.y - half >= 0 &&
      add.y + half <= content.height
    )
  ) {
    problems.push(`${name}: the + at ${add.x},${add.y} in ${content.width}x${content.height}`);
  }

  if (layout.pulls && Math.abs(add.x - layout.orb.read.x) < metrics.docked) {
    problems.push(`${name}: the + on the transcript button`);
  }

  if (crease && "x" in crease && add.x + half > Math.min(crease.x - content.x, layout.words.x)) {
    problems.push(`${name}: the + past the crease or into the words`);
  }

  if (crease && "y" in crease && add.y + half > Math.min(crease.y, layout.words.top)) {
    problems.push(`${name}: the + past the crease or into the words`);
  }

  return problems;
};

const tasksProblems = (name: string, layout: Layout, window: Size) => {
  const tasks = layout.duo?.tasks;

  if (!tasks) {
    return [];
  }

  const { area } = tasks;

  return area.width > 0 && area.x >= 0 && area.x + area.width <= window.width + 0.5
    ? []
    : [`${name}: Tasks ${area.x}+${area.width}`];
};

const problemsIn = (
  window: Size,
  columnSide: "left" | "right" | undefined,
  at: number | undefined,
) => {
  const insets = {
    top: columnSide ? 0 : 24,
    bottom: 20,
    left: columnSide === "left" ? 84 : 0,
    right: columnSide === "right" ? 84 : 0,
  };

  const pose: Pose = {
    regular: window.width >= 669,
    bar: columnSide,
    fold: at === undefined ? undefined : foldAcross(window, at),
  };

  const name = `${window.width}x${window.height} ${columnSide ?? "no"} column, fold ${at ?? "none"}`;
  const room = roomOf(pose, window, insets);
  const layout = screenLayout(room);

  return [
    ...spanProblems(name, layout),
    ...callsProblems(name, layout, window),
    ...addProblems(name, layout, room.fold),
    ...tasksProblems(name, layout, window),
  ];
};

test("in any window, with the fold anywhere or nowhere, everything the layout places has room inside it and folding moves none of it", () => {
  const widths = [320, 375, 440, 466, 471, 560, 669, 700, 834, 951, 1194];
  const heights = [408, 466, 669, 678, 834, 951, 1194];
  const problems: string[] = [];

  for (const width of widths) {
    for (const height of heights) {
      for (const columnSide of [undefined, "left", "right"] as const) {
        for (const at of [undefined, -60, -20, 0, 0.25, 0.5, 0.75, 1, 1.02]) {
          problems.push(...problemsIn({ width, height }, columnSide, at));
        }
      }
    }
  }

  assert.deepEqual(problems, []);
});
