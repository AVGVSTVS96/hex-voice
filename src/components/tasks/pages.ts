import { useEffect, useReducer } from 'react';

import type { TasksAt } from '@/components/tasks/tasks-view';
import type { Fold } from '@/screens/layout';

export type Level = 'list' | 'topic' | 'thread' | 'steps' | 'check';
type Pushed = Exclude<Level, 'list'>;

export type Stack = {
  path: Pushed[];
  task: string | null;
  row: string | null;
  stepsOf: string | null;
  focusComposer: boolean;
};

export type Move =
  | { to: 'start'; at: TasksAt }
  | { to: 'topic'; id: string; row?: string }
  | { to: 'beside'; id: string | null }
  | { to: 'thread'; write?: boolean }
  | { to: 'composerFocused' }
  | { to: 'steps'; id: string }
  | { to: 'check' }
  | { to: 'back' };

export type Shape = 'one' | 'columns' | 'fold';

export const START: Stack = {
  path: [],
  task: null,
  row: null,
  stepsOf: null,
  focusComposer: false,
};

// Wide enough for the list and a topic's page side by side: Tasks on a 13-inch iPad beside a call,
// or anywhere before one. An 11-inch keeps one wide list beside a call.
const COLUMNS = 900;

export function shapeOf(width: number, fold: Fold | undefined): Shape {
  return fold ? 'fold' : width >= COLUMNS ? 'columns' : 'one';
}

export function move(stack: Stack, step: Move): Stack {
  switch (step.to) {
    case 'start':
      return { ...START, task: step.at.task ?? null, path: step.at.task ? ['topic'] : [] };
    case 'topic':
      return { ...stack, task: step.id, row: step.row ?? null, path: ['topic'] };
    case 'beside':
      return { ...stack, task: step.id };
    case 'thread':
      return { ...stack, path: ['topic', 'thread'], focusComposer: !!step.write };
    case 'composerFocused':
      return stack.focusComposer ? { ...stack, focusComposer: false } : stack;
    case 'steps':
      return {
        ...stack,
        stepsOf: step.id,
        path: [...stack.path.filter((at) => at !== 'steps'), 'steps'],
      };
    case 'check':
      return { ...stack, path: ['check'] };
    case 'back':
      return { ...stack, path: stack.path.slice(0, -1), focusComposer: false };
  }
}

export function levelsOf(stack: Stack, shape: Shape): Level[] {
  const levels: Level[] = ['list', ...stack.path];
  if (shape !== 'one' && levels.length === 1) levels.push('topic');
  return levels;
}

export function backLeavesTasks(stack: Stack, shape: Shape): boolean {
  const levels = levelsOf(stack, shape);
  if (shape === 'one') return levels.length === 1;
  if (shape === 'columns') return levels.length === 2 && levels[1] === 'topic';
  return levels.at(-2) === 'list';
}

export function usePages({
  open,
  at,
  shape,
  onClose,
}: {
  open: boolean;
  at: TasksAt;
  shape: Shape;
  onClose?: () => void;
}) {
  const [stack, go] = useReducer(move, START);
  useEffect(() => {
    if (open) go({ to: 'start', at });
  }, [open, at]);
  const back = () => (backLeavesTasks(stack, shape) ? onClose?.() : go({ to: 'back' }));
  return { ...stack, shape, levels: levelsOf(stack, shape), closes: !!onClose, go, back };
}

export type Pages = ReturnType<typeof usePages>;
type Placing = Pick<Pages, 'levels' | 'shape' | 'closes'>;

type Inset = { left: number; right: number };

// Paged rooms are iPhone Duo's, whose pages are clear over the screen's backdrop.
export type Room =
  | { paged: false; width: number; foot: number }
  | {
      paged: true;
      width: number;
      height: number;
      fold?: Fold;
      top: number;
      foot: number | 'fold';
      inset: Inset;
    };

export type Bar = 'center' | 'large' | 'inline';

export type Spot = {
  frame?: { width: number; height: number };
  offset: { x: number; y: number };
  shown: boolean;
  width: number;
  pad: { top: number; leading: number; trailing: number };
  foot: number;
  endsAtFold: boolean;
  bar: Bar;
  back?: Level | 'call';
};

const FLUSH: Inset = { left: 0, right: 0 };
// Open flat on its side, the page below the fold's hairline keeps its bar this far off it.
const SEAM = 10;

