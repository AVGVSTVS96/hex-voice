import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

import type { Pose } from '../modules/pose';
import { pagedRoom, shapeOf } from '../src/components/tasks/pages';
import { screenLayout } from '../src/screens/layout';
import { roomOf } from '../src/screens/window';
import type { Insets, Size } from '../src/screens/window';
import { metrics } from '../src/ui/tokens';

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );

test('only the window module reads the device’s pose; the call screen mounts it and the check reports it', () => {
  const readers = files('src').filter((file) =>
    /from '(?:\.\.\/)+modules\/pose'/.test(readFileSync(file, 'utf-8')),
  );

  assert.deepEqual(readers.sort(), [
    'src/call/call-screen.tsx',
    'src/call/pose-report.tsx',
    'src/screens/window.ts',
  ]);
  const screen = readFileSync('src/call/call-screen.tsx', 'utf-8');
  assert.deepEqual(
    [...screen.matchAll(/\bpose\.\w+/g)].map(([read]) => read),
    [],
    'the call screen hands the pose to roomOf and reads none of it itself',
  );
});

// A key or SwiftUI id made from the layout rebuilds its view, scroll and state with it whenever a
// resize, a turn or Split View changes the layout, as the topic's list once did on every turn.
test('a view’s identity never comes from the window’s size or pose', () => {
  const layoutWords =
    /\b(?:beside|paired|shape|width|height|compact|wide|duo|panes|split|layout|room|pose|regular|placed)\b/;

  const identities = files('src').flatMap((file) =>
    [...readFileSync(file, 'utf-8').matchAll(/\bkey=\{((?:[^{}]|\{[^{}]*\})*)\}|\bid\(([^)]*)\)/g)]
      .filter(([, key, id]) => layoutWords.test(key ?? id ?? ''))
      .map(([found]) => `${file}: ${found}`),
  );

  assert.deepEqual(identities, []);
});

// Reanimated draws a view's first frame by its style's first worklet and its values then, so a style
// made where it outlives the view it styles draws a view that mounts later at an old layout. A view
// that only some layouts or moments show is an AnimatedView, which makes its style as it mounts.
test('an animated style styles only views that mount with the component making it', () => {
  const kinds = new Set([
    ts.SyntaxKind.ConditionalExpression,
    ts.SyntaxKind.IfStatement,
    ts.SyntaxKind.ArrowFunction,
    ts.SyntaxKind.FunctionExpression,
  ]);

  const gates = new Set([
    ts.SyntaxKind.AmpersandAmpersandToken,
    ts.SyntaxKind.BarBarToken,
    ts.SyntaxKind.QuestionQuestionToken,
  ]);

  const gated = (node: ts.Node, scope: ts.Node) => {
    for (let up = node.parent; up !== scope; up = up.parent) {
      if (kinds.has(up.kind) || (ts.isBinaryExpression(up) && gates.has(up.operatorToken.kind))) {
        return true;
      }
    }

    return false;
  };

  const found = files('src')
    .filter((file) => file.endsWith('.tsx'))
    .flatMap((file) => {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf-8'),
        ts.ScriptTarget.Latest,
        true,
      );

      const styles: { name: ts.Identifier; scope: ts.Node }[] = [];

      const declared = (node: ts.Node): void => {
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.initializer &&
          ts.isCallExpression(node.initializer) &&
          ts.isIdentifier(node.initializer.expression) &&
          node.initializer.expression.text === 'useAnimatedStyle'
        ) {
          let scope: ts.Node = node;

          while (!ts.isFunctionLike(scope)) {
            scope = scope.parent;
          }

          styles.push({ name: node.name, scope });
        }

        ts.forEachChild(node, declared);
      };

      declared(source);

      return styles.flatMap(({ name, scope }) => {
        const uses: string[] = [];

        const visit = (node: ts.Node): void => {
          if (
            ts.isIdentifier(node) &&
            node !== name &&
            node.text === name.text &&
            gated(node, scope)
          ) {
            uses.push(
              `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${name.text}`,
            );
          }

          ts.forEachChild(node, visit);
        };

        visit(scope);

        return uses;
      });
    });

  assert.deepEqual(found, []);
});

