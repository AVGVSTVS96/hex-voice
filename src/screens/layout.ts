import type { Pose, Rect, Region } from '../../modules/pose';

export const GUTTER = 24;
export const TOOL = 48;
export const CONTROLS = 64;
export const MUTE = 60;
export const GAP = 12;
export const DOCKED = 52;
// The toolbar's Tasks and settings, one glass capsule.
export const PAIR = 2 * TOOL + GAP;
export const RAIL = 96;
const AGENT = 22;
const COLUMN = 84;
const WORDS = 600;
const WORDS_BESIDE = 520;
const MEASURE = 680;
const LIST = 360;
const SIDEBAR = 330;
const TASKS = 380;
const CALL = 368;
const RAIL_ORB = 44;
const BESIDE_MUTE = 56;
// iPhone Duo's column: below this height (folded on its side) its buttons draw smaller and closer.
const SHORT = 520;
const COLUMN_GAPS = { tools: 32, group: 16 };
const TIGHT_GAPS = { tools: 12, group: 10 };
const SIZES = { mute: MUTE, call: CONTROLS, gap: GAP };
const TIGHT_SIZES = { mute: 48, call: 52, gap: 10 };
// On a call with Tasks open, the orb this big and the call's time this tall and wide join the bar.
export const CALL_ORB = 34;
export const TIME = 16;
const TIME_WIDTH = 44;
// Tasks' rows keep their own inset, so its pages run flush to the screen's edges, the fold and the
// bar's buttons.
const FLUSH = { left: 0, right: 0 };
// Persona's Rive art fills three quarters of its view, as measured in the simulator.
const ART = 0.75;
// iPhone Duo open on its side reserves its whole top band for the status items but draws them this
// far below the band's middle, as measured in the simulator: the time and battery center 48 down 82.
const STATUS_DROP = 7;

type Size = { width: number; height: number };
type Insets = { top: number; right: number; bottom: number; left: number };
type Place = { x: number; y: number };
type Spot = Place & { size?: number };
type Span = { x: number; width: number };
type Words = Span & { top: number };
type Gaps = typeof COLUMN_GAPS;
type Sizes = typeof SIZES;
type Toolbar = Spot & { width: number; axis: 'row' | 'column'; gaps?: Gaps };
type ColumnControls = { right: number; bottom: number; axis: 'row' | 'column'; sizes?: Sizes };

// The call screen's geometry for a window in a pose. It comes in three arrangements:
// - single: the phone's, the orb alone with the words pulled down over it (also iPhone Duo closed)
// - split: the orb on the leading page and the words on the trailing one, both there from the
//   start (iPad landscape, iPhone Duo open)
// - stacked: the orb above and the words below it (iPad portrait, iPhone Duo open on its side)
// Where the system puts its bars down the side (iPhone Duo), the toolbar and call buttons move
// into that side column, and the content is the rest of the screen. Where they stay along the top
// (iPhone Duo open on its side), the toolbar moves up into that band beside the status items.
//
// Whether the words show is decided here once: `pulls` says the words are pulled down over the orb
// (single), and everywhere else they have a place of their own and always show.
//
// Calls and Tasks come in from the sides, and where they go is all this decides; the call card
// looks the same either way. Calls comes in one of two ways:
// - slide: the call slides aside, showing Calls beneath (the phone, iPhone Duo folded)
// - beside: the call gives up its leading edge to Calls and moves into the room left
// Tasks comes in one of three:
// - beside: the call gives up its trailing edge to Tasks (iPad)
// - sheet: Tasks rises as a sheet (phone)
// - page: Tasks is a place of its own over the call (iPhone Duo, see `Duo`)
export type Pane<Place> = { width: number; place: Place };
export type CallsPlacement = Pane<'slide' | 'beside'>;
export type TasksPlacement = Pane<'beside' | 'sheet' | 'page'>;

// iPhone Duo's Tasks is a place of its own over the call (`tasks`). While it's open on a call, the
// call sits in the bar beside the system's status items: its orb with its time, down the side
// column or across the top band, where the call buttons join them (`controls`) and the tools
// gather at the band's leading end. Open, the call can take the page before the fold while Tasks
// keeps the one after it (`beside`), switched by a button in the bar: there the orb waits, and on a
// call its words show (`words`, risen `raise` from where they end). That's how iOS's overlay
// arrangement places a view over another, and so it's where the Duo starts while partly open.
// On its side the keyboard takes the page after the fold, so while you type there Tasks moves to
// the page before it (`typing`), the way a laptop keeps what you write above its keys.
export type Duo = {
  partlyOpen: boolean;
  tasks: Page;
  beside?: { tasks: Page; typing?: Page; words: Words & { raise: number }; button: Place };
  call: {
    orb: Required<Spot>;
    time: Place & { width: number; align: 'center' | 'left' };
    controls?: { right: number; top: number };
  };
};

