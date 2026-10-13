import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { tasksAPI } from '@/live/api';
import type { Task, TaskCounts, TaskRow } from '@/live/tasks';

const RETRY = 2000;

// Asks hex and waits: each answer comes the moment something changes, and the next question
// carries the version it answered with. It runs while `on`, and only while the app is in front.
function useWatch<T extends { version: number }>(
  on: boolean,
  ask: (after: number | undefined, signal: AbortSignal) => Promise<T>,
  take: (answer: T) => void,
  offline?: (offline: boolean) => void,
) {
  const active = useActive();
  useEffect(() => {
    if (!on || !active) return;
    const controller = new AbortController();
    void (async () => {
      let version: number | undefined;
      while (!controller.signal.aborted) {
        try {
          const answer = await ask(version, controller.signal);
          version = answer.version;
          take(answer);
          offline?.(false);
        } catch {
          if (controller.signal.aborted) return;
          offline?.(true);
          await new Promise((resolve) => setTimeout(resolve, RETRY));
        }
      }
    })();
    return () => controller.abort();
  }, [on, active]);
}

function useActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => listener.remove();
  }, []);
  return active;
}

// What the Tasks button shows: how many need you and how many are working. hex answers only
// when one of the counts moves, so this costs nothing while agents take steps.
export function useTaskCounts() {
  const [counts, setCounts] = useState<Omit<TaskCounts, 'version'>>({ needs: 0, working: 0 });
  useWatch(true, tasksAPI.counts, ({ needs, working }) =>
    setCounts((now) => (now.needs === needs && now.working === working ? now : { needs, working })),
  );
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
