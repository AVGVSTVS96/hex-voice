import { timeOfDay } from './calls';

export type TaskState = 'needs' | 'working' | 'done' | 'failed' | 'idle';
export type TaskStep = { at: string; text: string };
export type TaskAgent = { id: string; label: string; state: 'working' | 'done'; line?: string };
export type AgentTrail = TaskAgent & { steps: TaskStep[] };
export type TaskMoment = { at: string; state: TaskState; text: string };
export type TaskRow = {
  id: string;
  app: string;
  name: string;
  where: string;
  state: TaskState;
  line: string;
  since: string;
  at: string;
  agents: TaskAgent[];
  link?: string;
};
export type Task = Omit<TaskRow, 'agents'> & {
  needs?: string;
  pin?: string;
  lately: TaskMoment[];
  steps: TaskStep[];
  agents: AgentTrail[];
};
export type Activity = { title: string; state: TaskAgent['state']; steps: TaskStep[] };
export type TaskList = { version: number; tasks: TaskRow[] };
export type TaskCounts = { version: number; needs: number; working: number; yours?: number };

export interface TasksAPI {
  list(after?: number, signal?: AbortSignal): Promise<TaskList>;
  counts(after?: number, signal?: AbortSignal): Promise<TaskCounts>;
  get(id: string): Promise<Task>;
  talk(id: string): Promise<void>;
}

// How long it's worked, or since when it's waited or finished: "14 min", "9:30", "Oct 11".
export function taskTime(task: TaskRow, now = new Date()) {
  if (task.state === 'working') return duration(now.getTime() - Date.parse(task.since));
  const at = new Date(task.state === 'needs' ? task.since : task.at);
  return clock(at, now);
}

export function clock(at: Date, now = new Date()) {
  if (at.getTime() >= startOfDay(now)) return timeOfDay(at.toISOString());
  return at.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function duration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} hr` : `${Math.round(hours / 24)} d`;
}

export function startOfDay(now: Date) {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

export const STATE_WORDS: Record<TaskState, string> = {
  needs: 'waiting on you',
  working: 'working',
  done: 'done',
  failed: 'failed',
  idle: 'idle',
};

// One agent's steps on a task, newest first: the thread's own session when `agent` is null, or one
// of the subagents it started in this stretch of work.
export function activityOf(task: Task, agent: string | null): Activity | undefined {
  if (agent === null)
    return {
      title: task.name,
      state: task.state === 'working' ? 'working' : 'done',
      steps: task.steps,
    };
  const trail = task.agents.find((candidate) => candidate.id === agent);
  return trail && { title: trail.label, state: trail.state, steps: trail.steps };
}