// Where Tasks' content lays out: `area` runs as wide as it can without reaching under the bar's
// buttons, its content keeps `inset` in from its sides, starts `top` below its top and keeps `foot`
// clear of the home indicator, or ends at the fold. Open, the fold cuts it into two pages (`fold`,
// within `area`).
export type Page = {
  area: Rect;
  fold?: Fold;
  inset: { left: number; right: number };
  top: number;
  foot: number | 'fold';
};

// The fold within Tasks: the pages sit side by side (`row`) or one over the other (`column`), the
// first `at` long, then the fold's band: none open flat, the fold's whole frame partly folded.
export type Fold = { axis: 'row' | 'column'; at: number; band: number };

// Where something sits with nothing beside the call, with Calls beside it, and with Tasks.
export type Beside<T> = { open: T; calls: T; tasks: T };

export type Layout = {
  kind: 'single' | 'split' | 'stacked';
  content: Rect;
  toolbar: Toolbar;
  // Inline, the call buttons close the footer as on the phone; in iPhone Duo's side column they sit
  // on their own; on iPad they're centered at `center`, moving with the room a pane leaves.
  controls: 'inline' | ColumnControls | { center: Beside<Place> };
  // The orb rests at `rest`, kept clear of what's below it within `room`, and moves to `read`
  // when the words show: docked small in the corner, or at full size on its own page. On iPad it
  // docks just before mute in the room a pane leaves (`dock`), never covered or faded.
  orb: {
    size: number;
    rest: Spot;
    room: { top: number; bottom: number };
    read: Spot;
    dock?: { calls: Required<Spot>; tasks: Required<Spot> };
  };
  words: Words;
  text: number;
  // Where the words move while Calls or Tasks sit beside them.
  besideCalls: Words;
  besideTasks: Words;
  footer: Span & { bottom: number };
  agent: Span & { bottom: number };
  // How far the footer and agent line rise while a pane is open, to clear the call buttons that
  // move in under them.
  lift: { calls: number; tasks: number };
  calls: CallsPlacement;
  tasks: TasksPlacement;
  // Before a call on a wide iPad, Tasks opens as a two-column inbox and the call waits in a rail.
  inbox?: Inbox;
  duo?: Duo;
  pulls: boolean;
};

export type Inbox = {
  width: number;
  toolbar: Spot & { width: number; axis: 'column' };
  orb: Required<Spot>;
  controls: Place;
};

export function screenLayout(window: Size, insets: Insets, pose: Pose): Layout {
  const frame = frameFor(window, insets, pose);
  const fold = pose.fold && divide(pose.fold);
  if (pose.regular && !fold && !pose.bar) return pad(frame);
  const layout =
    pose.regular && window.width > window.height
      ? split(frame, fold)
      : fold && fold.width > fold.height
        ? stacked(frame, fold)
        : single(frame);
  if (!pose.bar && !fold) return layout;
  const before = fold && wordsBefore(frame, layout, fold);
  return {
    ...layout,
    tasks: { width: frame.content.width, place: 'page' },
    // Open on its side the call yields its leading edge to Calls, as on iPad.
    ...(frame.column ? {} : { calls: { width: LIST, place: 'beside' } }),
    duo: {
      partlyOpen: !!fold && partly(fold),
      ...(frame.column ? besideColumn(frame, frame.column, before) : belowBand(frame, before)),
    },
  };
}

// What the fold takes from the screen. iOS reports it as a division region that's active only
// while the Duo is partly open; then content keeps to either side of its frame, which already
// holds the margins controls and text keep from the hinge. Open flat it's inactive and nothing
// keeps off it, so the two sides meet at its middle. This is the only place that reads whether
// it's active; everything after asks `partly()` of what it returns.
function divide(fold: Region): Rect {
  if (fold.active) return fold;
  return fold.height > fold.width
    ? { x: fold.x + fold.width / 2, y: fold.y, width: 0, height: fold.height }
    : { x: fold.x, y: fold.y + fold.height / 2, width: fold.width, height: 0 };
}

