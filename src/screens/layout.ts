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
  // Where the words move while Calls lists beside them.
  besideList: Span;
  footer: Span & { bottom: number };
  agent: Span & { bottom: number };
  // The list either slides the whole screen aside (phone) or comes in over the content.
  calls: { width: number; over: boolean };
  reading: boolean;
};

export function screenLayout(window: Size, insets: Insets, pose: Pose): Layout {
  const frame = frameFor(window, insets, pose);
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

function single({ window, insets, bottomInset, content, toolbar, controls, top }: Frame): Layout {
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
      besideList: words,
      footer: { ...inset, bottom: bottomInset },
      agent,
      calls: { width: SIDEBAR, over: false },
      reading: false,
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
    besideList: words,
    footer: { ...inset, bottom: window.height - dock + DOCKED / 2 + 18 },
    agent,
    calls: { width: Math.min(content.width - 72, LIST), over: true },
    reading: false,
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
  const from = content.x + list + 40;
  const room = content.x + content.width - 40 - from;
  const besideList = fold
    ? { x: page, width: right - page }
    : {
        x: from + (room - Math.min(room - 60, CALL_BESIDE)) / 2,
        width: Math.min(room - 60, CALL_BESIDE),
      };
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
    besideList,
    footer: { ...words, bottom: agentBottom + AGENT },
    agent: { ...words, bottom: agentBottom },
    calls: { width: list, over: true },
    reading: true,
  };
}

function stacked(frame: Frame, fold: Rect): Layout {
  const base = single(frame);
  const size = Math.min(base.orb.size, (fold.y - frame.top) * 0.78);
  return {
    ...base,
    kind: 'stacked',
    orb: { ...base.orb, size, read: { x: base.orb.rest.x, y: (frame.top + fold.y) / 2 } },
    words: { ...base.words, top: fold.y + fold.height + 8 },
    reading: true,
  };
}
