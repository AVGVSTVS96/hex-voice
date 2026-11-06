import {
  callsBeside,
  stageLayout,
  wordsBefore,
  type Box,
  type CallsPlacement,
  type ColumnControls,
  type Stage,
  type Words,
} from '@/call/stage';
import { breakpoint, metrics, stack, type ToolbarGaps } from '@/ui/tokens';

import { columnOf, type Column } from '@/screens/column';
import type { Insets, Rect, Room, Size } from '@/screens/window';

const GAP = 12;
// The toolbar's Tasks and settings, one glass capsule.
const PAIR = 2 * metrics.tool + metrics.toolbar.row;
const RAIL = 96;
const WORDS = 600;
const LIST = 360;
const RAIL_ORB = 44;
// On a call with Tasks open, the orb this big and the call's time this tall and wide join the bar.
export const CALL_ORB = 34;
export const TIME = 16;
const TIME_WIDTH = 44;
// iPhone Duo open on its side reserves its whole top band for the status items but draws them this
// far below the band's middle, as measured in the simulator: the time and battery center 48 down 82.
const STATUS_DROP = 7;

type Place = { x: number; y: number };
type Spot = Place & { size?: number };
type Span = { x: number; width: number };
type Toolbar = Spot & { width: number; axis: 'row' | 'column'; gaps?: ToolbarGaps };

// The screen's regions for the room its window has, never the device's pose: where the call
// stage's box sits and what it keeps clear of, the toolbar, and where Calls and Tasks come in. The
// stage lays out its own content from its box (`stageLayout`). Where the system puts its bars down
// the side (iPhone Duo), the toolbar and call buttons move into that side column, and the stage's
// box is the rest of the screen. Where they stay along the top (iPhone Duo open on its side), the
// toolbar moves up into that band beside the status items. Where the window's fold parts it, the
// call and Tasks part there too, held wide or on its side.
//
// Calls and Tasks come in from the sides, and where they go is all this decides; the call card
// looks the same either way. Calls comes in one of two ways:
// - slide: the call slides aside, showing Calls beneath (the phone, iPhone Duo folded)
// - beside: the call gives up its leading edge to Calls and moves into the room left
// Tasks comes in one of three:
// - beside: the call gives up its trailing edge to Tasks (iPad)
// - sheet: Tasks rises as a sheet (phone)
// - page: Tasks is a place of its own over the call (iPhone Duo, see `Duo`)

// iPhone Duo's Tasks is a place of its own over the call (`tasks`). While it's open on a call, the
// call sits in the bar beside the system's status items: its orb with its time, down the side
// column or across the top band, where the call buttons join them (`controls`) and the tools
// gather at the band's leading end. Open on a call, a button in the bar can give the call's words
// the page before the fold while Tasks keeps the one after it (`beside`). On its side the keyboard
// takes the page after the fold, so while you type there Tasks moves to the page before it
// (`typing`), the way a laptop keeps what you write above its keys. Spots are the window's.
export type Duo = {
  tasks: Page;
  beside?: { tasks: Page; typing?: Page; words: Words & { raise: number }; button: Place };
  call: {
    orb: Required<Spot>;
    time: Place & { width: number; align: 'center' | 'left' };
    controls?: { right: number; top: number };
  };
};

// Where Tasks lays out: `area` runs as wide as it can without reaching under the bar's buttons or
// the status items, and its content keeps `foot` clear of the home indicator, or ends at the fold.
// Wide enough for two, it takes the window's two halves as two pages side by side, meeting `panes`
// from its start at the window's middle, where the open Duo's crease is. Its rows keep their own
// inset, so its pages run flush to the screen's edges, the crease and the bar's buttons.
//
// `edges` is the same area as the window's edges hold it: a length from an edge that only the
// safe area and the bar set, or half the window. Laid out from them, Tasks takes a new window's
// size in the same pass as the window does, never a frame later.
export type Page = {
  area: Rect;
  edges: Edges;
  panes?: number;
  foot: number | 'fold';
};

type Edges = Record<'top' | 'right' | 'bottom' | 'left', number | '50%'>;

// The stage's parts are in its box's coordinates; `content` is that box in the window's.
export type Layout = Stage & {
  content: Rect;
  toolbar: Toolbar;
  // Before a call on a wide iPad, Tasks opens as a two-column inbox and the call waits in a rail.
  inbox?: Inbox;
  duo?: Duo;
};

// The bar stays where it is over the inbox, so the inbox starts `top` down, under it.
export type Inbox = {
  width: number;
  top: number;
  orb: Required<Spot>;
  controls: Place;
};