// A width handed down in JS reaches a SwiftUI view only once the turn that changed it is over, and
// then lays it out a second time. Tasks' content takes its width from SwiftUI, which lays it out in
// the turn: one line or stacked is `Fits`' choice, and only the pages' container knows a page's width.
// A token's fixed size (`metrics`) is no layout's, so it may be handed down.
test('Tasks’ rows and pages never take a width from JS', () => {
  const found = files('src/components/tasks')
    .filter((file) => file.endsWith('.tsx') && !file.endsWith('tasks-view.tsx'))
    .flatMap((file) => {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf-8'),
        ts.ScriptTarget.Latest,
        true,
      );

      const widths: string[] = [];

      const visit = (node: ts.Node): void => {
        const named =
          (ts.isJsxAttribute(node) || ts.isBindingElement(node) || ts.isPropertySignature(node)) &&
          node.name.getText(source) === 'width';

        const token =
          ts.isJsxAttribute(node) &&
          (node.initializer?.getText(source) ?? '').startsWith('{metrics.');

        if (named && !token) {
          widths.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
        }

        ts.forEachChild(node, visit);
      };

      visit(source);

      return widths;
    });

  assert.deepEqual(found, []);
});

// iPhone Duo held wide and open: 951×669, the side column's 84 on the right, the fold 40 wide at
// the middle. In Split View each app gets half; the app on the right keeps the column.
const open = { width: 951, height: 669 };
const column = { top: 0, right: 84, bottom: 34, left: 0 };
const fold = { x: 455.5, y: 0, width: 40, height: 669 };

const openPose: Pose = {
  regular: true,
  bar: 'right',
  fold,
  occlusions: [{ x: 867, y: 0, width: 84, height: 120 }],
};

// A window at `x` on the open screen, as iOS reports the pose to it: in the window's coordinates,
// the bar's edge the device's.
const inSplitView = (x: number, width: number, insets: Insets, pose: Pose) => ({
  window: { width, height: open.height },
  insets,
  pose: {
    ...pose,
    fold: pose.fold && { ...pose.fold, x: pose.fold.x - x },
    occlusions: pose.occlusions?.map((area) => ({ ...area, x: area.x - x })),
  },
});

test('the open Duo’s whole screen keeps its column, and its fold as the line down the middle of iOS’s', () => {
  const room = roomOf(openPose, open, column);
  assert.deepEqual(room.fold, { x: 475.5 });
  assert.equal(room.bar, 'right');
  assert.deepEqual(room.occlusions, openPose.occlusions);
});

test('in Split View the fold at a window’s edge isn’t the window’s, and a column it has no inset for isn’t either', () => {
  const right = inSplitView(480, 471, column, { ...openPose, regular: false });
  const rightRoom = roomOf(right.pose, right.window, right.insets);
  assert.equal(rightRoom.fold, undefined, 'the fold lies at the right app’s leading edge');
  assert.equal(rightRoom.bar, 'right', 'the right app keeps the column it has an inset for');
  assert.deepEqual(rightRoom.occlusions, [{ x: 387, y: 0, width: 84, height: 120 }]);

  const left = inSplitView(0, 471, { top: 0, right: 0, bottom: 34, left: 0 }, openPose);
  const leftRoom = roomOf(left.pose, left.window, left.insets);
  assert.equal(leftRoom.fold, undefined, 'the fold lies at the left app’s trailing edge');
  assert.equal(
    leftRoom.bar,
    undefined,
    'the device prefers its bars on the right, outside this window',
  );
  assert.deepEqual(leftRoom.occlusions, [], 'the camera is over the other app');
});

test('a window the fold crosses keeps it', () => {
  // A picture in picture pinned at the top leaves the app the screen below it.
  const shorter = roomOf(
    { ...openPose, fold: { ...fold, y: -200, height: 669 } },
    { width: 951, height: 469 },
    column,
  );

  assert.deepEqual(shorter.fold, { x: 475.5 });
  const narrow = roomOf(openPose, { width: 700, height: 669 }, column);
  assert.equal(narrow.fold, undefined, 'past the fold only 204 of a page is left');
});

const layoutIn = (window: Size, insets: Insets, pose: Pose) =>
  screenLayout(roomOf(pose, window, insets));

