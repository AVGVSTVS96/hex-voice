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
import { metrics, space, stack, type ToolbarGaps } from '@/ui/tokens';

import type { Fold, Insets, Rect, Room, Size } from '@/screens/window';

const GAP = 12;
// The toolbar's Tasks and settings, one glass capsule.
const PAIR = 2 * metrics.tool + metrics.toolbar.row;
const RAIL = 96;
const WORDS = 600;
const LIST = 360;
const RAIL_ORB = 44;
// iPhone Duo's column: below this height (folded on its side) its buttons draw smaller and closer.
const SHORT = 520;
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
// - over: Calls slides in over the call, which stays where it is. On iPhone Duo with no call to
//   show (`call` false) it does, across the whole content, short of a page of its own open upright:
//   there's nothing of a call to peek at or sit beside, and its buttons stay in the column or band.
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
// `margin` is how far the window runs past it on each side, which opening or folding the Duo
// leaves as it was, so Tasks is laid out by it and fills the new window in the frame it changes.
// Its rows keep their own inset, so its pages run flush to the screen's edges, the fold and the
// bar's buttons.
export type Page = {
  area: Rect;
  margin: Insets;
  foot: number | 'fold';
};

// The stage's parts are in its box's coordinates; `content` is that box in the window's.
export type Layout = Stage & {
  content: Rect;
  toolbar: Toolbar;
  // iPhone Duo's side column, laid out natively beside the content (src/screens/side-column.tsx):
  // the side it's on, how far the system's items sit from its middle, where its tools start and how
  // far up from the foot its call buttons end.
  column?: { bar: 'left' | 'right'; shift: number; top: number; foot: number };
  // Before a call on iPad, Tasks opens across the screen as an inbox and the call waits in a rail.
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

export function screenLayout(room: Room, { call = true } = {}): Layout {
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
      inbox: regular ? rail(frame) : undefined,
    };
  const before = box.fold && wordsBefore(box, layout, box.fold);
  const duo = frame.column
    ? besideColumn(frame, frame.column, fold, before)
    : belowBand(frame, fold, before);
  // Open on its side Calls comes in under the band, leaving the band whole. It sits beside the
  // call, as on iPad, only where that leaves the call a page; otherwise it slides over all but a
  // peek of the call, as on the phone.
  const calls = frame.column ? layout.calls : callsBeside(box.width, frame.top);
  const banded = !frame.column && calls.place === 'beside';
  const whole = !call && layout.kind !== 'split';
  return {
    ...layout,
    content,
    toolbar,
    calls: whole ? { ...calls, width: content.width, place: 'over' } : calls,
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
    column: frame.column && {
      bar: frame.column.x === 0 ? 'left' : 'right',
      shift: frame.column.center - (frame.column.x + frame.column.width / 2),
      top: toolbar.y,
      foot: frame.column.controls.bottom,
    },
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

// Before a call on iPad, the rail the call waits in beside the inbox.
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
  // iPhone Duo's side column, the tools at its top and the call buttons at its foot.
  column?: Span & { center: number; controls: ColumnControls };
  top: number;
};

function frameFor({ size: window, insets, regular, bar, fold, occlusions }: Room): Frame {
  const bottomInset = Math.max(insets.bottom, 20) + 14;
  if (bar) return { window, insets, bottomInset, ...column(window, insets, bar, occlusions) };
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

// iPhone Duo's side column. The camera and the system's status items sit at its top upright and
// at its foot on its side; the tools start below what's at the top, and the call buttons end above
// what's at the foot.
function column(window: Size, insets: Insets, bar: 'left' | 'right', occlusions: Rect[]) {
  const width = bar === 'right' ? insets.right : insets.left;
  const x = bar === 'right' ? window.width - width : 0;
  const covers = occlusions.filter((area) => area.x < x + width && area.x + area.width > x);
  const high = (area: Rect) => area.y + area.height / 2 < window.height / 2;
  const top = covers
    .filter(high)
    .reduce((bottom, area) => Math.max(bottom, area.y + area.height), insets.top);
  const foot = covers
    .filter((area) => !high(area))
    .reduce((bottom, area) => Math.max(bottom, window.height - area.y + 8), insets.bottom);
  // The system draws its time, wifi and camera a few points toward the screen from the inset's
  // middle, where the camera's occlusion is, so the column's buttons center on those.
  const items = covers.filter((area) => area.width < width);
  const center = items.length
    ? items.reduce((sum, area) => sum + area.x + area.width / 2, 0) / items.length
    : x + width / 2;
  // A short column (folded on its side) draws its buttons smaller and closer, so the call's orb and
  // time still fit between the tools and the call buttons.
  const tight = window.height < SHORT;
  return {
    content: { x: x === 0 ? width : 0, y: 0, width: window.width - width, height: window.height },
    toolbar: {
      x: center - metrics.tool / 2,
      y: Math.max(top, GAP + 4),
      width: metrics.tool,
      axis: 'column' as const,
      gaps: tight ? ('compact' as const) : ('regular' as const),
    },
    column: {
      x,
      width,
      center,
      controls: {
        right: window.width - center - metrics.call / 2,
        bottom: foot,
        axis: 'column' as const,
        size: tight ? ('compact' as const) : ('regular' as const),
      },
    },
    top: insets.top,
  };
}

// iPhone Duo with its side column (see `Duo`). Tasks runs from the screen's edge to the column's
// buttons, short of the orb docked between them; on a call the orb, its time and, open, the words'
// switch sit as one group midway between the tools and the call buttons.
function besideColumn(
  frame: Frame,
  column: NonNullable<Frame['column']>,
  fold?: Fold,
  before?: Words & { raise: number },
): Duo {
  const { window, insets, toolbar } = frame;
  const gaps = metrics.toolbar[toolbar.gaps ?? 'regular'];
  const size = column.controls.size ?? 'regular';
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
  // Back, Calls, then Tasks with settings.
  const tools = toolbar.y + 4 * metrics.tool + gaps.tools + 2 * gaps.group;
  const buttons = window.height - column.controls.bottom - stack(size);
  const below = TIME + (after ? 12 + metrics.tool : 0);
  // Folded on its side the column is too short for Back and the orb both: the call there is its time.
  const orb = buttons - tools >= CALL_ORB + 4 + below + 2 * space[1] ? CALL_ORB : 0;
  const group = (orb && orb + 4) + below;
  const y = (tools + buttons - group) / 2;
  const time = y + (orb && orb + 4);
  return {
    tasks,
    beside: after &&
      before && {
        tasks: after,
        words: before,
        button: { x, y: time + TIME + 12 + metrics.tool / 2 },
      },
    call: {
      orb: { x, y: y + orb / 2, size: orb },
      time: { x: x - TIME_WIDTH / 2, y: time, width: TIME_WIDTH, align: 'center' },
    },
  };
}

// iPhone Duo open on its side, its toolbar in the band along the top (see `Duo`). Tasks takes the
// screen below the band. The toolbar keeps Calls at the band's leading end and Tasks with settings
// at its trailing end, and the call buttons just before that pair, whether Tasks is open or not.
// With Tasks open on a call, before them sit the words' switch, then the orb with its time.
function belowBand(frame: Frame, fold?: Fold, before?: Words & { raise: number }): Duo {
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
  const end = toolbar.x + toolbar.width - PAIR - 2 * GAP;
  const middle = toolbar.y + metrics.tool / 2;
  const mute = end - stack('tool');
  const button = { x: mute - 14 - metrics.tool / 2, y: middle };
  const time = (after ? button.x - metrics.tool / 2 - 10 : mute - 14) - TIME_WIDTH;
  return {
    tasks,
    beside: after && before && { tasks: after, typing: above, words: before, button },
    call: {
      orb: { x: time - 6 - CALL_ORB / 2, y: middle, size: CALL_ORB },
      time: { x: time, y: middle - TIME / 2, width: TIME_WIDTH, align: 'left' },
      controls: { right: window.width - end, top: toolbar.y },
    },
  };
}

// Tasks over a page's area, and the page after the fold, the one it keeps when the call's words
// take the one before it. Held wide that's the page from the fold to the screen's end; on its side
// the screen is one tall page and the keyboard takes the bottom one, so the page before the fold is
// where it types beside the call's words.
function paged(
  window: Size,
  { area, foot }: { area: Rect; foot: number },
  fold?: Fold,
): { tasks: Page; after?: Page; before?: Page } {
  const at = (area: Rect, foot: number | 'fold'): Page => ({
    area,
    margin: {
      top: area.y,
      right: window.width - area.x - area.width,
      bottom: window.height - area.y - area.height,
      left: area.x,
    },
    foot,
  });
  const tasks = at(area, foot);
  if (!fold) return { tasks };
  if ('x' in fold)
    return { tasks, after: at({ ...area, x: fold.x, width: area.x + area.width - fold.x }, foot) };
  return {
    tasks,
    after: at({ ...area, y: fold.y, height: area.y + area.height - fold.y }, foot),
    before: at({ ...area, height: fold.y - area.y }, 'fold'),
  };
}
