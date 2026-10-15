import type { Pose, Rect } from '../../modules/pose';

export const GUTTER = 24;
export const TOOL = 48;
export const CONTROLS = 64;
export const DOCKED = 52;
export const DOCK = 88;
export const RAIL = 96;
const AGENT = 22;
const COLUMN = 84;
const WORDS = 600;
const WORDS_BESIDE = 520;
const MEASURE = 680;
const MARGIN = 48;
const LIST = 360;
const SIDEBAR = 330;
const TASKS = 380;
const TASKS_MAX = 460;

type Size = { width: number; height: number };
type Insets = { top: number; right: number; bottom: number; left: number };
type Place = { x: number; y: number };
type Spot = Place & { size?: number };
type Span = { x: number; width: number };
type Words = Span & { top: number };

// The call screen's geometry for a window in a pose. It comes in three arrangements:
// - single: the phone's, the orb alone with the words pulled down over it (also iPhone Duo closed
//   or open tall)
// - split: the orb on the leading page and the words on the trailing one, both there from the
//   start (iPad landscape, iPhone Duo open)
// - stacked: the orb above and the words below it (iPad portrait, iPhone Duo set down on a table)
// Where the system puts its bars down the side (iPhone Duo), the toolbar and call buttons move
// into that side column, and the content is the rest of the screen.
//
// Whether the words show is decided here once: `pulls` says the words are pulled down over the orb
// (single), and everywhere else they have a place of their own and always show.
//
// Calls and Tasks come in from the sides in one of these ways:
// - slide: the call slides aside as a card, showing the pane beneath (the phone's Calls)
// - beside: the call's card gives up that edge to the pane, and the call moves into the room left
//   (iPad)
// - over: the pane comes in over the call (iPhone Duo)
// - sheet: Tasks rises as a sheet (phone and iPhone Duo)
export type Pane = { width: number; place: 'slide' | 'beside' | 'over' | 'sheet' };

// Where something sits with nothing beside the call, with Calls beside it, and with Tasks.
export type Beside<T> = { open: T; calls: T; tasks: T };

export type Layout = {
  kind: 'single' | 'split' | 'stacked';
  content: Rect;
  toolbar: Spot & { width: number; axis: 'row' | 'column' };
  // Inline, the call buttons close the footer as on the phone; in iPhone Duo's side column they sit
  // on their own; on iPad they're centered at `center`, moving with the room a pane leaves.
  controls:
    | 'inline'
    | { right: number; bottom: number; axis: 'row' | 'column' }
    | { center: Beside<Place> };
  // The orb rests at `rest`, kept clear of what's below it within `room`, and moves to `read`
  // when the words show: docked small in the corner, or at full size on its own page. On iPad it
  // docks at the top of the room a pane leaves (`dock`), never covered or faded.
  orb: {
    size: number;
    rest: Spot;
    room: { top: number; bottom: number };
    read: Spot;
    dock?: { calls: Spot; tasks: Spot };
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
  calls: Pane;
  tasks: Pane;
  // Before a call on a wide iPad, Tasks opens as a two-column inbox and the call waits in a rail.
  inbox?: Inbox;
  pulls: boolean;
};

export type Inbox = {
  width: number;
  toolbar: Spot & { width: number; axis: 'column' };
  orb: Spot & { size: number };
  controls: Place;
};

export function screenLayout(window: Size, insets: Insets, pose: Pose): Layout {
  const frame = frameFor(window, insets, pose);
  if (pose.regular && !pose.fold && !pose.bar) return pad(frame);
  if (pose.regular && window.width > window.height) return split(frame, pose);
  if (pose.fold?.active && pose.fold.width > pose.fold.height) return stacked(frame, pose.fold);
  return single(frame);
}

type Frame = ReturnType<typeof frameFor>;

function frameFor(window: Size, insets: Insets, pose: Pose) {
  const bottomInset = Math.max(insets.bottom, 20) + 14;
  if (!pose.bar) {
    const top = insets.top + (pose.regular ? 16 : 12);
    return {
      window,
      insets,
      bottomInset,
      content: { x: 0, y: 0, width: window.width, height: window.height },
      toolbar: {
        x: GUTTER,
        y: top,
        width: window.width - 2 * GUTTER,
        axis: 'row' as const,
      },
      top: top + TOOL,
    };
  }
  const width = Math.max(pose.bar === 'right' ? insets.right : insets.left, COLUMN);
  const x = pose.bar === 'right' ? window.width - width : 0;
  // The camera and the system's bars take the column's top; our tools start below them.
  const taken = (pose.occlusions ?? [])
    .filter((area) => area.x < x + width && area.x + area.width > x)
    .reduce((bottom, area) => Math.max(bottom, area.y + area.height), insets.top);
  return {
    window,
    insets,
    bottomInset,
    content: { x: x === 0 ? width : 0, y: 0, width: window.width - width, height: window.height },
    toolbar: { x: x + (width - TOOL) / 2, y: taken, width: TOOL, axis: 'column' as const },
    controls: {
      right: window.width - x - (width + CONTROLS) / 2,
      bottom: insets.bottom,
      axis: 'column' as const,
    },
    top: insets.top,
  };
}

function single(frame: Frame): Layout {
  const { window, insets, bottomInset, content, toolbar, controls, top } = frame;
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
    calls: { width: Math.min(content.width - 72, LIST), place: 'over' },
  };
}