test('in Split View each app lays out as one page in the window it has, as the Duo does folded', () => {
  for (const [side, { window, insets, pose }] of Object.entries({
    right: inSplitView(480, 471, column, { ...openPose, regular: false }),
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
    assert.equal(layout.kind, 'single', side);
    const tasks = layout.duo?.tasks;
    assert.ok(!tasks || shapeOf(pagedRoom(tasks)) === 'one', `${side}: Tasks is one page`);
    assert.equal(layout.duo?.beside, undefined, `${side}: nothing to put beside Tasks`);

    for (const span of [layout.words, layout.footer, layout.agent]) {
      assert.ok(span.x >= 0 && span.x + span.width <= window.width, `${side}: inside the window`);
    }

    assert.ok(layout.toolbar.y >= 0 && layout.toolbar.x >= 0, `${side}: the toolbar is on screen`);
    assert.ok(
      layout.toolbar.x + (layout.toolbar.axis === 'row' ? layout.toolbar.width : 48) <=
        window.width,
      `${side}: the toolbar ends inside the window`,
    );
  }
});

// Every window the app could be given, with or without a side column and with the fold anywhere
// across it or beyond its edges: whatever the room, everything the layout places has width and
// stays inside the window, the call's + included, clear of the transcript button and on the orb's
// side of a crease, and partly folded it all lays out exactly as open flat.
test('in any window, with the fold anywhere or nowhere, everything the layout places has room inside it and folding moves none of it', () => {
  const widths = [320, 375, 440, 466, 471, 560, 669, 700, 834, 951, 1194];
  const heights = [408, 466, 669, 678, 834, 951, 1194];
  const problems: string[] = [];

  for (const width of widths) {
    for (const height of heights) {
      for (const columnSide of [undefined, 'left', 'right'] as const) {
        for (const at of [undefined, -60, -20, 0, 0.25, 0.5, 0.75, 1, 1.02]) {
          const window = { width, height };

          const insets = {
            top: columnSide ? 0 : 24,
            bottom: 20,
            left: columnSide === 'left' ? 84 : 0,
            right: columnSide === 'right' ? 84 : 0,
          };

          const across = width > height;

          const place = (extent: number) =>
            at !== undefined && at > -1 && at <= 1.1 ? at * extent : (at ?? 0);

          const fold =
            at === undefined
              ? undefined
              : across
                ? { x: place(width) - 20, y: 0, width: 40, height }
                : { x: 0, y: place(height) - 20, width, height: 40 };

          const pose: Pose = { regular: width >= 669, bar: columnSide, fold };
          const name = `${width}x${height} ${columnSide ?? 'no'} column, fold ${at ?? 'none'}`;
          const room = roomOf(pose, window, insets);
          const layout = screenLayout(room);
          const { content } = layout;

          const spans = {
            words: layout.words,
            footer: layout.footer,
            agent: layout.agent,
            besideCalls: layout.besideCalls,
            besideTasks: layout.besideTasks,
          };

          for (const [what, span] of Object.entries(spans)) {
            if (!(span.width > 0 && span.x >= -0.5 && span.x + span.width <= content.width + 0.5)) {
              problems.push(`${name}: ${what} ${span.x}+${span.width} in ${content.width}`);
            }
          }

          if (!(layout.calls.width > 0 && layout.calls.width < width)) {
            problems.push(`${name}: Calls ${layout.calls.width} wide`);
          }

          if (layout.calls.place === 'beside' && content.width - layout.calls.width < 320) {
            problems.push(
              `${name}: beside Calls the call keeps ${content.width - layout.calls.width}`,
            );
          }

          const { add } = layout;
          const half = metrics.docked / 2;

          if (!(
            add.x - half >= 0 &&
            add.x + half <= content.width &&
            add.y - half >= 0 &&
            add.y + half <= content.height
          )) {
            problems.push(
              `${name}: the + at ${add.x},${add.y} in ${content.width}x${content.height}`,
            );
          }

          if (layout.pulls && Math.abs(add.x - layout.orb.read.x) < metrics.docked) {
            problems.push(`${name}: the + on the transcript button`);
          }

          const crease = room.fold;

          if (
            crease &&
            'x' in crease &&
            add.x + half > Math.min(crease.x - content.x, layout.words.x)
          ) {
            problems.push(`${name}: the + past the crease or into the words`);
          }

          if (crease && 'y' in crease && add.y + half > Math.min(crease.y, layout.words.top)) {
            problems.push(`${name}: the + past the crease or into the words`);
          }

          const tasks = layout.duo?.tasks;

          if (tasks) {
            const { area } = tasks;

            if (!(area.width > 0 && area.x >= 0 && area.x + area.width <= width + 0.5)) {
              problems.push(`${name}: Tasks ${area.x}+${area.width}`);
            }
          }
        }
      }
    }
  }

  assert.deepEqual(problems, []);
});