function partly(fold: Rect) {
  return Math.min(fold.width, fold.height) > 0;
}

// How far the call's words keep from the fold: flat it's a bare line, so a small gap; partly open
// its frame already holds the margins, so none more.
function clear(fold: Rect) {
  return partly(fold) ? 0 : 8;
}

type Frame = {
  window: Size;
  insets: Insets;
  bottomInset: number;
  content: Rect;
  toolbar: Toolbar;
  // iPhone Duo's side column, the tools at its top and the call buttons at its foot.
  column?: Span & { controls: ColumnControls };
  top: number;
};

function frameFor(window: Size, insets: Insets, pose: Pose): Frame {
  const bottomInset = Math.max(insets.bottom, 20) + 14;
  if (pose.bar) return { window, insets, bottomInset, ...column(window, insets, pose) };
  const toolbar = pose.fold
    ? band(window, insets, pose.occlusions ?? [])
    : {
        x: GUTTER,
        y: insets.top + (pose.regular ? 16 : 12),
        width: window.width - 2 * GUTTER,
        axis: 'row' as const,
      };
  return {
    window,
    insets,
    bottomInset,
    content: { x: 0, y: 0, width: window.width, height: window.height },
    toolbar,
    top: Math.max(insets.top, toolbar.y + TOOL),
  };
}

