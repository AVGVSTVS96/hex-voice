import type { Fold } from "@/screens/window";
import { breakpoint, metrics, stack } from "@/ui/tokens";
import type { ControlsSize } from "@/ui/tokens";

const AGENT = 22;
const WORDS = 600;
const WORDS_BESIDE = 520;
const MEASURE = 680;
const LIST = 360;
const SIDEBAR = 330;

const CALL_PEEK = 72;
export const TASKS = 380;
const PORTRAIT_PAD_CALL = 368;
const BESIDE_BUTTONS = 56;
const GAP = 12;

const WORDS_OFF_FOLD = 8;

const RIVE_ART_FILL = 0.75;

interface Place {
  x: number;
  y: number;
}

type Spot = Place & { size?: number };

interface Span {
  x: number;
  width: number;
}

export type Words = Span & { top: number };

export interface ColumnControls {
  right: number;
  bottom: number;
  axis: "row" | "column";
  size?: ControlsSize;
}

export interface Box {
  width: number;
  height: number;
  safe: { top: number; bottom: number };
  bar: number;
  fold?: Fold | undefined;
  controls?: ColumnControls | undefined;
  regular: boolean;
}

export interface Pane<Where> {
  width: number;
  place: Where;
}

export type CallsPlacement = Pane<"slide" | "beside" | "over"> & { below?: number };

export type TasksPlacement = Pane<"beside" | "sheet" | "page">;

export interface Beside<T> {
  open: T;
  calls: T;
  tasks: T;
}

export interface Stage {
  kind: "single" | "split" | "stacked";
  controls: "inline" | ColumnControls | { center: Beside<Place> & { rest: Place } };
  orb: {
    size: number;
    rest: Spot;
    room: { top: number; bottom: number };
    read: Spot;
    dock?: { calls: Required<Spot>; read?: Required<Spot> | undefined; tasks: Required<Spot> };
  };
  words: Words;
  text: "regular" | "large";
  besideCalls: Words;
  besideTasks: Words;
  footer: Span & { bottom: number };
  agent: Span & { bottom: number };
  lift: { calls: number; tasks: number };
  calls: CallsPlacement;
  tasks: TasksPlacement;
  pulls: boolean;
  add: Place;
}

export const stageLayout = (box: Box): Stage => {
  const { fold } = box;

  if (box.regular && !fold && !box.controls) {
    return pad(box);
  }

  if (fold && "y" in fold) {
    return stacked(box, fold.y);
  }

  if (box.regular && box.width > box.height) {
    return split(box, fold?.x);
  }

  return single(box);
};

export const topOf = ({ safe, bar }: Box) => Math.max(safe.top, bar);

export const footOf = ({ safe }: Box) => Math.max(safe.bottom, 20) + 14;

const leading = (y: number): Place => ({ x: metrics.gutter + metrics.docked / 2, y });

const besideDock = ({ x, y }: Place): Place => ({ x: x + metrics.docked + GAP, y });

const single = (box: Box): Stage => {
  const { width: across, height, safe, controls } = box;
  const top = topOf(box);
  const bottomInset = footOf(box);
  const center = across / 2;
  const width = Math.min(across - 2 * metrics.gutter, WORDS);
  const words = { x: center - width / 2, width };
  const inset = { x: metrics.gutter, width: across - 2 * metrics.gutter };
  const agent = { ...inset, bottom: Math.max(safe.bottom - 17, 6) };
  const size = Math.min(across * 0.62, height * 0.34, 280);

  const shared = {
    kind: "single" as const,
    text: "regular" as const,
    agent,
    lift: { calls: 0, tasks: 0 },
    tasks: { width: TASKS, place: "sheet" as const },
    pulls: true,
  };

  if (!controls) {
    const top12 = { ...words, top: top + 12 };

    const read = {
      x: metrics.gutter + metrics.docked / 2,
      y: height - bottomInset - metrics.call / 2,
      size: metrics.docked,
    };

    return {
      ...shared,
      controls: "inline",
      orb: { size, rest: { x: center, y: height / 2 }, room: { top, bottom: height }, read },
      add: besideDock(read),
      words: top12,
      besideCalls: top12,
      besideTasks: top12,
      footer: { ...inset, bottom: bottomInset },
      calls: { width: Math.min(across - CALL_PEEK, SIDEBAR), place: "slide" },
    };
  }

  const dock = height - safe.bottom - 8 - metrics.docked / 2;
  const below = { ...words, top: safe.top + 72 };
  const read = { x: metrics.gutter + metrics.docked / 2, y: dock, size: metrics.docked };

  return {
    ...shared,
    controls,
    orb: {
      size,
      rest: { x: center, y: (safe.top + height - safe.bottom) / 2 },
      room: { top, bottom: height },
      read,
    },
    add: besideDock(read),
    words: below,
    besideCalls: below,
    besideTasks: below,
    footer: { ...inset, bottom: height - dock + metrics.docked / 2 + 18 },
    calls: { width: Math.min(across - CALL_PEEK, LIST), place: "slide" },
  };
};

