import { useEffect, useReducer } from 'react';

import type { TasksAt } from '@/components/tasks/tasks-view';
import type { Fold } from '@/screens/layout';

// Tasks' levels, the list at the foot: a topic's page, a thread's messages and its steps (from the
// topic's page), and what the last check did.
export type Level = 'list' | 'task' | 'thread' | 'trace' | 'check';
type Pushed = Exclude<Level, 'list'>;

// What's open: the levels pushed over the list, deepest last; the topic the pages show, the row it
// was opened from, whose steps show; and each time a thread was opened to write to.
export type Stack = {
  path: Pushed[];
  task: string | null;
  row: string | null;
  trace: string | null;
  writes: number;
};

export type Move =
  | { to: 'start'; at: TasksAt }
  | { to: 'task'; id: string; row?: string }
  | { to: 'beside'; id: string | null }
  | { to: 'thread'; write?: boolean }
  | { to: 'trace'; id: string }
  | { to: 'check' }
  | { to: 'back' };

// How the room holds the levels: one page at a time; the list with a topic's page beside it (a big
// iPad); or iPhone Duo's two pages either side of the fold.
export type Shape = 'one' | 'columns' | 'fold';

export const START: Stack = { path: [], task: null, row: null, trace: null, writes: 0 };

// Wide enough for the list and a topic's page side by side: Tasks on a 13-inch iPad beside a call,
// or anywhere before one. An 11-inch keeps one wide list beside a call.
const COLUMNS = 900;

export function shapeOf(width: number, fold: Fold | undefined): Shape {
  return fold ? 'fold' : width >= COLUMNS ? 'columns' : 'one';
}

export function move(stack: Stack, step: Move): Stack {
  switch (step.to) {
    case 'start':
      return { ...START, task: step.at.task ?? null, path: step.at.task ? ['task'] : [] };
    case 'task':
      return { ...stack, task: step.id, row: step.row ?? null, path: ['task'] };
    case 'beside':
      return { ...stack, task: step.id };
    case 'thread':
      return {
        ...stack,
        path: ['task', 'thread'],
        writes: stack.writes + (step.write ? 1 : 0),
      };
    case 'trace':
      return {
        ...stack,
        trace: step.id,
        path: [...stack.path.filter((at) => at !== 'trace'), 'trace'],
      };
    case 'check':
      return { ...stack, path: ['check'] };
    case 'back':
      return { ...stack, path: stack.path.slice(0, -1) };
  }
}

// The levels on screen, the list first. With a page beside the list, a topic's page is always up.
export function levelsOf(stack: Stack, shape: Shape): Level[] {
  const levels: Level[] = ['list', ...stack.path];
  if (shape !== 'one' && levels.length === 1) levels.push('task');
  return levels;
}

// Whether going back from here leaves Tasks: the page at its leading edge is the list. On the Duo's
// two pages that's the page before the front; beside a big iPad's list, the topic beside it.
export function leaves(stack: Stack, shape: Shape): boolean {
  const levels = levelsOf(stack, shape);
  if (shape === 'one') return levels.length === 1;
  if (shape === 'columns') return levels.length === 2 && levels[1] === 'task';
  return levels.at(-2) === 'list';
}

// The page stack a Tasks owner holds: it starts fresh with each opening, and Back leaves Tasks
// (`onClose`) from its top.
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
  const back = () => (leaves(stack, shape) ? onClose?.() : go({ to: 'back' }));
  return { ...stack, shape, levels: levelsOf(stack, shape), closes: !!onClose, go, back };
}

export type Pages = ReturnType<typeof usePages>;

// The room Tasks lays out in, `width` by `height` (0 where it fills a sheet), with `top` taken at
// its top for the status bar or the toolbar's line, `foot` at its foot for the home indicator, and
// its content kept `inset` from its sides. `paged` on iPhone Duo, where Tasks is a place of its own:
// its pages draw no fill, so the screen's backdrop runs through them and the fold.
export type Room = {
  width: number;
  height: number;
  fold?: Fold;
  top: number;
  foot: number;
  inset: { left: number; right: number };
  paged: boolean;
};

