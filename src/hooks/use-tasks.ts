import { useEffect, useState } from 'react';
import * as z from 'zod/mini';

import { hex } from '@/hex';
import { useKept } from '@/hooks/use-kept';
import { useWatch } from '@/hooks/use-watch';
import { TaskCounts, TaskRow, type Task, type TaskId } from '@/live/tasks';

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

// One task in full (what it needs, what it did lately), fetched again whenever the list moves.
export function useTask(id: TaskId | null, version: number | undefined) {
  const [task, setTask] = useState<Task>();
  useEffect(() => {
    if (!id) return;
    let current = true;
    hex.tasks.get(id).then(
      (fresh) => current && setTask(fresh),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [id, version]);
  return task?.id === id ? task : undefined;
}
