import { metrics, type ControlsSize } from '@/ui/tokens';

import type { Rect } from '@/screens/window';

const AGENT = 22;
const WORDS = 600;
const WORDS_BESIDE = 520;
const MEASURE = 680;
const LIST = 360;
const SIDEBAR = 330;
const TASKS = 380;
const CALL = 368;
const BESIDE_MUTE = 56;
const GAP = 12;
// Persona's Rive art fills three quarters of its view, as measured in the simulator.
const ART = 0.75;

type Place = { x: number; y: number };
type Spot = Place & { size?: number };
type Span = { x: number; width: number };
export type Words = Span & { top: number };
export type ColumnControls = {
  right: number;
  bottom: number;
  axis: 'row' | 'column';
  size?: ControlsSize;
};

// The room the call stage lays out in, as the screen gives it: its size, the window's safe area
// along its top and foot, how far down it a bar across the top reaches (none where the bar runs
// down the side), the fold across it in its own coordinates (a line open flat, its whole frame
// partly open), where its call buttons sit when they're out in a side column, and whether its width
// is regular.
export type Box = {
  width: number;
  height: number;
  safe: { top: number; bottom: number };
  bar: number;
  fold?: Rect;
  controls?: ColumnControls;
  regular: boolean;
};

export type Pane<Place> = { width: number; place: Place };
// Calls that starts `below` a band of status and bar buttons leaves that band whole.
export type CallsPlacement = Pane<'slide' | 'beside'> & { below?: number };
export type TasksPlacement = Pane<'beside' | 'sheet' | 'page'>;

// Where something sits with nothing beside the call, with Calls beside it, and with Tasks.
export type Beside<T> = { open: T; calls: T; tasks: T };

// The call stage's geometry, in its own box's coordinates. It comes in three arrangements:
// - single: the phone's, the orb alone with the words pulled down over it (also iPhone Duo closed)
// - split: the orb on the leading page and the words on the trailing one, both there from the
//   start (iPad landscape, iPhone Duo open)
// - stacked: the orb above and the words below it (iPad portrait, iPhone Duo open on its side)
//
// Whether the words show is decided here once: `pulls` says the words are pulled down over the orb
// (single), and everywhere else they have a place of their own and always show.
export type Stage = {
  kind: 'single' | 'split' | 'stacked';
  // Inline, the call buttons close the footer as on the phone; in iPhone Duo's side column they sit
  // on their own; on iPad they're centered at `center`, moving with the room a pane leaves, and at
  // `rest` under the orb while it rests alone.
  controls: 'inline' | ColumnControls | { center: Beside<Place> & { rest: Place } };
  // The orb rests at `rest`, kept clear of what's below it within `room`, and moves to `read`
  // when the words show: docked small in the corner, or at full size on its own page. On iPad it
  // docks just before mute in the room a pane leaves (`dock`), never covered or faded.
  orb: {
    size: number;
    rest: Spot;
    room: { top: number; bottom: number };
    read: Spot;
    // Beside Calls the orb rests at `calls`, and where the words then need that room, at `read`.
    dock?: { calls: Required<Spot>; read?: Required<Spot>; tasks: Required<Spot> };
  };
  words: Words;
  text: 'regular' | 'large';
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
  pulls: boolean;
};

export function stageLayout(box: Box): Stage {
  if (box.regular && !box.fold && !box.controls) return pad(box);
  if (box.regular && box.width > box.height) return split(box);
  if (box.fold && box.fold.width > box.fold.height) return stacked(box, box.fold);
  return single(box);
}

// Where the content starts: under the status items, and under a bar across the top.
export function topOf({ safe, bar }: Box) {
  return Math.max(safe.top, bar);
}

// How far the footer keeps above the box's foot, clear of the home indicator.
export function footOf({ safe }: Box) {
  return Math.max(safe.bottom, 20) + 14;
}

function partly(fold: Rect) {
  return Math.min(fold.width, fold.height) > 0;
}

// How far the call's words keep from the fold: flat it's a bare line, so a small gap; partly open
// its frame already holds the margins, so none more.
export function clear(fold: Rect) {
  return partly(fold) ? 0 : 8;
}