// How a page's bar is drawn: centered under a sheet's grabber or in iPad's pane, and on iPhone Duo's
// pages as iOS draws a page's: Back named for where it goes over the page's name set large
// (`large`), or all on one line where the page is short (`inline`).
export type Bar = 'center' | 'large' | 'inline';

// Where a level's page sits: its frame on the Duo's pages (it fills the room elsewhere), moved by
// `offset`; on screen or not; its content's width and padding; and where its Back goes, if it has
// one ('call' leaves Tasks).
export type Spot = {
  frame?: { width: number; height: number };
  offset: { x: number; y: number };
  shown: boolean;
  tall: number;
  width: number;
  pad: { top: number; leading: number; trailing: number };
  foot: number;
  bar: Bar;
  back?: Level | 'call';
};

// A page shorter than this draws its bar on one line.
const SHORT_PAGE = 520;

function listWidth(room: Room, shape: Shape) {
  if (shape === 'columns') return Math.round(Math.min(440, Math.max(360, room.width * 0.42)));
  return room.fold?.axis === 'row' ? room.fold.at : room.width;
}

// One page at a time, a page steps down over the one before, which waits a third of a page behind
// (a whole page on the Duo, whose pages are clear, so none shows through another). Beside a big
// iPad's list the pages step down the same way to its side. On the Duo's two pages the front page
// sits on the second and the one below it on the first, the rest a page behind the first or past
// the second; a thread you write to on pages stacked one over the other takes both.
export function spotOf(
  level: Level,
  pages: Pick<Pages, 'levels' | 'shape' | 'closes'>,
  room: Room,
  typing = false,
): Spot {
  const { levels, shape, closes } = pages;
  const i = levels.indexOf(level);
  const front = i === levels.length - 1;
  const below = i > 0 ? levels[i - 1] : undefined;
  const bar = (tall: number): Bar =>
    !room.paged ? 'center' : tall - room.top < SHORT_PAGE ? 'inline' : 'large';
  const { fold, inset } = room;

  if (!fold) {
    const columns = shape === 'columns';
    const list = listWidth(room, shape);
    const page = columns ? room.width - list - 1 : room.width;
    const behind = i >= 0 || (columns && level === 'task');
    const x =
      (columns && level === 'list') || front ? 0 : behind ? -(room.paged ? page : page / 3) : page;
    const pad = columns
      ? { leading: 0, trailing: 0 }
      : { leading: inset.left, trailing: inset.right };
    const back =
      level === 'list'
        ? front && closes && !columns
          ? 'call'
          : undefined
        : columns && level === 'task'
          ? undefined
          : below;
    return {
      offset: { x, y: 0 },
      shown: x === 0,
      tall: room.height,
      width: (level === 'list' ? list : page) - pad.leading - pad.trailing,
      pad: { top: room.top, ...pad },
      foot: room.foot,
      bar: bar(room.height),
      back,
    };
  }

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
  const pad = !row
    ? { leading: inset.left, trailing: inset.right }
    : at <= 0
      ? { leading: inset.left, trailing: 0 }
      : { leading: 0, trailing: inset.right };
  const tall = row ? room.height : length;
  return {
    frame: row ? { width: length, height: room.height } : { width: room.width, height: length },
    offset: row ? { x: at, y: 0 } : { x: 0, y: at },
    shown,
    tall,
    width: (row ? length : room.width) - pad.leading - pad.trailing,
    pad: { top: !row && at > 0 ? 0 : room.top, ...pad },
    foot: !row && at <= 0 && !(alone && front) ? 0 : room.foot,
    bar: bar(tall),
    back: !leading ? undefined : level === 'list' ? (closes ? 'call' : undefined) : below,
  };
}
