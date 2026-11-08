import type { TextInputRef } from '@expo/ui';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

import { TASKS } from '@/call/stage';
import type { AskId } from '@/live/asks';
import type { PageId, Tab } from '@/live/inbox';
import type { TaskId } from '@/live/tasks';
import type { Page } from '@/screens/layout';

export type Level = 'list' | 'topic' | 'thread' | 'steps' | 'check' | 'picks' | 'pick';

type Pushed = Exclude<Level, 'list'>;

export interface TasksAt {
  task?: TaskId;
  stage?: Tab;
}

export interface Stack {
  path: Pushed[];
  task: PageId | null;
  row: string | null;
  stepsOf: TaskId | null;
  pick: AskId | null;
  focusComposer: boolean;
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

export const startAt = (at: TasksAt): Stack => ({
  ...START,
  task: at.task ?? null,
  path: at.task ? ['topic'] : [],
  stage: at.stage ?? null,
});

const COLUMNS = 900;

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
      return { ...stack, path: ['topic', 'thread'], focusComposer: step.write === true };
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

    default: {
      return step satisfies never;
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

export interface Room {
  width: number;
  foot: number | 'fold';
  paged: boolean;
  meet?: number;
}

export const pagedRoom = ({ area, margin, foot }: Page): Room => ({
  width: area.width,
  foot,
  paged: true,
  meet: (margin.right - margin.left) / 2,
});

export interface Spot {
  offset: { x: number; y: number };
  shown: boolean;
  width: number;
  foot: number;
  back?: Level | 'call';
}

const footOf = (foot: number | 'fold') => ({ foot: foot === 'fold' ? 0 : foot });

export const Typing = createContext<((on: boolean) => void) | undefined>(undefined);

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

export const spotOf = (level: Level, pages: Placing, room: Room): Spot => {
  if (pages.shape === 'panes') {
    return spotInPanes(level, pages, room);
  }

  return pages.shape === 'columns'
    ? spotInColumns(level, pages, room)
    : spotAlone(level, pages, room);
};

const spotAlone = (level: Level, { levels, closes }: Placing, room: Room): Spot => {
  const i = levels.indexOf(level);
  const front = i === levels.length - 1;
  const page = room.width;
  const behind = -(room.paged ? page : page / 3);
  const waiting = i === -1 ? page : behind;
  const x = front ? 0 : waiting;

  return {
    offset: { x, y: 0 },
    shown: x === 0,
    width: page,
    ...footOf(room.foot),
    back: level === 'list' ? listBack(closes) : (levels[i - 1] ?? levels.at(-1)),
  };
};

const spotInColumns = (level: Level, { levels }: Placing, room: Room): Spot => {
  const list = Math.round(Math.min(440, Math.max(360, room.width * 0.42)));
  const page = room.width - list - 1;
  const i = levels.indexOf(level);
  const front = i === levels.length - 1;
  const behind = i !== -1 || level === 'topic';
  const waiting = behind ? -page / 3 : page;
  const x = level === 'list' || front ? 0 : waiting;

  return {
    offset: { x, y: 0 },
    shown: x === 0,
    width: level === 'list' ? list : page,
    ...footOf(room.foot),
    back: level === 'list' || level === 'topic' ? undefined : levels[i - 1],
  };
};

const spotInPanes = (level: Level, { levels, closes }: Placing, room: Room): Spot => {
  const panes = room.width / 2 + (room.meet ?? 0);
  const i = levels.indexOf(level);
  const front = i === levels.length - 1;
  const second = { at: panes, width: room.width - panes };

  const waiting =
    i === -1
      ? { ...second, at: room.width, shown: false }
      : { at: -panes, width: panes, shown: false };

  const first = i === levels.length - 2 ? { at: 0, width: panes, shown: true } : waiting;
  const { at, width, shown } = front ? { ...second, shown: true } : first;
  const before = level === 'list' ? listBack(closes) : levels[i - 1];

  return {
    offset: { x: at, y: 0 },
    shown,
    width,
    ...footOf(room.foot),
    back: shown && at <= 0 ? before : undefined,
  };
};

const listBack = (closes: boolean): Spot['back'] => (closes ? 'call' : undefined);
