import assert from "node:assert/strict";
import test from "node:test";

import type { Pose } from "../modules/pose";
import {
  START,
  backLeavesTasks,
  levelsOf,
  move,
  pagedRoom,
  shapeOf,
  spotOf,
  startAt,
} from "../src/components/tasks/pages";
import type { Level, Move, Room, Shape, Stack } from "../src/components/tasks/pages";
import { TaskId } from "../src/live/tasks";
import { screenLayout } from "../src/screens/layout";
import type { Page } from "../src/screens/layout";
import { roomOf as windowRoom } from "../src/screens/window";
import type { Insets, Size } from "../src/screens/window";

const duoOf = (window: Size, insets: Insets, pose: Pose) => {
  const { duo } = screenLayout(windowRoom(pose, window, insets));
  assert.ok(duo);

  return duo;
};

const A = TaskId.parse("a");
const LEVELS: Level[] = ["list", "topic", "thread", "steps", "check", "picks"];

const openUpright = duoOf(
  { width: 951, height: 669 },
  { top: 0, right: 84, bottom: 21, left: 0 },
  { regular: true, bar: "right", fold: { x: 455, y: 0, width: 40, height: 669 } },
).tasks;

const openOnSideDuo = duoOf(
  { width: 669, height: 951 },
  { top: 54, right: 0, bottom: 34, left: 0 },
  { regular: true, fold: { x: 0, y: 455, width: 669, height: 40 } },
);

const openOnSide = openOnSideDuo.tasks;

const folded = duoOf(
  { width: 466, height: 678 },
  { top: 0, right: 84, bottom: 34, left: 0 },
  { regular: false, bar: "right" },
).tasks;

const roomOf = (page: Page): Room => pagedRoom(page);

const sheet: Room = { width: 440, foot: 34, paged: false };

const go = (...moves: Move[]) => {
  let stack = START;

  for (const step of moves) {
    stack = move(stack, step);
  }

  return stack;
};

const pagesOf = (stack: Stack, room: Room, closes = true) => {
  const shape = shapeOf(room);

  return { levels: levelsOf(stack, shape), shape, closes };
};

const onScreen = (stack: Stack, room: Room) => {
  const pages = pagesOf(stack, room);

  return LEVELS.filter((level) => spotOf(level, pages, room).shown);
};

const stacks = [
  ["the list", go()],
  ["a topic", go({ to: "topic", id: A })],
  ["a thread", go({ to: "topic", id: A }, { to: "thread" })],
  ["its steps", go({ to: "topic", id: A }, { to: "thread" }, { to: "steps", id: A })],
  ["the last check", go({ to: "check" })],
  ["hex’s picks", go({ to: "picks" })],
] as const satisfies readonly (readonly [string, Stack])[];

test("the Duo shows two pages where Tasks is wide enough, held wide open; on its side and folded one at a time", () => {
  assert.equal(shapeOf(roomOf(openUpright)), "panes");
  assert.equal(shapeOf(roomOf(openOnSide)), "one");
  assert.equal(shapeOf(roomOf(folded)), "one");
  assert.equal(shapeOf({ width: 1000, foot: 0, paged: false }), "columns");
});

test("open, the Duo shows the deepest two levels, each step down sliding both along", () => {
  const room = roomOf(openUpright);
  assert.deepEqual(onScreen(go(), room), ["list", "topic"]);
  assert.deepEqual(onScreen(go({ to: "topic", id: A }), room), ["list", "topic"]);
  assert.deepEqual(onScreen(stacks[2][1], room), ["topic", "thread"]);
  assert.deepEqual(onScreen(stacks[3][1], room), ["thread", "steps"]);
});

test("the topic shown beside the list is opened, so folding keeps it in front", () => {
  const shown = go({ to: "topic", id: A });
  assert.deepEqual(onScreen(shown, roomOf(openUpright)), ["list", "topic"]);
  assert.deepEqual(onScreen(shown, roomOf(folded)), ["topic"]);
  assert.deepEqual(onScreen(move(shown, { to: "topic", id: null }), roomOf(folded)), ["list"]);
});

test("back goes a level up, and from the list backLeavesTasks for the call", () => {
  const cases: [Shape, Stack, Level[] | "call"][] = [
    ["one", go(), "call"],
    ["one", go({ to: "topic", id: A }), ["list"]],
    ["one", go({ to: "topic", id: A }, { to: "thread" }), ["list", "topic"]],
    ["one", go({ to: "check" }), ["list"]],
    ["panes", go(), "call"],
    ["panes", go({ to: "topic", id: A }), "call"],
    ["panes", go({ to: "check" }), "call"],
    ["panes", go({ to: "topic", id: A }, { to: "thread" }), ["list", "topic"]],
    ["panes", stacks[3][1], ["list", "topic", "thread"]],
    ["columns", go({ to: "topic", id: A }), "call"],
    ["columns", go({ to: "check" }), ["list", "topic"]],
  ];

  for (const [shape, stack, after] of cases) {
    const result = backLeavesTasks(stack, shape)
      ? "call"
      : levelsOf(move(stack, { to: "back" }), shape);

    assert.deepEqual(result, after, `${shape} from ${levelsOf(stack, shape).join(" > ")}`);
  }
});

