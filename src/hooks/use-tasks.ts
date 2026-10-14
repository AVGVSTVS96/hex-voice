import { useEffect, useState } from 'react';

import { useWatch } from '@/hooks/use-watch';
import { tasksAPI } from '@/live/api';
import type { Task, TaskCounts, TaskRow } from '@/live/tasks';

// What the Tasks button shows: how many things are yours and how many threads are working. hex
// answers only when one of the counts moves, so this costs nothing while agents take steps.
export function useTaskCounts() {
  const [counts, setCounts] = useState<Omit<TaskCounts, 'version'>>({ needs: 0, working: 0 });
  useWatch(true, tasksAPI.counts, ({ needs: threads, working, yours }) => {
    const needs = yours ?? threads;
    setCounts((now) => (now.needs === needs && now.working === working ? now : { needs, working }));
  });
  return counts;
}

// Every task, live while the sheet is open: a row changes when its session writes.
export function useTasks(open: boolean) {
  const [tasks, setTasks] = useState<TaskRow[]>();
  const [version, setVersion] = useState<number>();
  const [offline, setOffline] = useState(false);
  useWatch(
    open,
    tasksAPI.list,
    (list) => {
      setTasks(list.tasks);
      setVersion(list.version);
    },
    setOffline,
  );
  return { tasks, version, offline };
}

// One task in full (what it needs, what it did lately), fetched again whenever the list moves.
export function useTask(id: string | null, version: number | undefined) {
  const [task, setTask] = useState<Task>();
  useEffect(() => {
    if (!id) return;
    let current = true;
    tasksAPI.get(id).then(
      (fresh) => current && setTask(fresh),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [id, version]);
  return task?.id === id ? task : undefined;
}
