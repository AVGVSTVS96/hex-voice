import { useState } from 'react';
import * as z from 'zod/mini';

import { hex } from '@/hex';
import { useKept } from '@/hooks/use-kept';
import { useAnswer, useWatch } from '@/hooks/use-watch';
import { Finished, TaskCounts, TaskRow } from '@/live/tasks';
import type { TaskId } from '@/live/tasks';

export interface Counts {
  needs: number;
  working: number;
}

// What the Tasks button shows: how many things are yours and how many threads are working. hex
// answers only when one of the counts moves, so this costs nothing while agents take steps. While
// Tasks shows its list up to date, the button counts what its tabs count (`listed`), so the two
// never disagree on screen.
export const useTaskCounts = (listed: Counts | undefined): Counts => {
  const [counts, keep] = useKept('task-counts', TaskCounts);
  useWatch('counts', hex.tasks.counts, keep);
  if (listed) {
    return listed;
  }
  return counts
    ? { needs: counts.yours ?? counts.needs, working: counts.working }
    : { needs: 0, working: 0 };
};

// On a call, the voice brings the task up.
export const raiseTask = async (id: TaskId) => {
  await hex.tasks.talk(id);
};

const NONE: Finished[] = [];

// Every task, and what hex finished in the last day, live while the sheet is open: a row changes
// when its session writes.
export const useTasks = (open: boolean) => {
  const [tasks, keep] = useKept('tasks', z.array(TaskRow));
  const [finished, keepFinished] = useKept('finished', z.array(Finished));
  const [version, setVersion] = useState<number>();
  const watching = useWatch(open ? 'tasks' : null, hex.tasks.list, (list) => {
    keep(list.tasks);
    keepFinished(list.finished);
    setVersion(list.version);
  });
  return {
    tasks,
    finished: finished ?? NONE,
    version,
    offline: watching === 'offline',
    current: watching === 'current',
  };
};

// One thread in full, fetched again whenever the list moves: its task while it's on the board
// (what it needs, what it did lately), else the page of one that's left it.
export const useTaskOrPage = (id: TaskId | null, version: number | undefined) =>
  useAnswer(id, version, hex.tasks.get);

// A task on the board in full; a thread that's left it has no steps or agents to show.
export const useTask = (id: TaskId | null, version: number | undefined) => {
  const { answer, ...answered } = useTaskOrPage(id, version);
  return { task: answer?.kind === 'task' ? answer : undefined, ...answered };
};