test("Tasks opened on a topic goes back to the list before the call", () => {
  const stack = startAt({ task: A });
  assert.deepEqual(levelsOf(stack, "one"), ["list", "topic"]);
  assert.equal(backLeavesTasks(stack, "one"), false);
  assert.equal(backLeavesTasks(move(stack, { to: "back" }), "one"), true);
});

test("the leading page has Back named for where it goes, the list’s for the call", () => {
  const room = roomOf(openUpright);
  const backOf = (level: Level, stack: Stack) => spotOf(level, pagesOf(stack, room), room).back;
  assert.equal(backOf("list", go()), "call");
  assert.equal(backOf("topic", go()), undefined);
  assert.equal(backOf("topic", stacks[2][1]), "list");
  assert.equal(backOf("thread", stacks[2][1]), undefined);
  const one = roomOf(folded);
  assert.equal(spotOf("list", pagesOf(go(), one), one).back, "call");
  assert.equal(spotOf("list", pagesOf(go(), one, false), one).back, undefined);
  assert.equal(
    spotOf("list", pagesOf(stacks[1][1], one), one).back,
    "call",
    "waiting behind a topic, the list keeps its way back, so it slides in with it",
  );
});

test("beside the transcript, Tasks lays out one page wide with the list’s Back to the call", () => {
  const room: Room = { width: 455, foot: 21, paged: true, meet: -455 / 2 };
  const pages = pagesOf(go(), room);
  assert.equal(pages.shape, "one");
  const list = spotOf("list", pages, room);
  assert.deepEqual([list.shown, list.back], [true, "call"]);
  const deeper = pagesOf(go({ to: "topic", id: A }), room);
  assert.equal(spotOf("list", deeper, room).shown, false);
  assert.equal(spotOf("topic", deeper, room).back, "list");
});

test("the phone’s sheet: Back goes a level up, and the list’s leaves nothing", () => {
  const pages = pagesOf(go({ to: "topic", id: A }), sheet, false);
  const list = spotOf("list", pages, sheet);
  const task = spotOf("topic", pages, sheet);
  assert.deepEqual([list.shown, list.back], [false, undefined]);
  assert.deepEqual([task.shown, task.back], [true, "list"]);
  assert.equal(spotOf("thread", pages, sheet).shown, false);
});

test("a sheet nothing measured starts one page at a time, until its pages say their shape", () => {
  assert.equal(shapeOf({ foot: 0, paged: false }), "one");
});

test("writing focuses the composer once, and going back lets it go", () => {
  const writing = go({ to: "topic", id: A }, { to: "thread", write: true });
  assert.equal(writing.focusComposer, true);
  assert.equal(move(writing, { to: "composerFocused" }).focusComposer, false);
  assert.equal(move(writing, { to: "back" }).focusComposer, false);
});

test("a page ending at the fold keeps nothing clear below it, and Back always says where it goes", () => {
  assert.ok(openOnSideDuo.beside?.typing);
  const typing = roomOf(openOnSideDuo.beside.typing);
  assert.equal(spotOf("list", pagesOf(go(), typing), typing).foot, 0);
  const beside = roomOf(openOnSideDuo.beside.tasks);
  assert.equal(spotOf("list", pagesOf(go(), beside), beside).back, "call");
});

test("on its side, Tasks is one page: the list fills it and a topic pushes over it, its Back with it", () => {
  const page = duoOf(
    { width: 669, height: 951 },
    { top: 82, right: 0, bottom: 34, left: 0 },
    { regular: true, fold: { x: 0, y: 455.5, width: 669, height: 40 } },
  ).tasks;

  const room = roomOf(page);
  assert.equal(shapeOf(room), "one");
  assert.deepEqual(onScreen(go(), room), ["list"]);
  assert.deepEqual(onScreen(go({ to: "topic", id: A }), room), ["topic"]);
  const topic = spotOf("topic", pagesOf(go({ to: "topic", id: A }), room), room);
  assert.deepEqual([topic.shown, topic.back], [true, "list"]);
  const waiting = spotOf("topic", pagesOf(go(), room), room);
  assert.deepEqual([waiting.shown, waiting.back], [false, "list"]);
});