const pad = (box: Box): Stage => {
  const { width, height } = box;
  const bottomInset = footOf(box);
  const landscape = width > height;
  const size = Math.round(Math.min(width, height) * 0.32);
  const tasks = landscape ? Math.round((width * 2) / 3) : width - PORTRAIT_PAD_CALL;
  const below = box.bar;
  const foot = height - bottomInset - metrics.call / 2;
  const agentLow = bottomInset;
  const agentHigh = bottomInset + metrics.call + 14;

  const docked = (from: number, to: number) => {
    const center = from + (to - from) / 2 + (BESIDE_BUTTONS + GAP) / 2;
    const buttons = center - stack("regular") / 2;

    return {
      orb: { x: buttons - GAP - BESIDE_BUTTONS / 2, y: foot, size: BESIDE_BUTTONS / RIVE_ART_FILL },
      words: { ...measure(from, to), top: below + 16 },
      controls: { x: center, y: foot },
    };
  };

  const withCalls = docked(LIST, width);
  const withTasks = docked(0, width - tasks);

  if (landscape) {
    const half = width / 2;
    const group = size + 40 + metrics.call;
    const top = (height - group) / 2;
    const words = { ...measure(half, width), top: below + 16 };

    return {
      kind: "split",
      controls: {
        center: {
          open: { x: half / 2, y: top + size + 40 + metrics.call / 2 },
          calls: withCalls.controls,
          tasks: withTasks.controls,
          rest: { x: half, y: top + size + 40 + metrics.call / 2 },
        },
      },
      orb: {
        size,
        rest: { x: half, y: top + size / 2 },
        room: { top: 0, bottom: height },
        read: { x: half / 2, y: top + size / 2 },
        dock: { calls: withCalls.orb, tasks: withTasks.orb },
      },
      words,
      text: "large" as const,
      besideCalls: withCalls.words,
      besideTasks: withTasks.words,
      footer: { ...words, bottom: agentLow + AGENT },
      agent: { ...words, bottom: agentLow },
      lift: { calls: agentHigh - agentLow, tasks: agentHigh - agentLow },
      calls: callsBeside(width),
      tasks: { width: tasks, place: "beside" },
      pulls: false,
      add: leading(foot),
    };
  }

  const orbY = below + 40 + size / 2;
  const words = { ...measure(0, width), top: orbY + size / 2 + 24 };

  return {
    kind: "stacked",
    controls: {
      center: {
        open: { x: width / 2, y: foot },
        calls: withCalls.controls,
        tasks: withTasks.controls,
        rest: { x: width / 2, y: foot },
      },
    },
    orb: {
      size,
      rest: { x: width / 2, y: (below + foot - metrics.call / 2) / 2 },
      room: { top: below, bottom: height },
      read: { x: width / 2, y: orbY },
      dock: { calls: withCalls.orb, tasks: withTasks.orb },
    },
    words,
    text: "large" as const,
    besideCalls: withCalls.words,
    besideTasks: withTasks.words,
    footer: { ...words, bottom: agentHigh + AGENT },
    agent: { ...words, bottom: agentHigh },
    lift: { calls: 0, tasks: 0 },
    calls: callsBeside(width),
    tasks: { width: tasks, place: "beside" },
    pulls: false,
    add: leading(foot),
  };
};

export const callsBeside = (width: number, below?: number): CallsPlacement => {
  const placement: CallsPlacement =
    width - LIST >= breakpoint.page
      ? { width: LIST, place: "beside" }
      : { width: width - CALL_PEEK, place: "slide" };

  return below === undefined ? placement : { ...placement, below };
};

const measure = (from: number, to: number): Span => {
  const width = Math.min(to - from - 2 * metrics.gutter, MEASURE);

  return { x: from + (to - from - width) / 2, width };
};

const split = (box: Box, fold?: number): Stage => {
  const { width: across, height, safe, controls } = box;
  const bottomInset = footOf(box);
  const pane = fold ?? across / 2;
  const page = fold === undefined ? pane : fold + WORDS_OFF_FOLD;
  const right = across - metrics.gutter;
  const words = { x: page, width: Math.min(right - page, WORDS_BESIDE) };
  const agentBottom = controls ? safe.bottom : bottomInset + metrics.call + 14;
  const top = controls ? safe.top + 72 : box.bar + 16;

  return {
    kind: "split",
    controls: controls ?? { right: metrics.gutter, bottom: bottomInset, axis: "row" },
    orb: {
      size: Math.min(pane * 0.62, height * 0.42, 300),
      rest: { x: across / 2, y: height / 2 },
      room: { top: 0, bottom: height },
      read: { x: pane / 2, y: height / 2 },
    },
    words: { ...words, top },
    text: "regular" as const,
    besideCalls: { x: page, width: right - page, top },
    besideTasks: { ...words, top },
    footer: { ...words, bottom: agentBottom + AGENT },
    agent: { ...words, bottom: agentBottom },
    lift: { calls: 0, tasks: 0 },
    calls: fold === undefined ? callsBeside(across) : { width: pane, place: "beside" },
    tasks: { width: TASKS, place: "sheet" },
    pulls: false,
    add: leading(height - (controls ? safe.bottom + 8 : bottomInset) - metrics.docked / 2),
  };
};

const stacked = (box: Box, fold: number): Stage => {
  const base = single(box);
  const top = topOf(box);
  const size = Math.min(base.orb.size, (fold - top) * 0.78);
  const words = { ...base.words, top: fold + WORDS_OFF_FOLD };
  const read = { x: base.orb.rest.x, y: (top + fold) / 2 };

  return {
    ...base,
    kind: "stacked",
    orb: { ...base.orb, size, read },
    words,
    besideCalls: words,
    besideTasks: words,
    pulls: false,
    add: leading(fold - GAP - metrics.docked / 2),
  };
};

export const wordsBefore = (
  box: Box,
  { words, agent }: Stage,
  fold: Fold,
): Words & { raise: number } => {
  if ("x" in fold) {
    const x = metrics.gutter;
    const width = Math.min(fold.x - WORDS_OFF_FOLD - x, WORDS_BESIDE);

    return { x, width, top: words.top, raise: 0 };
  }

  const raise = box.height - fold.y + WORDS_OFF_FOLD - agent.bottom;

  return { ...words, top: topOf(box) + 12, raise };
};
