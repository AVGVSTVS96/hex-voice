import type { Pose, Rect } from '../../modules/pose';

export const GUTTER = 24;
export const TOOL = 48;
export const CONTROLS = 64;
export const DOCKED = 52;
const AGENT = 22;
const COLUMN = 84;
const WORDS = 600;
const WORDS_BESIDE = 520;
const CALL_BESIDE = 680;
const LIST = 360;
const SIDEBAR = 330;
const TASKS = 380;

type Size = { width: number; height: number };
type Insets = { top: number; right: number; bottom: number; left: number };
type Spot = { x: number; y: number; size?: number };
type Span = { x: number; width: number };

// The call screen's geometry for a window in a pose. It comes in three arrangements:
// - single: the phone's, the orb alone with the words pulled down over it (also iPad portrait and
//   iPhone Duo closed or open tall)
// - split: the orb on the leading page and the words on the trailing one, both there from the
//   start (iPad landscape, iPhone Duo open)
// - stacked: the orb above the fold and the words below it (iPhone Duo set down on a table)
// Where the system puts its bars down the side (iPhone Duo), the toolbar and call buttons move
// into that side column, and the content is the rest of the screen.
//
// Whether the words show is decided here once: `pulls` says the words are pulled down over the orb
// (single), and everywhere else they have a place of their own and always show.
//
// Calls and Tasks come in from the sides in one of these ways:
// - slide: the call slides aside as a card, showing the pane beneath (the phone's Calls, iPad
//   portrait)
// - beside: the call's card gives up that edge to the pane and its words move into what's left
//   (iPad landscape)
// - over: the pane comes in over the call (iPhone Duo)
// - sheet: Tasks rises as a sheet (phone and iPhone Duo)
export type Pane = { width: number; place: 'slide' | 'beside' | 'over' | 'sheet' };

export type Layout = {
  kind: 'single' | 'split' | 'stacked';
  content: Rect;
  toolbar: Spot & { width: number; axis: 'row' | 'column' };
  // Inline, the call buttons close the footer as on the phone; otherwise they sit on their own.
  controls: 'inline' | { right: number; bottom: number; axis: 'row' | 'column' };
  // The orb rests at `rest`, kept clear of what's below it within `room`, and moves to `read`
  // when the words show: docked small in the corner, or at full size on its own page.
  orb: { size: number; rest: Spot; room: { top: number; bottom: number }; read: Spot };
  words: Span & { top: number };
  // Where the words move while Calls or Tasks sit beside them.
  besideCalls: Span;
  besideTasks: Span;
  footer: Span & { bottom: number };
  agent: Span & { bottom: number };
  calls: Pane;
  tasks: Pane;
  pulls: boolean;
};

export function screenLayout(window: Size, insets: Insets, pose: Pose): Layout {
  const frame = frameFor(window, insets, pose);
  if (pose.regular && window.width > window.height) return split(frame, pose);
  if (pose.fold?.active && pose.fold.width > pose.fold.height)
    return stacked(frame, pose, pose.fold);
  return single(frame, pose);
}

// iPad keeps Tasks open as a pane of its own; iPhone and iPhone Duo raise it as a sheet.
function tasksPane(pose: Pose, place: 'slide' | 'beside'): Pane {
  return pose.regular && !pose.fold && !pose.bar
    ? { width: TASKS, place }
    : { width: TASKS, place: 'sheet' };
}

// The words' span centered in what the card keeps between `from` and `to`.
function centered(from: number, to: number): Span {
  const room = to - from - 80;
  const width = Math.min(room - 60, CALL_BESIDE);
  return { x: from + 40 + (room - width) / 2, width };
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

function single(frame: Frame, pose: Pose): Layout {
  const { window, insets, bottomInset, content, toolbar, controls, top } = frame;
  const center = content.x + content.width / 2;
  const width = Math.min(content.width - 2 * GUTTER, WORDS);
  const words = { x: center - width / 2, width };
  const inset = { x: content.x + GUTTER, width: content.width - 2 * GUTTER };
  const agent = { ...inset, bottom: Math.max(insets.bottom - 17, 6) };
  const size = Math.min(content.width * 0.62, window.height * 0.34, 280);
  if (!controls) {
    return {
      kind: 'single',
      content,
      toolbar,
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
      words: { ...words, top: top + 12 },
      besideCalls: words,
      besideTasks: words,
      footer: { ...inset, bottom: bottomInset },
      agent,
      calls: { width: SIDEBAR, place: 'slide' },
      tasks: tasksPane(pose, 'slide'),
      pulls: true,
    };
  }
  // With the buttons in the side column, the docked orb takes the content's bottom corner and the
  // footer sits above it.
  const dock = window.height - insets.bottom - 8 - DOCKED / 2;
  return {
    kind: 'single',
    content,
    toolbar,
    controls,
    orb: {
      size,
      rest: { x: center, y: (insets.top + window.height - insets.bottom) / 2 },
      room: { top, bottom: window.height },
      read: { x: content.x + GUTTER + DOCKED / 2, y: dock, size: DOCKED },
    },
    words: { ...words, top: insets.top + 72 },
    besideCalls: words,
    besideTasks: words,
    footer: { ...inset, bottom: window.height - dock + DOCKED / 2 + 18 },
    agent,
    calls: { width: Math.min(content.width - 72, LIST), place: 'over' },
    tasks: tasksPane(pose, 'slide'),
    pulls: true,
  };
}

function split(frame: Frame, pose: Pose): Layout {
  const { window, insets, bottomInset, content, toolbar, controls } = frame;
  const fold = pose.fold;
  const pane = fold ? fold.x - content.x : content.width / 2;
  const page = fold ? fold.x + fold.width + 8 : content.x + pane;
  const right = content.x + content.width - GUTTER;
  const words = { x: page, width: Math.min(right - page, WORDS_BESIDE) };
  const agentBottom = controls ? insets.bottom : bottomInset + CONTROLS + 14;
  const list = fold ? pane : LIST;
  const tasks = tasksPane(pose, 'beside');
  const end = content.x + content.width;
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
    words: { ...words, top: controls ? insets.top + 72 : toolbar.y + 64 },
    besideCalls: fold ? { x: page, width: right - page } : centered(content.x + list, end),
    besideTasks: centered(content.x, end - tasks.width),
    footer: { ...words, bottom: agentBottom + AGENT },
    agent: { ...words, bottom: agentBottom },
    calls: { width: list, place: fold ? 'over' : 'beside' },
    tasks,
    pulls: false,
  };
}

function stacked(frame: Frame, pose: Pose, fold: Rect): Layout {
  const base = single(frame, pose);
  const size = Math.min(base.orb.size, (fold.y - frame.top) * 0.78);
  return {
    ...base,
    kind: 'stacked',
    orb: { ...base.orb, size, read: { x: base.orb.rest.x, y: (frame.top + fold.y) / 2 } },
    words: { ...base.words, top: fold.y + fold.height + 8 },
    pulls: false,
  };
}