export function screenLayout(room: Room): Layout {
  const { insets, regular, bar } = room;
  const frame = frameFor(room);
  const { fold } = room;
  const { content, toolbar } = frame;
  const box: Box = {
    width: content.width,
    height: content.height,
    safe: { top: insets.top, bottom: insets.bottom },
    bar: frame.column ? 0 : toolbar.y + metrics.tool,
    fold: fold && ('x' in fold ? { x: fold.x - content.x } : fold),
    controls: frame.column?.controls,
    regular,
  };
  const layout = stageLayout(box);
  if (!bar && !fold)
    return {
      ...layout,
      content,
      toolbar,
      inbox: regular && box.width > box.height ? rail(frame) : undefined,
    };
  const before = box.fold && wordsBefore(box, layout, box.fold);
  const duo = frame.column ? besideColumn(frame, frame.column, before) : belowBand(frame, before);
  // Open on its side Calls comes in under the band, leaving the band whole. It sits beside the
  // call, as on iPad, only where that leaves the call a page; otherwise it slides over all but a
  // peek of the call, as on the phone.
  const calls = frame.column ? layout.calls : callsBeside(box.width, frame.top);
  const banded = !frame.column && calls.place === 'beside';
  return {
    ...layout,
    content,
    toolbar,
    calls,
    // Beside Calls on its side, the words keep to the room the call has left.
    ...(!banded
      ? {}
      : {
          besideCalls: {
            ...layout.words,
            x: LIST + metrics.gutter,
            width: Math.min(box.width - LIST - 2 * metrics.gutter, WORDS),
          },
        }),
    tasks: { width: content.width, place: 'page' },
    // Where Calls comes in beside the call, the orb's place is under it, so it rests whole in the
    // room the call has left. Upright that room is the words' page, so once there are words it
    // docks in the column, at the spot it takes when Tasks opens on a call; on its side it waits
    // above them.
    orb:
      calls.place === 'beside'
        ? { ...layout.orb, dock: roomFor(frame, box, layout, calls, duo) }
        : layout.orb,
    duo,
  };
}

// The orb's spots beside Calls, in the stage's box.
function roomFor(
  frame: Frame,
  box: Box,
  layout: Stage,
  calls: CallsPlacement,
  duo: Duo,
): NonNullable<Stage['orb']['dock']> {
  const from = calls.width;
  const to = frame.column ? frame.column.x - frame.content.x : box.width;
  const rest = {
    x: (from + to) / 2,
    y: layout.orb.read.y,
    size: Math.min(layout.orb.size, (to - from) * 0.62),
  };
  const docked = { ...duo.call.orb, x: duo.call.orb.x - frame.content.x };
  return { calls: rest, read: frame.column ? docked : undefined, tasks: docked };
}

// Before a call on a wide iPad, the rail the call waits in beside the inbox.
function rail({ window, top, bottomInset }: Frame): Inbox {
  const foot = window.height - bottomInset - metrics.call / 2;
  return {
    width: window.width - RAIL,
    top,
    orb: { x: RAIL / 2, y: foot - metrics.call / 2 - 20 - RAIL_ORB / 2, size: RAIL_ORB },
    controls: { x: RAIL / 2, y: foot },
  };
}

type Frame = {
  window: Size;
  insets: Insets;
  bottomInset: number;
  content: Rect;
  toolbar: Toolbar;
  // iPhone Duo's side column, the tools at its top and the call buttons at its foot, centered on
  // `middle`.
  column?: Span & { middle: number; controls: ColumnControls };
  top: number;
};

function frameFor(room: Room): Frame {
  const { size: window, insets, regular, fold, occlusions } = room;
  const bottomInset = Math.max(insets.bottom, 20) + 14;
  const side = columnOf(room);
  if (side) return { window, insets, bottomInset, ...column(room, side) };
  const toolbar = fold
    ? band(window, insets, occlusions)
    : {
        x: metrics.gutter,
        y: insets.top + (regular ? 16 : 12),
        width: window.width - 2 * metrics.gutter,
        axis: 'row' as const,
      };
  return {
    window,
    insets,
    bottomInset,
    content: { x: 0, y: 0, width: window.width, height: window.height },
    toolbar,
    top: Math.max(insets.top, toolbar.y + metrics.tool),
  };
}

// iPhone Duo open on its side: the system's status items sit in the band along the top, and the
// toolbar takes the widest stretch of that band they leave, level with them.
function band(window: Size, insets: Insets, occlusions: Rect[]): Toolbar {
  const status = occlusions.filter((area) => area.y + area.height / 2 < insets.top);
  return {
    ...widestClear(metrics.gutter, window.width - metrics.gutter, status),
    y: insets.top / 2 + STATUS_DROP - metrics.tool / 2,
    axis: 'row',
  };
}

function widestClear(from: number, to: number, taken: Rect[]): Span {
  let best = { x: from, width: 0 };
  let start = from;
  for (const area of [...taken].sort((a, b) => a.x - b.x)) {
    const end = Math.min(to, area.x - GAP);
    if (end - start > best.width) best = { x: start, width: end - start };
    start = Math.max(start, area.x + area.width + GAP);
  }
  return to - start > best.width ? { x: start, width: to - start } : best;
}

