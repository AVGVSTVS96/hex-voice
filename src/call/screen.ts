import type { TasksAt } from '@/components/tasks/tasks-view';

// What the call screen has open, in one place, so no two parts of it can disagree. Calls and Tasks
// come in over the call one at a time (`over`). Settings is a layer: where it has a place of its own
// (the open Duo, `shared`) it and Tasks take turns in that place like tabs; elsewhere it's a sheet
// over whatever is open, so opening it leaves Tasks be. `front` stays on the last of the two opened
// while it closes, so its place fades out. The call's words are pulled down over the orb or not, and
// show the live call or a past one.
export type Over = 'none' | 'calls' | 'tasks';
export type Place = 'tasks' | 'settings';
export type Screen = {
  over: Over;
  settings: boolean;
  front: Place;
  at: TasksAt;
  words: { pulled: boolean; call: string | null };
};

export type Action =
  | { to: 'calls'; open: boolean }
  | { to: 'tasks'; open: true; at?: TasksAt }
  | { to: 'tasks'; open: false }
  | { to: 'settings'; open: boolean }
  | { to: 'words'; pulled: boolean }
  | { to: 'call'; id: string | null };

export function start(opening: { tasks?: TasksAt; open?: 'settings' | 'calls' }): Screen {
  return {
    over: opening.open === 'calls' ? 'calls' : opening.tasks ? 'tasks' : 'none',
    settings: opening.open === 'settings',
    front: opening.open === 'settings' ? 'settings' : 'tasks',
    at: opening.tasks ?? {},
    words: { pulled: false, call: null },
  };
}

export function step(now: Screen, action: Action, { shared }: { shared: boolean }): Screen {
  switch (action.to) {
    case 'calls':
      return action.open
        ? { ...now, over: 'calls', settings: false }
        : { ...now, over: now.over === 'calls' ? 'none' : now.over };
    case 'tasks':
      if (!action.open)
        return {
          ...now,
          over: now.over === 'tasks' ? 'none' : now.over,
          settings: shared ? false : now.settings,
        };
      return {
        ...now,
        over: 'tasks',
        at: action.at ?? {},
        front: 'tasks',
        settings: shared ? false : now.settings,
      };
    case 'settings':
      if (!action.open) return { ...now, settings: false };
      return {
        ...now,
        settings: true,
        front: 'settings',
        over: shared && now.over === 'tasks' ? 'none' : now.over,
      };
    case 'words':
      return {
        ...now,
        words: action.pulled ? { ...now.words, pulled: true } : { pulled: false, call: null },
      };
    case 'call':
      return {
        ...now,
        words: { pulled: now.words.pulled || action.id !== null, call: action.id },
      };
  }
}

// What shows: where settings has a place and both were left open (a fold), the one in front.
export function shown(now: Screen, shared: boolean) {
  const both = shared && now.over === 'tasks' && now.settings;
  const tasks = now.over === 'tasks' && !(both && now.front === 'settings');
  const settings = now.settings && !(both && now.front === 'tasks');
  return { calls: now.over === 'calls', tasks, settings, place: tasks || (shared && settings) };
}
