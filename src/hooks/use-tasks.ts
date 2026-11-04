import { useState } from 'react';
import * as z from 'zod/mini';

import { hex } from '@/hex';
import { useKept } from '@/hooks/use-kept';
import { useAnswer, useWatch } from '@/hooks/use-watch';
import { TaskCounts, TaskRow, type TaskId } from '@/live/tasks';

// What the Tasks button shows: how many things are yours and how many threads are working. hex
// answers only when one of the counts moves, so this costs nothing while agents take steps.
export function useTaskCounts() {
  const [counts, keep] = useKept('task-counts', TaskCounts);
  useWatch('counts', hex.tasks.counts, keep);
  return counts
    ? { needs: counts.yours ?? counts.needs, working: counts.working }
    : { needs: 0, working: 0 };
}

// On a call, the voice brings the task up.
export const raiseTask = (id: TaskId) => hex.tasks.talk(id);

// Every task, live while the sheet is open: a row changes when its session writes.
export function useTasks(open: boolean) {
  const [tasks, keep] = useKept('tasks', z.array(TaskRow));
  const [version, setVersion] = useState<number>();
  const watching = useWatch(open ? 'tasks' : null, hex.tasks.list, (list) => {
    keep(list.tasks);
    setVersion(list.version);
  });
  return { tasks, version, offline: watching === 'offline', current: watching === 'current' };
}

// One thread in full, fetched again whenever the list moves: its task while it's on the board
// (what it needs, what it did lately), else the page of one that's left it.
export function useTaskOrPage(id: TaskId | null, version: number | undefined) {
  return useAnswer(id, version, hex.tasks.get);
}

// A task on the board in full; a thread that's left it has no steps or agents to show.
export function useTask(id: TaskId | null, version: number | undefined) {
  const { answer, failed } = useTaskOrPage(id, version);
  return { task: answer?.kind === 'task' ? answer : undefined, failed };
}
