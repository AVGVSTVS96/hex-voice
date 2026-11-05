import type { TextInputRef } from '@expo/ui';
import { createContext, useContext, useEffect, useReducer, useRef } from 'react';

import type { TasksAt } from '@/components/tasks/tasks-view';
import type { PageId } from '@/live/inbox';
import type { TaskId } from '@/live/tasks';
import type { Fold } from '@/screens/layout';

export type Level = 'list' | 'topic' | 'thread' | 'steps' | 'check';
type Pushed = Exclude<Level, 'list'>;

export type Stack = {
  path: Pushed[];
  task: PageId | null;
  row: string | null;
  stepsOf: TaskId | null;
  focusComposer: boolean;
};

export type Move =
  | { to: 'start'; at: TasksAt }
  | { to: 'topic'; id: PageId; row?: string }
  | { to: 'beside'; id: PageId | null }
  | { to: 'thread'; write?: boolean }
  | { to: 'composerFocused' }
  | { to: 'steps'; id: TaskId }
  | { to: 'check' }
  | { to: 'back' };

export type Shape = 'one' | 'columns' | 'split';

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

// A paged room is as many pages as its layout cut it into; any other is two columns when it's wide
// enough.
export function shapeOf(width: number, split: Fold | undefined): Shape {
  return split ? 'split' : width >= COLUMNS ? 'columns' : 'one';
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
      split?: Fold;
      gap?: Fold;
      top: number;
      foot: number | 'fold';
      inset: Inset;
    };

// A sheet's bar centers its title; a page's on iPhone Duo is one row: back, title, buttons.

// `frame` is a page's width and the most it may be tall: the keyboard can shorten it.
export type Spot = {
  frame?: { width: number; maxHeight: number };
  offset: { x: number; y: number };
  shown: boolean;
  width: number;
  pad: { top: number; leading: number; trailing: number };
  foot: number;
  back?: Level | 'call';
};

const FLUSH: Inset = { left: 0, right: 0 };

// A page that ends at the fold keeps nothing clear below it.
function footOf(foot: number | 'fold') {
  return { foot: foot === 'fold' ? 0 : foot };
}

// A field on a page says when it's being typed in, so that page can make room above the keyboard.
export const Typing = createContext<(on: boolean) => void>(() => {});

// Whether a field's page shows. Pages stay mounted as they leave, so a field ends its own editing
// when its page stops showing, rather than keep the keyboard up for a page that's gone.
export const Showing = createContext(true);

export function useField() {
  const field = useRef<TextInputRef>(null);
  const showing = useContext(Showing);
  useEffect(() => {
    if (!showing) field.current?.blur();
  }, [showing]);
  return field;
}

export function spotOf(level: Level, pages: Placing, room: Room): Spot {
  if (room.paged && room.split) return spotSplit(level, pages, room, room.split);
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
    back: level === 'list' || level === 'topic' ? undefined : levels[i - 1],
  };
}

// Two pages side by side: the deepest level takes the second page and the one before it the first;
// deeper ones wait off the leading edge, shallower ones off the trailing edge.
function spotSplit(
  level: Level,
  { levels, closes }: Placing,
  room: Extract<Room, { paged: true }>,
  split: Fold,
): Spot {
  const i = levels.indexOf(level);
  const front = i === levels.length - 1;
  const second = { at: split.at + split.band, width: room.width - split.at - split.band };
  const { at, width, shown } = front
    ? { ...second, shown: true }
    : i === levels.length - 2
      ? { at: 0, width: split.at, shown: true }
      : i >= 0
        ? { at: -second.at, width: split.at, shown: false }
        : { ...second, at: room.width, shown: false };
  const { inset } = room;
  const pad =
    at <= 0 ? { leading: inset.left, trailing: 0 } : { leading: 0, trailing: inset.right };
  return {
    frame: { width, maxHeight: room.height },
    offset: { x: at, y: 0 },
    shown,
    width: width - pad.leading - pad.trailing,
    pad: { top: room.top, ...pad },
    ...footOf(room.foot),
    back: !(shown && at <= 0)
      ? undefined
      : level === 'list'
        ? closes
          ? 'call'
          : undefined
        : levels[i - 1],
  };
}