// iPhone Duo's side column (`columnOf`): the tools start below what's at its top, the call buttons
// end above what's at its foot, and both center on the system's items in it.
function column(room: Room, { bar, width, shift, top, foot, tight }: Column) {
  const { size: window, insets } = room;
  const x = bar === 'right' ? window.width - width : 0;
  const middle = x + width / 2 + shift;
  return {
    content: { x: x === 0 ? width : 0, y: 0, width: window.width - width, height: window.height },
    toolbar: {
      x: middle - metrics.tool / 2,
      y: top,
      width: metrics.tool,
      axis: 'column' as const,
      gaps: tight ? ('compact' as const) : ('regular' as const),
    },
    column: {
      x,
      width,
      middle,
      controls: {
        right: window.width - middle - metrics.call / 2,
        bottom: foot,
        axis: 'column' as const,
        size: tight ? ('compact' as const) : ('regular' as const),
      },
    },
    top: insets.top,
  };
}

// iPhone Duo with its side column (see `Duo`). Tasks runs from the screen's edge to the column, the
// bar's inset, which holds the buttons and the orb docked between them; on a call the orb, its time and, open, the words'
// switch sit as one group midway between the tools and the call buttons.
function besideColumn(
  frame: Frame,
  column: NonNullable<Frame['column']>,
  before?: Words & { raise: number },
): Duo {
  const { window, insets, toolbar } = frame;
  const gaps = metrics.toolbar[toolbar.gaps ?? 'regular'];
  const size = column.controls.size ?? 'regular';
  const x = column.middle;
  const { tasks, after } = paged(window, {
    top: insets.top,
    ...(column.x === 0 ? { left: column.width, right: 0 } : { left: 0, right: column.width }),
    foot: insets.bottom,
  });
  const tools = toolbar.y + 3 * metrics.tool + gaps.tools + gaps.group;
  const buttons = window.height - column.controls.bottom - stack(size);
  const group = CALL_ORB + 4 + TIME + (before ? 12 + metrics.tool : 0);
  const y = (tools + buttons - group) / 2;
  const time = y + CALL_ORB + 4;
  return {
    tasks,
    beside: before && {
      tasks: after,
      words: before,
      button: { x, y: time + TIME + 12 + metrics.tool / 2 },
    },
    call: {
      orb: { x, y: y + CALL_ORB / 2, size: CALL_ORB },
      time: { x: x - TIME_WIDTH / 2, y: time, width: TIME_WIDTH, align: 'center' },
    },
  };
}

// iPhone Duo open on its side, its toolbar in the band along the top (see `Duo`). Tasks takes the
// screen below the band. The toolbar keeps Calls at the band's leading end and Tasks with settings
// at its trailing end, and the call buttons just before that pair, whether Tasks is open or not.
// With Tasks open on a call, before them sit the words' switch, then the orb with its time.
function belowBand(frame: Frame, before?: Words & { raise: number }): Duo {
  const { window, insets, toolbar, top } = frame;
  const {
    tasks,
    after,
    before: above,
  } = paged(window, { top, left: 0, right: 0, foot: insets.bottom });
  const end = toolbar.x + toolbar.width - PAIR - 2 * GAP;
  const middle = toolbar.y + metrics.tool / 2;
  const mute = end - stack('tool');
  const button = { x: mute - 14 - metrics.tool / 2, y: middle };
  const time = (before ? button.x - metrics.tool / 2 - 10 : mute - 14) - TIME_WIDTH;
  return {
    tasks,
    beside: before && { tasks: after, typing: above, words: before, button },
    call: {
      orb: { x: time - 6 - CALL_ORB / 2, y: middle, size: CALL_ORB },
      time: { x: time, y: middle - TIME / 2, width: TIME_WIDTH, align: 'left' },
      controls: { right: window.width - end, top: toolbar.y },
    },
  };
}

// Tasks between the window's edges `top`, `left` and `right`, and its halves. Wide enough for two
// pages, it takes the halves side by side, a list beside its topic, as a split view does on a wide
// screen; narrower, it's one page. The half after the middle is the page it keeps when the call's
// words take the one before it: the trailing half held wide, the lower one on its side, where the
// upper half is the one it types in.
function paged(
  window: Size,
  { top, left, right, foot }: { top: number; left: number; right: number; foot: number },
): { tasks: Page; after: Page; before?: Page } {
  const middle = { x: window.width / 2, y: window.height / 2 };
  const area = { x: left, y: top, width: window.width - left - right, height: window.height - top };
  const edges: Edges = { top, right, bottom: 0, left };
  const tasks = { area, edges, foot };
  if (window.width >= breakpoint.columns)
    return {
      tasks: { ...tasks, panes: middle.x - left },
      after: {
        area: { ...area, x: middle.x, width: area.x + area.width - middle.x },
        edges: { ...edges, left: '50%' },
        foot,
      },
    };
  return {
    tasks,
    after: {
      area: { ...area, y: middle.y, height: window.height - middle.y },
      edges: { ...edges, top: '50%' },
      foot,
    },
    before: {
      area: { ...area, height: middle.y - top },
      edges: { ...edges, bottom: '50%' },
      foot: 'fold',
    },
  };
}
