import type { TextInputRef } from '@expo/ui';
import { createContext, useContext, useEffect, useReducer, useRef } from 'react';

import type { TasksAt } from '@/components/tasks/tasks-view';
import type { PageId } from '@/live/inbox';
import type { TaskId } from '@/live/tasks';
import { breakpoint } from '@/ui/tokens';

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

export type Shape = 'one' | 'columns' | 'panes';

export const START: Stack = {
  path: [],
  task: null,
  row: null,
  stepsOf: null,
  focusComposer: false,
};

// An 11-inch iPad keeps one wide list beside a call.
export function shapeOf(width: number, panes: number | undefined): Shape {
  return panes !== undefined ? 'panes' : width >= breakpoint.columns ? 'columns' : 'one';
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

// Where Tasks lays out: as wide as it's given, keeping `foot` clear at its foot, or ending at the
// fold. On iPhone Duo its pages are clear over the screen's backdrop (`paged`), and held wide it
// takes the fold's two sides as two pages side by side, meeting `panes` from its start.
export type Room = { width: number; foot: number | 'fold'; paged: boolean; panes?: number };

// A sheet's bar centers its title; a page's on iPhone Duo is one row: back, title, buttons.

// A page in a pane is as wide as the pane (`frame`); every page is as tall as the room
// lets it be, which the keyboard can shorten.
export type Spot = {
  frame?: { width: number };
  offset: { x: number; y: number };
  shown: boolean;
  width: number;
  foot: number;
  back?: Level | 'call';
};

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
  if (room.paged && room.panes !== undefined) return spotInPanes(level, pages, room, room.panes);
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
  return {
    offset: { x, y: 0 },
    shown: x === 0,
    width: page,
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
  return {
    offset: { x, y: 0 },
    shown: x === 0,
    width: level === 'list' ? list : page,
    ...footOf(room.foot),
    back: level === 'list' || level === 'topic' ? undefined : levels[i - 1],
  };
}

// Held wide, the deepest level takes the second pane and the one before it the first; deeper ones
// wait off the leading edge, shallower ones off the trailing edge.
function spotInPanes(level: Level, { levels, closes }: Placing, room: Room, panes: number): Spot {
  const i = levels.indexOf(level);
  const front = i === levels.length - 1;
  const second = { at: panes, width: room.width - panes };
  const { at, width, shown } = front
    ? { ...second, shown: true }
    : i === levels.length - 2
      ? { at: 0, width: panes, shown: true }
      : i >= 0
        ? { at: -panes, width: panes, shown: false }
        : { ...second, at: room.width, shown: false };
  return {
    frame: { width },
    offset: { x: at, y: 0 },
    shown,
    width,
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
