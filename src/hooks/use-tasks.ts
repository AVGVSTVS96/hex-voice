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

export const raiseTask = async (id: TaskId) => {
  await hex.tasks.talk(id);
};

const NONE: Finished[] = [];

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

export const useTaskOrPage = (id: TaskId | null, version: number | undefined) =>
  useAnswer(id, version, hex.tasks.get);

export const useTask = (id: TaskId | null, version: number | undefined) => {
  const { answer, ...answered } = useTaskOrPage(id, version);

  return { task: answer?.kind === 'task' ? answer : undefined, ...answered };
};
