import type { TextInputRef } from '@expo/ui';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

import { TASKS } from '@/call/stage';
import type { AskId } from '@/live/asks';
import type { PageId, Tab } from '@/live/inbox';
import type { TaskId } from '@/live/tasks';
import type { Page } from '@/screens/layout';

export type Level = 'list' | 'topic' | 'thread' | 'steps' | 'check' | 'picks' | 'pick';

type Pushed = Exclude<Level, 'list'>;

// Every opening passes a new one, which starts Tasks afresh there.
export interface TasksAt {
  task?: TaskId;
  stage?: Tab;
}

// Where you are in Tasks: its pages, the list's tab and what it's searched for. The call screen
// holds it (`Screen`), so it outlasts the pane, the sheet or the Duo's pages that show it, which
// the window's size swaps.
export interface Stack {
  path: Pushed[];
  task: PageId | null;
  row: string | null;
  stepsOf: TaskId | null;
  // The question of hex's picks open on its own page.
  pick: AskId | null;
  focusComposer: boolean;
  // The tab Tasks was sent to, or once the list has loaded, the one it opened on or was moved to.
  stage: Tab | null;
  query: string | null;
}

export type Move =
  | { to: 'topic'; id: PageId; row?: string }
  | { to: 'beside'; id: PageId | null }
  | { to: 'thread'; write?: boolean }
  | { to: 'composerFocused' }
  | { to: 'steps'; id: TaskId }
  | { to: 'check' }
  | { to: 'picks' }
  | { to: 'pick'; id: AskId }
  | { to: 'back' }
  | { to: 'stage'; stage: Tab }
  | { to: 'search'; query: string | null };

export type Shape = 'one' | 'columns' | 'panes';

export const START: Stack = {
  path: [],
  task: null,
  row: null,
  stepsOf: null,
  pick: null,
  focusComposer: false,
  stage: null,
  query: null,
};

// Every opening starts Tasks afresh where it's sent.
export const startAt = (at: TasksAt): Stack => ({
  ...START,
  task: at.task ?? null,
  path: at.task ? ['topic'] : [],
  stage: at.stage ?? null,
});

// Wide enough for the list and a topic's page side by side: Tasks on a 13-inch iPad beside a call,
// or anywhere before one. An 11-inch keeps one wide list beside a call.
const COLUMNS = 900;

// On iPhone Duo, two pages side by side where each side of the window's middle has a page as wide
// as the phone's Tasks: open and held wide, not on its side, folded or beside the call's words.
export const shapeOf = ({ width, paged, meet = 0 }: Room): Shape => {
  if (paged) {
    return Math.min(width / 2 + meet, width / 2 - meet) >= TASKS ? 'panes' : 'one';
  }

  return width >= COLUMNS ? 'columns' : 'one';
};

export const move = (stack: Stack, step: Move): Stack => {
  switch (step.to) {
    case 'topic': {
      return { ...stack, task: step.id, row: step.row ?? null, path: ['topic'] };
    }

    case 'beside': {
      return { ...stack, task: step.id };
    }

    case 'thread': {
      return { ...stack, path: ['topic', 'thread'], focusComposer: !!step.write };
    }

    case 'composerFocused': {
      return stack.focusComposer ? { ...stack, focusComposer: false } : stack;
    }

    case 'steps': {
      return {
        ...stack,
        stepsOf: step.id,
        path: [...stack.path.filter((at) => at !== 'steps'), 'steps'],
      };
    }

    case 'check':
    case 'picks': {
      return { ...stack, path: [step.to] };
    }

    case 'pick': {
      return { ...stack, pick: step.id, path: ['picks', 'pick'] };
    }

    case 'back': {
      return { ...stack, path: stack.path.slice(0, -1), focusComposer: false };
    }

    case 'stage': {
      return { ...stack, stage: step.stage };
    }

    case 'search': {
      return { ...stack, query: step.query };
    }
  }
};

export const levelsOf = (stack: Stack, shape: Shape): Level[] => {
  const levels: Level[] = ['list', ...stack.path];

  if (shape !== 'one' && levels.length === 1) {
    levels.push('topic');
  }

  return levels;
};

export const backLeavesTasks = (stack: Stack, shape: Shape): boolean => {
  const levels = levelsOf(stack, shape);

  if (shape === 'one') {
    return levels.length === 1;
  }

  if (shape === 'columns') {
    return levels.length === 2 && levels[1] === 'topic';
  }

  return levels.at(-2) === 'list';
};

// On iPhone Duo SwiftUI places the pages, so whether they're two side by side is its call: it
// reports it (`placed`) as the width changes, in the frame it does, and `shape` is only the guess
// until it has. Where you are is the call screen's (`stack`), so only how this container lays it out
// is its own.
export const usePages = ({
  stack,
  onMove,
  shape: guess,
  onClose,
}: {
  stack: Stack;
  onMove: (move: Move) => void;
  shape: Shape;
  onClose?: () => void;
}) => {
  const [placed, setPlaced] = useState<Shape>();
  const shape = placed ?? guess;

  const back = () => {
    if (backLeavesTasks(stack, shape)) {
      onClose?.();
    } else {
      onMove({ to: 'back' });
    }
  };

  return {
    ...stack,
    shape,
    levels: levelsOf(stack, shape),
    closes: !!onClose,
    go: onMove,
    back,
    placed: (paired: boolean) => {
      setPlaced(paired ? 'panes' : 'one');
    },
  };
};