// iOS draws a bar on one line where the screen is wider than tall (a landscape iPhone), so a page
// does the same.
function barOf(room: Room, width: number, height: number): Bar {
  return !room.paged ? 'center' : width > height ? 'inline' : 'large';
}

function footOf(foot: number | 'fold') {
  return foot === 'fold' ? { foot: 0, endsAtFold: true } : { foot, endsAtFold: false };
}

export function spotOf(level: Level, pages: Placing, room: Room, typing = false): Spot {
  if (room.paged && room.fold) return spotAtFold(level, pages, room, room.fold, typing);
  return pages.shape === 'columns'
    ? spotInColumns(level, pages, room)
    : spotAlone(level, pages, room);
}

// A page steps down over the one before, which waits a third of a page behind; on the Duo a whole
// page, since its clear pages would show through each other.
function spotAlone(level: Level, { levels, closes }: Placing, room: Room): Spot {
  const i = levels.indexOf(level);
  const front = i === levels.length - 1;
  const page = room.width;
  const x = front ? 0 : i >= 0 ? -(room.paged ? page : page / 3) : page;
  const top = room.paged ? room.top : 0;
  const inset = room.paged ? room.inset : FLUSH;
  return {
    offset: { x, y: 0 },
    shown: x === 0,
    width: page - inset.left - inset.right,
    pad: { top, leading: inset.left, trailing: inset.right },
    ...footOf(room.foot),
    bar: barOf(room, page, room.paged ? room.height - top : 0),
    back: level === 'list' ? (front && closes ? 'call' : undefined) : levels[i - 1],
  };
}

function spotInColumns(level: Level, { levels }: Placing, room: Room): Spot {
  const list = Math.round(Math.min(440, Math.max(360, room.width * 0.42)));
  const page = room.width - list - 1;
  const i = levels.indexOf(level);
  const front = i === levels.length - 1;
  const behind = i >= 0 || level === 'topic';
  const x = level === 'list' || front ? 0 : behind ? -page / 3 : page;
  const top = room.paged ? room.top : 0;
  return {
    offset: { x, y: 0 },
    shown: x === 0,
    width: level === 'list' ? list : page,
    pad: { top, leading: 0, trailing: 0 },
    ...footOf(room.foot),
    bar: barOf(room, page, room.paged ? room.height - top : 0),
    back: level === 'list' || level === 'topic' ? undefined : levels[i - 1],
  };
}

// A thread you write to on pages stacked one over the other takes both, so the keyboard leaves
// room to read it.
function spotAtFold(
  level: Level,
  { levels, closes }: Placing,
  room: Extract<Room, { paged: true }>,
  fold: Fold,
  typing: boolean,
): Spot {
  const i = levels.indexOf(level);
  const front = i === levels.length - 1;
  const row = fold.axis === 'row';
  const size = row ? room.width : room.height;
  const second = { at: fold.at + fold.band, length: size - fold.at - fold.band };
  const alone = !row && typing && levels.at(-1) === 'thread';
  const { at, length, shown } =
    alone && front
      ? { at: 0, length: size, shown: true }
      : front
        ? { ...second, shown: true }
        : i === levels.length - 2 && !alone
          ? { at: 0, length: fold.at, shown: true }
          : i >= 0
            ? { at: -second.at, length: fold.at, shown: false }
            : { ...second, at: size, shown: false };
  const leading = shown && at <= 0;
  const { inset } = room;
  const pad = !row
    ? { leading: inset.left, trailing: inset.right }
    : at <= 0
      ? { leading: inset.left, trailing: 0 }
      : { leading: 0, trailing: inset.right };
  const top = !row && at > 0 ? (fold.band ? 0 : SEAM) : room.top;
  const frame = row
    ? { width: length, height: room.height }
    : { width: room.width, height: length };
  return {
    frame,
    offset: row ? { x: at, y: 0 } : { x: 0, y: at },
    shown,
    width: frame.width - pad.leading - pad.trailing,
    pad: { top, ...pad },
    ...footOf(!row && at <= 0 && !(alone && front) ? 'fold' : room.foot),
    bar: barOf(room, frame.width, frame.height - top),
    back: !leading ? undefined : level === 'list' ? (closes ? 'call' : undefined) : levels[i - 1],
  };
}