function single(box: Box): Stage {
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
    kind: 'single' as const,
    text: 'regular' as const,
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
        rest: { x: center, y: height / 2 },
        room: { top, bottom: height },
        read: {
          x: metrics.gutter + metrics.docked / 2,
          y: height - bottomInset - metrics.call / 2,
          size: metrics.docked,
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
  const dock = height - safe.bottom - 8 - metrics.docked / 2;
  const below = { ...words, top: safe.top + 72 };
  return {
    ...shared,
    controls,
    orb: {
      size,
      rest: { x: center, y: (safe.top + height - safe.bottom) / 2 },
      room: { top, bottom: height },
      read: { x: metrics.gutter + metrics.docked / 2, y: dock, size: metrics.docked },
    },
    words: below,
    besideCalls: below,
    besideTasks: below,
    footer: { ...inset, bottom: height - dock + metrics.docked / 2 + 18 },
    calls: { width: Math.min(across - 72, LIST), place: 'slide' },
  };
}

// iPad, either way up. One rule places the call: it's centered in the room the open pane leaves,
// the whole screen when none is. With nothing open the orb is a third of the short side, beside
// the words in landscape with its buttons under it, above them in portrait. With Calls or Tasks
// open the buttons sit at the room's foot and the orb joins them, drawn as tall as they are, just
// before mute with the gap the buttons keep, so the header holds only the toolbar and the words
// keep their height. Tasks takes two thirds of a landscape iPad; standing up, a third is too
// narrow to read, so the call keeps CALL.
function pad(box: Box): Stage {
  const { width, height } = box;
  const bottomInset = footOf(box);
  const landscape = width > height;
  const size = Math.round(Math.min(width, height) * 0.32);
  const tasks = landscape ? Math.round((width * 2) / 3) : width - CALL;
  const below = box.bar;
  const foot = height - bottomInset - metrics.call / 2;
  const agentLow = bottomInset;
  const agentHigh = bottomInset + metrics.call + 14;
  const docked = (from: number, to: number) => {
    const center = from + (to - from) / 2;
    const { mute: muteSize, call, gap } = metrics.controls.regular;
    const mute = center - (metrics[muteSize] + gap + metrics[call]) / 2;
    return {
      orb: { x: mute - GAP - BESIDE_MUTE / 2, y: foot, size: BESIDE_MUTE / ART },
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
      kind: 'split',
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
      text: 'large' as const,
      besideCalls: withCalls.words,
      besideTasks: withTasks.words,
      footer: { ...words, bottom: agentLow + AGENT },
      agent: { ...words, bottom: agentLow },
      lift: { calls: agentHigh - agentLow, tasks: agentHigh - agentLow },
      calls: { width: LIST, place: 'beside' },
      tasks: { width: tasks, place: 'beside' },
      pulls: false,
    };
  }

  const orbY = below + 40 + size / 2;
  const words = { ...measure(0, width), top: orbY + size / 2 + 24 };
  return {
    kind: 'stacked',
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
    text: 'large' as const,
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
  const width = Math.min(to - from - 2 * metrics.gutter, MEASURE);
  return { x: from + (to - from - width) / 2, width };
}

// iPhone Duo open: the orb on the page before the fold, the words on the page after it.
function split(box: Box): Stage {
  const { width: across, height, safe, fold, controls } = box;
  const bottomInset = footOf(box);
  const pane = fold ? fold.x : across / 2;
  const page = fold ? fold.x + fold.width + clear(fold) : pane;
  const right = across - metrics.gutter;
  const words = { x: page, width: Math.min(right - page, WORDS_BESIDE) };
  const agentBottom = controls ? safe.bottom : bottomInset + metrics.call + 14;
  const top = controls ? safe.top + 72 : box.bar + 16;
  // Before a call the orb rests in the middle; partly open that's the hinge, so it waits on its page.
  const read = { x: pane / 2, y: height / 2 };
  return {
    kind: 'split',
    controls: controls ?? { right: metrics.gutter, bottom: bottomInset, axis: 'row' },
    orb: {
      size: Math.min(pane * 0.62, height * 0.42, 300),
      rest: fold && partly(fold) ? read : { x: across / 2, y: height / 2 },
      room: { top: 0, bottom: height },
      read,
    },
    words: { ...words, top },
    text: 'regular' as const,
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

function stacked(box: Box, fold: Rect): Stage {
  const base = single(box);
  const top = topOf(box);
  const size = Math.min(base.orb.size, (fold.y - top) * 0.78);
  const words = { ...base.words, top: fold.y + fold.height + clear(fold) };
  const read = { x: base.orb.rest.x, y: (top + fold.y) / 2 };
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

// Where the call's words go on the page before the fold, beside Tasks: upright, at the words' own
// height; on its side, from under the band down to the fold, so they and the agent line beneath
// them rise until that line ends a gap short of it.
export function wordsBefore(
  box: Box,
  { words, agent }: Stage,
  fold: Rect,
): Words & { raise: number } {
  if (fold.height > fold.width) {
    const x = metrics.gutter;
    const width = Math.min(fold.x - clear(fold) - x, WORDS_BESIDE);
    return { x, width, top: words.top, raise: 0 };
  }
  const raise = box.height - fold.y + clear(fold) - agent.bottom;
  return { ...words, top: topOf(box) + 12, raise };
}