// iPhone Duo open on its side: the system's status items sit in the band along the top, and the
// toolbar takes the widest stretch of that band they leave, level with them.
function band(window: Size, insets: Insets, occlusions: Rect[]): Toolbar {
  const status = occlusions.filter((area) => area.y + area.height / 2 < insets.top);
  return {
    ...widestClear(GUTTER, window.width - GUTTER, status),
    y: insets.top / 2 + STATUS_DROP - TOOL / 2,
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
function column(window: Size, insets: Insets, pose: Pose) {
  const width = Math.max(pose.bar === 'right' ? insets.right : insets.left, COLUMN);
  const x = pose.bar === 'right' ? window.width - width : 0;
  const covers = (pose.occlusions ?? []).filter(
    (area) => area.x < x + width && area.x + area.width > x,
  );
  const high = (area: Rect) => area.y + area.height / 2 < window.height / 2;
  const top = covers
    .filter(high)
    .reduce((bottom, area) => Math.max(bottom, area.y + area.height), insets.top);
  const foot = covers
    .filter((area) => !high(area))
    .reduce((bottom, area) => Math.max(bottom, window.height - area.y + 8), insets.bottom);
  // A short column (folded on its side) draws its buttons smaller and closer, so the call's orb and
  // time still fit between the tools and the call buttons.
  const tight = window.height < SHORT;
  return {
    content: { x: x === 0 ? width : 0, y: 0, width: window.width - width, height: window.height },
    toolbar: {
      x: x + (width - TOOL) / 2,
      y: Math.max(top, GAP + 4),
      width: TOOL,
      axis: 'column' as const,
      gaps: tight ? TIGHT_GAPS : COLUMN_GAPS,
    },
    column: {
      x,
      width,
      controls: {
        right: window.width - x - (width + CONTROLS) / 2,
        bottom: foot,
        axis: 'column' as const,
        sizes: tight ? TIGHT_SIZES : SIZES,
      },
    },
    top: insets.top,
  };
}

function single(frame: Frame): Layout {
  const { window, insets, bottomInset, content, toolbar, top } = frame;
  const controls = frame.column?.controls;
  const center = content.x + content.width / 2;
  const width = Math.min(content.width - 2 * GUTTER, WORDS);
  const words = { x: center - width / 2, width };
  const inset = { x: content.x + GUTTER, width: content.width - 2 * GUTTER };
  const agent = { ...inset, bottom: Math.max(insets.bottom - 17, 6) };
  const size = Math.min(content.width * 0.62, window.height * 0.34, 280);
  const shared = {
    kind: 'single' as const,
    content,
    toolbar,
    text: 17,
    agent,
    lift: { calls: 0, tasks: 0 },
    tasks: { width: TASKS, place: 'sheet' as const },
    pulls: true,
  };
  if (!controls) {
    const top12 = { ...words, top: top + 12 };
    return {
      ...shared,
      controls: 'inline',
      orb: {
        size,
        rest: { x: center, y: window.height / 2 },
        room: { top, bottom: window.height },
        read: {
          x: content.x + GUTTER + DOCKED / 2,
          y: window.height - bottomInset - CONTROLS / 2,
          size: DOCKED,
        },
      },
      words: top12,
      besideCalls: top12,
      besideTasks: top12,
      footer: { ...inset, bottom: bottomInset },
      calls: { width: SIDEBAR, place: 'slide' },
    };
  }
  // With the buttons in the side column, the docked orb takes the content's bottom corner and the
  // footer sits above it.
  const dock = window.height - insets.bottom - 8 - DOCKED / 2;
  const below = { ...words, top: insets.top + 72 };
  return {
    ...shared,
    controls,
    orb: {
      size,
      rest: { x: center, y: (insets.top + window.height - insets.bottom) / 2 },
      room: { top, bottom: window.height },
      read: { x: content.x + GUTTER + DOCKED / 2, y: dock, size: DOCKED },
    },
    words: below,
    besideCalls: below,
    besideTasks: below,
    footer: { ...inset, bottom: window.height - dock + DOCKED / 2 + 18 },
    calls: { width: Math.min(content.width - 72, LIST), place: 'slide' },
  };
}

// iPad, either way up. One rule places the call: it's centered in the room the open pane leaves,
// the whole screen when none is. With nothing open the orb is a third of the short side, beside
// the words in landscape with its buttons under it, above them in portrait. With Calls or Tasks
// open the buttons sit at the room's foot and the orb joins them, drawn as tall as they are, just
// before mute with the gap the buttons keep, so the header holds only the toolbar and the words
// keep their height. Tasks takes two thirds of a landscape iPad; standing up, a third is too
// narrow to read, so the call keeps CALL.
function pad(frame: Frame): Layout {
  const { window, bottomInset, content, toolbar } = frame;
  const { width, height } = window;
  const landscape = width > height;
  const size = Math.round(Math.min(width, height) * 0.32);
  const tasks = landscape ? Math.round((width * 2) / 3) : width - CALL;
  const below = toolbar.y + TOOL;
  const foot = height - bottomInset - CONTROLS / 2;
  const agentLow = bottomInset;
  const agentHigh = bottomInset + CONTROLS + 14;
  const docked = (from: number, to: number) => {
    const center = from + (to - from) / 2;
    const mute = center - (MUTE + GAP + CONTROLS) / 2;
    return {
      orb: { x: mute - GAP - BESIDE_MUTE / 2, y: foot, size: BESIDE_MUTE / ART },
      words: { ...measure(from, to), top: below + 16 },
      controls: { x: center, y: foot },
    };
  };
  const withCalls = docked(LIST, width);
  const withTasks = docked(0, width - tasks);
  const rail = {
    width: width - RAIL,
    toolbar: { x: (RAIL - TOOL) / 2, y: toolbar.y, width: TOOL, axis: 'column' as const },
    orb: { x: RAIL / 2, y: foot - CONTROLS / 2 - 20 - RAIL_ORB / 2, size: RAIL_ORB },
    controls: { x: RAIL / 2, y: foot },
  };

  if (landscape) {
    const half = width / 2;
    const group = size + 40 + CONTROLS;
    const top = (height - group) / 2;
    const words = { ...measure(half, width), top: below + 16 };
    return {
      kind: 'split',
      content,
      toolbar,
      controls: {
        center: {
          open: { x: half / 2, y: top + size + 40 + CONTROLS / 2 },
          calls: withCalls.controls,
          tasks: withTasks.controls,
        },
      },
      orb: {
        size,
        rest: { x: half / 2, y: top + size / 2 },
        room: { top: 0, bottom: height },
        read: { x: half / 2, y: top + size / 2 },
        dock: { calls: withCalls.orb, tasks: withTasks.orb },
      },
      words,
      text: 19,
      besideCalls: withCalls.words,
      besideTasks: withTasks.words,
      footer: { ...words, bottom: agentLow + AGENT },
      agent: { ...words, bottom: agentLow },
      lift: { calls: agentHigh - agentLow, tasks: agentHigh - agentLow },
      calls: { width: LIST, place: 'beside' },
      tasks: { width: tasks, place: 'beside' },
      inbox: rail,
      pulls: false,
    };
  }

  const orbY = below + 40 + size / 2;
  const words = { ...measure(0, width), top: orbY + size / 2 + 24 };
  return {
    kind: 'stacked',
    content,
    toolbar,
    controls: {
      center: {
        open: { x: width / 2, y: foot },
        calls: withCalls.controls,
        tasks: withTasks.controls,
      },
    },
    orb: {
      size,
      rest: { x: width / 2, y: orbY },
      room: { top: below, bottom: height },
      read: { x: width / 2, y: orbY },
      dock: { calls: withCalls.orb, tasks: withTasks.orb },
    },
    words,
    text: 19,
    besideCalls: withCalls.words,
    besideTasks: withTasks.words,
    footer: { ...words, bottom: agentHigh + AGENT },
    agent: { ...words, bottom: agentHigh },
    lift: { calls: 0, tasks: 0 },
    calls: { width: LIST, place: 'beside' },
    tasks: { width: tasks, place: 'beside' },
    pulls: false,
  };
}

// The words' measure, centered in the room between `from` and `to`.
function measure(from: number, to: number): Span {
  const width = Math.min(to - from - 2 * GUTTER, MEASURE);
  return { x: from + (to - from - width) / 2, width };
}

// iPhone Duo open: the orb on the page before the fold, the words on the page after it.
function split(frame: Frame, fold?: Rect): Layout {
  const { window, insets, bottomInset, content, toolbar } = frame;
  const controls = frame.column?.controls;
  const pane = fold ? fold.x - content.x : content.width / 2;
  const page = fold ? fold.x + fold.width + clear(fold) : content.x + pane;
  const right = content.x + content.width - GUTTER;
  const words = { x: page, width: Math.min(right - page, WORDS_BESIDE) };
  const agentBottom = controls ? insets.bottom : bottomInset + CONTROLS + 14;
  const top = controls ? insets.top + 72 : toolbar.y + 64;
  // Before a call the orb rests in the middle; partly open that's the hinge, so it waits on its page.
  const read = { x: content.x + pane / 2, y: window.height / 2 };
  return {
    kind: 'split',
    content,
    toolbar,
    controls: controls ?? { right: GUTTER, bottom: bottomInset, axis: 'row' },
    orb: {
      size: Math.min(pane * 0.62, window.height * 0.42, 300),
      rest:
        fold && partly(fold) ? read : { x: content.x + content.width / 2, y: window.height / 2 },
      room: { top: 0, bottom: window.height },
      read,
    },
    words: { ...words, top },
    text: 17,
    besideCalls: { x: page, width: right - page, top },
    besideTasks: { ...words, top },
    footer: { ...words, bottom: agentBottom + AGENT },
    agent: { ...words, bottom: agentBottom },
    lift: { calls: 0, tasks: 0 },
    calls: { width: fold ? pane : LIST, place: 'beside' },
    tasks: { width: TASKS, place: 'sheet' },
    pulls: false,
  };
}

function stacked(frame: Frame, fold: Rect): Layout {
  const base = single(frame);
  const size = Math.min(base.orb.size, (fold.y - frame.top) * 0.78);
  const words = { ...base.words, top: fold.y + fold.height + clear(fold) };
  const read = { x: base.orb.rest.x, y: (frame.top + fold.y) / 2 };
  return {
    ...base,
    kind: 'stacked',
    orb: { ...base.orb, size, rest: fold.height ? read : base.orb.rest, read },
    words,
    besideCalls: words,
    besideTasks: words,
    pulls: false,
  };
}

// iPhone Duo with its side column (see `Duo`). Tasks runs from the screen's edge to the column's
// buttons, short of the orb docked between them; on a call the orb, its time and, open, the words'
// switch sit as one group midway between the tools and the call buttons.
function besideColumn(
  frame: Frame,
  column: NonNullable<Frame['column']>,
  before?: Before,
): Omit<Duo, 'partlyOpen'> {
  const { window, insets, toolbar } = frame;
  const gaps = toolbar.gaps ?? COLUMN_GAPS;
  const sizes = column.controls.sizes ?? SIZES;
  const x = column.x + column.width / 2;
  const reach = Math.max(TOOL, sizes.mute, sizes.call) / 2;
  const leading = column.x === 0;
  const { tasks, after } = paged(
    {
      area: leading
        ? { x: x + reach, y: 0, width: window.width - x - reach, height: window.height }
        : { x: 0, y: 0, width: x - reach, height: window.height },
      inset: FLUSH,
      top: insets.top,
      foot: insets.bottom,
    },
    before?.fold,
  );
  const tools = toolbar.y + 3 * TOOL + gaps.tools + gaps.group;
  const buttons = window.height - column.controls.bottom - sizes.mute - sizes.gap - sizes.call;
  const group = CALL_ORB + 4 + TIME + (after ? 12 + TOOL : 0);
  const y = (tools + buttons - group) / 2;
  const time = y + CALL_ORB + 4;
  return {
    tasks,
    beside: after &&
      before && {
        tasks: after,
        words: before.words,
        button: { x, y: time + TIME + 12 + TOOL / 2 },
      },
    call: {
      orb: { x, y: y + CALL_ORB / 2, size: CALL_ORB },
      time: { x: x - TIME_WIDTH / 2, y: time, width: TIME_WIDTH, align: 'center' },
    },
  };
}

// iPhone Duo open on its side, its toolbar in the band along the top (see `Duo`). Tasks takes the
// screen below the band. The toolbar keeps Calls at the band's leading end and Tasks with settings
// at its trailing end whether Tasks is open or not; with Tasks open the call buttons come in just
// before that pair, and before them sit the words' switch, then the orb with its time after it.
function belowBand(frame: Frame, before?: Before): Omit<Duo, 'partlyOpen'> {
  const { window, insets, toolbar, top } = frame;
  const {
    tasks,
    after,
    before: above,
  } = paged(
    {
      area: { x: 0, y: top, width: window.width, height: window.height - top },
      inset: FLUSH,
      top: 0,
      foot: insets.bottom,
    },
    before?.fold,
  );
  const end = toolbar.x + toolbar.width - PAIR - 2 * GAP;
  const middle = toolbar.y + TOOL / 2;
  const mute = end - 2 * TOOL - GAP;
  const button = { x: mute - 14 - TOOL / 2, y: middle };
  const time = (after ? button.x - TOOL / 2 - 10 : mute - 14) - TIME_WIDTH;
  return {
    tasks,
    beside: after && before && { tasks: after, typing: above, words: before.words, button },
    call: {
      orb: { x: time - 6 - CALL_ORB / 2, y: middle, size: CALL_ORB },
      time: { x: time, y: middle - TIME / 2, width: TIME_WIDTH, align: 'left' },
      controls: { right: window.width - end, top: toolbar.y },
    },
  };
}

// Tasks over a page's area, and the page after the fold, the one it keeps when the call takes the
// one before it. Open upright the fold cuts Tasks into two pages side by side, a list beside its
// topic, as a split view does on a wide screen; partly open it cuts it on its side too, along the
// hinge, and also gives the page before the fold, where it types. Open flat on its side there's
// nothing to cut along: the screen is one tall page, and Tasks takes it whole.
function paged(
  page: Omit<Page, 'fold'>,
  fold?: Rect,
): { tasks: Page; after?: Page; before?: Page } {
  if (!fold) return { tasks: page };
  const { area } = page;
  const row = fold.height > fold.width;
  const end = { x: fold.x + fold.width, y: fold.y + fold.height };
  return {
    tasks:
      row || fold.height > 0 ? { ...page, fold: cut(row ? 'row' : 'column', fold, area) } : page,
    after: row
      ? { ...page, area: { ...area, x: end.x, width: area.x + area.width - end.x } }
      : { ...page, area: { ...area, y: end.y, height: area.y + area.height - end.y }, top: 0 },
    before: row ? undefined : { ...page, area: { ...area, height: fold.y - area.y }, foot: 'fold' },
  };
}

type Before = { fold: Rect; words: Words & { raise: number } };

// Where the call's words go on the page before the fold, beside Tasks: upright, at the words' own
// height; on its side, from under the band down to the fold, so they and the agent line beneath
// them rise until that line ends a gap short of it.
function wordsBefore(frame: Frame, { words, agent }: Layout, fold: Rect): Before {
  if (fold.height > fold.width) {
    const x = frame.content.x + GUTTER;
    const width = Math.min(fold.x - clear(fold) - x, WORDS_BESIDE);
    return { fold, words: { x, width, top: words.top, raise: 0 } };
  }
  const raise = frame.window.height - fold.y + clear(fold) - agent.bottom;
  return { fold, words: { ...words, top: frame.top + 12, raise } };
}

function cut(axis: Fold['axis'], fold: Rect, area: Rect): Fold {
  return axis === 'row'
    ? { axis, at: fold.x - area.x, band: fold.width }
    : { axis, at: fold.y - area.y, band: fold.height };
}
