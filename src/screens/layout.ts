import { callsBeside, stageLayout, wordsBefore } from "@/call/stage";
import type { Box, CallsPlacement, ColumnControls, Stage, Words } from "@/call/stage";
import type { Fold, Insets, Rect, Room, Size } from "@/screens/window";
import { metrics, space, stack } from "@/ui/tokens";
import type { ToolbarGaps } from "@/ui/tokens";

const GAP = 12;

export const COLUMN = { top: GAP + 4, clear: 8 };

const TASKS_AND_SETTINGS = 2 * metrics.tool + metrics.toolbar.row;

const BACK = metrics.tool + metrics.toolbar.row;
const RAIL = 96;
const WORDS = 600;
const LIST = 360;
const RAIL_ORB = 44;

const SHORT_COLUMN = 520;

export const BAR_ORB = 34;
export const BAR_TIME = 16;
const BAR_TIME_WIDTH = 44;

const STATUS_DROP = 7;

interface Place {
  x: number;
  y: number;
}

type Spot = Place & { size?: number };

interface Span {
  x: number;
  width: number;
}

type Toolbar = Spot & { width: number; axis: "row" | "column"; gaps?: ToolbarGaps };

export interface Duo {
  tasks: Page;
  beside?: { tasks: Page; typing?: Page; words: Words & { raise: number }; button: Place };
  call: {
    orb: Required<Spot>;
    time: Place & { width: number; align: "center" | "left" };
    controls?: { right: number; top: number };
  };
}

export interface Page {
  area: Rect;
  margin: Insets;
  foot: number | "fold";
}

export type Layout = Stage & {
  content: Rect;
  toolbar: Toolbar;
  column?: { bar: "left" | "right" };
  inbox?: Inbox;
  duo?: Duo;
};

export interface Inbox {
  width: number;
  top: number;
  orb: Required<Spot>;
  controls: Place;
}

export const screenLayout = (room: Room, { call = true } = {}): Layout => {
  const { insets, regular, bar } = room;
  const frame = frameFor(room);
  const { fold } = room;
  const { content, toolbar } = frame;

  const box: Box = {
    width: content.width,
    height: content.height,
    safe: { top: insets.top, bottom: insets.bottom },
    bar: frame.column ? 0 : toolbar.y + metrics.tool,
    fold: fold && ("x" in fold ? { x: fold.x - content.x } : fold),
    controls: frame.column?.controls,
    regular,
  };

  const layout = stageLayout(box);

  if (!bar && !fold) {
    return {
      ...layout,
      content,
      toolbar,
      inbox: regular ? rail(frame) : undefined,
    };
  }

  const before = box.fold && wordsBefore(box, layout, box.fold);

  const duo = frame.column
    ? besideColumn(frame, frame.column, fold, before)
    : belowBand(frame, fold, before);

  const calls = frame.column ? layout.calls : callsBeside(box.width, frame.top);
  const banded = !frame.column && calls.place === "beside";
  const whole = !call && layout.kind !== "split";

  const besideCalls = banded
    ? {
        ...layout.words,
        x: LIST + metrics.gutter,
        width: Math.min(box.width - LIST - 2 * metrics.gutter, WORDS),
      }
    : layout.besideCalls;

  return {
    ...layout,
    content,
    toolbar,
    calls: whole ? { ...calls, width: content.width, place: "over" } : calls,
    besideCalls,
    tasks: { width: content.width, place: "page" },
    column: frame.column && { bar: frame.column.x === 0 ? "left" : "right" },
    orb:
      calls.place === "beside"
        ? { ...layout.orb, dock: orbBesideCalls(frame, box, layout, calls, duo) }
        : layout.orb,
    duo,
  };
};