// iPad, either way up. One rule places the call: it's centered in the room the open pane leaves,
// the whole screen when none is. With nothing open the orb is a third of the short side, beside
// the words in landscape with its buttons under it, above them in portrait. With Calls or Tasks
// open it docks at the top of the room, over the words, with the buttons at the room's foot.
function pad(frame: Frame): Layout {
  const { window, insets, bottomInset, content, toolbar } = frame;
  const { width, height } = window;
  const landscape = width > height;
  const size = Math.round(Math.min(width, height) * 0.32);
  const tasks = Math.round(Math.min(Math.max(width * 0.3, TASKS), TASKS_MAX));
  const below = toolbar.y + TOOL;
  const foot = height - bottomInset - CONTROLS / 2;
  const agentLow = bottomInset;
  const agentHigh = bottomInset + CONTROLS + 14;
  const dockY = Math.max(toolbar.y + TOOL / 2, insets.top + DOCK / 2 + 4);
  const docked = (from: number, to: number) => {
    const room = measure(from, to);
    return {
      orb: { x: from + (to - from) / 2, y: dockY, size: DOCK },
      words: { ...room, top: dockY + DOCK / 2 + 16 },
      controls: { x: from + (to - from) / 2, y: foot },
    };
  };
  const withCalls = docked(LIST, width);
  const withTasks = docked(0, width - tasks);
  const rail = {
    width: width - RAIL,
    toolbar: { x: (RAIL - TOOL) / 2, y: toolbar.y, width: TOOL, axis: 'column' as const },
    orb: { x: RAIL / 2, y: foot - CONTROLS / 2 - 20 - 32, size: 64 },
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
  const width = Math.min(to - from - 2 * MARGIN, MEASURE);
  return { x: from + (to - from - width) / 2, width };
}

// iPhone Duo open: the orb on the page before the fold, the words on the page after it.
function split(frame: Frame, pose: Pose): Layout {
  const { window, insets, bottomInset, content, toolbar, controls } = frame;
  const fold = pose.fold;
  const pane = fold ? fold.x - content.x : content.width / 2;
  const page = fold ? fold.x + fold.width + 8 : content.x + pane;
  const right = content.x + content.width - GUTTER;
  const words = { x: page, width: Math.min(right - page, WORDS_BESIDE) };
  const agentBottom = controls ? insets.bottom : bottomInset + CONTROLS + 14;
  const top = controls ? insets.top + 72 : toolbar.y + 64;
  return {
    kind: 'split',
    content,
    toolbar,
    controls: controls ?? { right: GUTTER, bottom: bottomInset, axis: 'row' },
    orb: {
      size: Math.min(pane * 0.62, window.height * 0.42, 300),
      rest: { x: content.x + content.width / 2, y: window.height / 2 },
      room: { top: 0, bottom: window.height },
      read: { x: content.x + pane / 2, y: window.height / 2 },
    },
    words: { ...words, top },
    text: 17,
    besideCalls: { x: page, width: right - page, top },
    besideTasks: { ...words, top },
    footer: { ...words, bottom: agentBottom + AGENT },
    agent: { ...words, bottom: agentBottom },
    lift: { calls: 0, tasks: 0 },
    calls: { width: fold ? pane : LIST, place: fold ? 'over' : 'beside' },
    tasks: { width: TASKS, place: 'sheet' },
    pulls: false,
  };
}

function stacked(frame: Frame, fold: Rect): Layout {
  const base = single(frame);
  const size = Math.min(base.orb.size, (fold.y - frame.top) * 0.78);
  const words = { ...base.words, top: fold.y + fold.height + 8 };
  return {
    ...base,
    kind: 'stacked',
    orb: { ...base.orb, size, read: { x: base.orb.rest.x, y: (frame.top + fold.y) / 2 } },
    words,
    besideCalls: words,
    besideTasks: words,
    pulls: false,
  };
}