export type Pages = ReturnType<typeof usePages>;

type Placing = Pick<Pages, 'levels' | 'shape' | 'closes'>;

// Where Tasks lays out: as wide as it's given, keeping `foot` clear at its foot, or ending at the
// fold. On iPhone Duo its pages are clear over the screen's backdrop (`paged`), and two side by side
// meet `meet` past its middle.
export interface Room {
  width: number;
  foot: number | 'fold';
  paged: boolean;
  meet?: number;
}

// A Duo page's room. Its two pages meet in the window's middle, which is where the Duo folds.
export const pagedRoom = ({ area, margin, foot }: Page): Room => ({
  width: area.width,
  foot,
  paged: true,
  meet: (margin.right - margin.left) / 2,
});

// A sheet's bar centers its title; a page's on iPhone Duo is one row: back, title, buttons.

// Every page is as tall as the room lets it be, which the keyboard can shorten.
export interface Spot {
  offset: { x: number; y: number };
  shown: boolean;
  width: number;
  foot: number;
  back?: Level | 'call';
}

// A page that ends at the fold keeps nothing clear below it.
const footOf = (foot: number | 'fold') => ({ foot: foot === 'fold' ? 0 : foot });

// A field on a page says when it's being typed in, so that page can make room above the keyboard.
export const Typing = createContext<(on: boolean) => void>(() => {});

// Whether a field's page shows. Pages stay mounted as they leave, so a field ends its own editing
// when its page stops showing, rather than keep the keyboard up for a page that's gone.
export const Showing = createContext(true);

export const useField = () => {
  const field = useRef<TextInputRef>(null);
  const showing = useContext(Showing);
  useEffect(() => {
    if (!showing) {
      field.current?.blur();
    }
  }, [showing]);

  return field;
};

// On iPhone Duo, SwiftUI places the pages by the same rule from the width it has
// (`modules/pages`), so a resize lands in the frame it happens; these spots tell each page's content
// how wide it is, whether it shows and where its Back goes.
export const spotOf = (level: Level, pages: Placing, room: Room): Spot => {
  if (pages.shape === 'panes') {
    return spotInPanes(level, pages, room);
  }

  return pages.shape === 'columns'
    ? spotInColumns(level, pages, room)
    : spotAlone(level, pages, room);
};

// A page steps down over the one before, which waits a third of a page behind; on the Duo a whole
// page, since its clear pages would show through each other. A page waiting off either edge
// already has the way back it comes in with, so its back button slides in with it: the list's
// "‹ Call" too, as it comes back from a project.
const spotAlone = (level: Level, { levels, closes }: Placing, room: Room): Spot => {
  const i = levels.indexOf(level);
  const front = i === levels.length - 1;
  const page = room.width;
  const x = front ? 0 : i === -1 ? page : -(room.paged ? page : page / 3);

  return {
    offset: { x, y: 0 },
    shown: x === 0,
    width: page,
    ...footOf(room.foot),
    back: level === 'list' ? (closes ? 'call' : undefined) : (levels[i - 1] ?? levels.at(-1)),
  };
};

const spotInColumns = (level: Level, { levels }: Placing, room: Room): Spot => {
  const list = Math.round(Math.min(440, Math.max(360, room.width * 0.42)));
  const page = room.width - list - 1;
  const i = levels.indexOf(level);
  const front = i === levels.length - 1;
  const behind = i !== -1 || level === 'topic';
  const x = level === 'list' || front ? 0 : behind ? -page / 3 : page;

  return {
    offset: { x, y: 0 },
    shown: x === 0,
    width: level === 'list' ? list : page,
    ...footOf(room.foot),
    back: level === 'list' || level === 'topic' ? undefined : levels[i - 1],
  };
};

// Held wide, the deepest level takes the second pane and the one before it the first; deeper ones
// wait off the leading edge, shallower ones off the trailing edge.
const spotInPanes = (level: Level, { levels, closes }: Placing, room: Room): Spot => {
  const panes = room.width / 2 + (room.meet ?? 0);
  const i = levels.indexOf(level);
  const front = i === levels.length - 1;
  const second = { at: panes, width: room.width - panes };

  const { at, width, shown } = front
    ? { ...second, shown: true }
    : i === levels.length - 2
      ? { at: 0, width: panes, shown: true }
      : i === -1
        ? { ...second, at: room.width, shown: false }
        : { at: -panes, width: panes, shown: false };

  return {
    offset: { x: at, y: 0 },
    shown,
    width,
    ...footOf(room.foot),
    back:
      shown && at <= 0
        ? level === 'list'
          ? closes
            ? 'call'
            : undefined
          : levels[i - 1]
        : undefined,
  };
};