const orbBesideCalls = (
  frame: Frame,
  box: Box,
  layout: Stage,
  calls: CallsPlacement,
  duo: Duo,
): NonNullable<Stage["orb"]["dock"]> => {
  const from = calls.width;
  const to = frame.column ? frame.column.x - frame.content.x : box.width;

  const rest = {
    x: (from + to) / 2,
    y: layout.orb.read.y,
    size: Math.min(layout.orb.size, (to - from) * 0.62),
  };

  const docked = { ...duo.call.orb, x: duo.call.orb.x - frame.content.x };

  return { calls: rest, read: frame.column ? docked : undefined, tasks: docked };
};

const rail = ({ window, top, bottomInset }: Frame): Inbox => {
  const foot = window.height - bottomInset - metrics.call / 2;

  return {
    width: window.width - RAIL,
    top,
    orb: { x: RAIL / 2, y: foot - metrics.call / 2 - 20 - RAIL_ORB / 2, size: RAIL_ORB },
    controls: { x: RAIL / 2, y: foot },
  };
};

interface Frame {
  window: Size;
  insets: Insets;
  bottomInset: number;
  content: Rect;
  toolbar: Toolbar;
  column?: Span & { center: number; controls: ColumnControls };
  top: number;
}

const frameFor = ({ size: window, insets, regular, bar, fold, occlusions }: Room): Frame => {
  const bottomInset = Math.max(insets.bottom, 20) + 14;

  if (bar) {
    return { window, insets, bottomInset, ...columnFrame(window, insets, bar, occlusions) };
  }

  const toolbar = fold
    ? band(window, insets, occlusions)
    : {
        x: metrics.gutter,
        y: insets.top + (regular ? 16 : 12),
        width: window.width - 2 * metrics.gutter,
        axis: "row" as const,
      };

  return {
    window,
    insets,
    bottomInset,
    content: { x: 0, y: 0, width: window.width, height: window.height },
    toolbar,
    top: Math.max(insets.top, toolbar.y + metrics.tool),
  };
};

const band = (window: Size, insets: Insets, occlusions: Rect[]): Toolbar => {
  const status = occlusions.filter((area) => area.y + area.height / 2 < insets.top);

  return {
    ...widestClear(metrics.gutter, window.width - metrics.gutter, status),
    y: insets.top / 2 + STATUS_DROP - metrics.tool / 2,
    axis: "row",
  };
};

const widestClear = (from: number, to: number, taken: Rect[]): Span => {
  let best = { x: from, width: 0 };
  let start = from;

  for (const area of taken.toSorted((a, b) => a.x - b.x)) {
    const end = Math.min(to, area.x - GAP);

    if (end - start > best.width) {
      best = { x: start, width: end - start };
    }

    start = Math.max(start, area.x + area.width + GAP);
  }

  return to - start > best.width ? { x: start, width: to - start } : best;
};

const columnFrame = (window: Size, insets: Insets, bar: "left" | "right", occlusions: Rect[]) => {
  const width = bar === "right" ? insets.right : insets.left;
  const x = bar === "right" ? window.width - width : 0;
  const covers = occlusions.filter((area) => area.x < x + width && area.x + area.width > x);
  const high = (area: Rect) => area.y + area.height / 2 < window.height / 2;

  const top = Math.max(
    insets.top,
    ...covers.flatMap((area) => (high(area) ? [area.y + area.height] : [])),
  );

  const foot = Math.max(
    insets.bottom,
    ...covers.flatMap((area) => (high(area) ? [] : [window.height - area.y + COLUMN.clear])),
  );

  const statusItems = covers.filter((area) => area.width < width);

  const center = statusItems.length
    ? statusItems.reduce((sum, area) => sum + area.x + area.width / 2, 0) / statusItems.length
    : x + width / 2;

  const tight = window.height < SHORT_COLUMN;

  return {
    content: { x: x === 0 ? width : 0, y: 0, width: window.width - width, height: window.height },
    toolbar: {
      x: center - metrics.tool / 2,
      y: Math.max(top, COLUMN.top),
      width: metrics.tool,
      axis: "column" as const,
      gaps: tight ? ("compact" as const) : ("regular" as const),
    },
    column: {
      x,
      width,
      center,
      controls: {
        right: window.width - center - metrics.call / 2,
        bottom: foot,
        axis: "column" as const,
        size: tight ? ("compact" as const) : ("regular" as const),
      },
    },
    top: insets.top,
  };
};

