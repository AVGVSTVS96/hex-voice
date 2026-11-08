import { move, startAt } from '@/components/tasks/pages';
import type { Move, Stack, TasksAt } from '@/components/tasks/pages';

export type Over = 'none' | 'calls' | 'tasks';

export type Place = 'tasks' | 'settings';

export interface Screen {
  over: Over;
  settings: boolean;
  front: Place;
  pages: Stack;
  words: { pulled: boolean; call: string | null; beside: boolean };
}

export type Action =
  | { to: 'calls'; open: boolean }
  | { to: 'tasks'; open: true; at?: TasksAt }
  | { to: 'tasks'; open: false }
  | { to: 'settings'; open: boolean }
  | { to: 'words'; pulled: boolean }
  | { to: 'beside'; on: boolean }
  | { to: 'call'; id: string | null }
  | { to: 'pages'; move: Move };

interface Opening {
  tasks?: TasksAt;
  open?: 'settings' | 'calls';
}

const overAt = (opening: Opening): Over => {
  if (opening.open === 'calls') {
    return 'calls';
  }

  return opening.tasks ? 'tasks' : 'none';
};

export const start = (opening: Opening): Screen => ({
  over: overAt(opening),
  settings: opening.open === 'settings',
  front: opening.open === 'settings' ? 'settings' : 'tasks',
  pages: startAt(opening.tasks ?? {}),
  words: { pulled: false, call: null, beside: false },
});

export const step = (now: Screen, action: Action, { shared }: { shared: boolean }): Screen => {
  switch (action.to) {
    case 'calls': {
      return action.open
        ? { ...now, over: 'calls', settings: false }
        : { ...now, over: now.over === 'calls' ? 'none' : now.over };
    }

    case 'tasks': {
      if (!action.open) {
        return {
          ...now,
          over: now.over === 'tasks' ? 'none' : now.over,
          settings: shared ? false : now.settings,
        };
      }

      return {
        ...now,
        over: 'tasks',
        pages: startAt(action.at ?? {}),
        front: 'tasks',
        settings: shared ? false : now.settings,
      };
    }

    case 'settings': {
      if (!action.open) {
        return { ...now, settings: false };
      }

      return {
        ...now,
        settings: true,
        front: 'settings',
        over: shared ? 'none' : now.over,
      };
    }

    case 'words': {
      return {
        ...now,
        words: action.pulled
          ? { ...now.words, pulled: true }
          : { ...now.words, pulled: false, call: null },
      };
    }

    case 'beside': {
      return { ...now, words: { ...now.words, beside: action.on } };
    }

    case 'call': {
      return {
        ...now,
        words: { ...now.words, pulled: now.words.pulled || action.id !== null, call: action.id },
      };
    }

    case 'pages': {
      return { ...now, pages: move(now.pages, action.move) };
    }

    default: {
      return now;
    }
  }
};

export const shown = (now: Screen, shared: boolean) => {
  const both = shared && now.over === 'tasks' && now.settings;
  const tasks = now.over === 'tasks' && !(both && now.front === 'settings');
  const settings = now.settings && !(both && now.front === 'tasks');
  const calls = now.over === 'calls' && !(shared && now.settings);

  return { calls, tasks, settings, place: tasks || (shared && settings) };
};