const besideColumn = (
  frame: Frame,
  column: NonNullable<Frame["column"]>,
  fold?: Fold,
  before?: Words & { raise: number },
): Duo => {
  const { window, insets, toolbar } = frame;
  const gaps = metrics.toolbar[toolbar.gaps ?? "regular"];
  const size = column.controls.size ?? "regular";
  const sizes = metrics.controls[size];
  const x = column.center;
  const reach = Math.max(metrics.tool, metrics[sizes.mute], metrics[sizes.call]) / 2;
  const leading = column.x === 0;

  const { tasks, after } = paged(
    window,
    {
      area: {
        ...(leading
          ? { x: x + reach, width: window.width - x - reach }
          : { x: 0, width: x - reach }),
        y: insets.top,
        height: window.height - insets.top,
      },
      foot: insets.bottom,
    },
    fold,
  );

  const tools = toolbar.y + 4 * metrics.tool + gaps.tools + 2 * gaps.group;
  const buttons = window.height - column.controls.bottom - stack(size);
  const below = BAR_TIME + (after ? 12 + metrics.tool : 0);
  const orb = buttons - tools >= BAR_ORB + 4 + below + 2 * space[1] ? BAR_ORB : 0;
  const group = (orb && orb + 4) + below;
  const y = (tools + buttons - group) / 2;
  const time = y + (orb && orb + 4);

  return {
    tasks,
    beside: after &&
      before && {
        tasks: after,
        words: before,
        button: { x, y: time + BAR_TIME + 12 + metrics.tool / 2 },
      },
    call: {
      orb: { x, y: y + orb / 2, size: orb },
      time: { x: x - BAR_TIME_WIDTH / 2, y: time, width: BAR_TIME_WIDTH, align: "center" },
    },
  };
};

const belowBand = (frame: Frame, fold?: Fold, before?: Words & { raise: number }): Duo => {
  const { window, insets, toolbar, top } = frame;

  const {
    tasks,
    after,
    before: above,
  } = paged(
    window,
    {
      area: { x: 0, y: top, width: window.width, height: window.height - top },
      foot: insets.bottom,
    },
    fold,
  );

  const end = toolbar.x + toolbar.width - BACK - TASKS_AND_SETTINGS - GAP;
  const middle = toolbar.y + metrics.tool / 2;
  const mute = end - stack("tool");
  const button = { x: mute - 14 - metrics.tool / 2, y: middle };
  const time = (after ? button.x - metrics.tool / 2 - 10 : mute - 14) - BAR_TIME_WIDTH;

  return {
    tasks,
    beside: after && before && { tasks: after, typing: above, words: before, button },
    call: {
      orb: { x: time - 6 - BAR_ORB / 2, y: middle, size: BAR_ORB },
      time: { x: time, y: middle - BAR_TIME / 2, width: BAR_TIME_WIDTH, align: "left" },
      controls: { right: window.width - end, top: toolbar.y },
    },
  };
};

interface Paged {
  tasks: Page;
  after?: Page;
  before?: Page;
}

const paged = (window: Size, { area, foot }: { area: Rect; foot: number }, fold?: Fold): Paged => {
  const at = (rect: Rect, end: number | "fold"): Page => ({
    area: rect,
    margin: {
      top: rect.y,
      right: window.width - rect.x - rect.width,
      bottom: window.height - rect.y - rect.height,
      left: rect.x,
    },
    foot: end,
  });

  const tasks = at(area, foot);

  if (!fold) {
    return { tasks };
  }

  if ("x" in fold) {
    return { tasks, after: at({ ...area, x: fold.x, width: area.x + area.width - fold.x }, foot) };
  }

  return {
    tasks,
    after: at({ ...area, y: fold.y, height: area.y + area.height - fold.y }, foot),
    before: at({ ...area, height: fold.y - area.y }, "fold"),
  };
};
