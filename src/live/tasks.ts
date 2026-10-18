import { timeOfDay } from './calls';

export type TaskState = 'needs' | 'working' | 'done' | 'failed' | 'idle';
// What a step did: a thought, something it said, a step of its plan, a command, a read, an edit, a
// search of the code or the web, an agent it started, or another tool.
export type StepKind =
  'think' | 'say' | 'plan' | 'run' | 'read' | 'edit' | 'search' | 'web' | 'agent' | 'tool';
export type TaskStep = { at: string; kind: StepKind; text: string };
export type TaskAgent = { id: string; label: string; state: 'working' | 'done'; line?: string };
export type AgentTrail = TaskAgent & { steps: TaskStep[] };
export type TaskMoment = { at: string; state: TaskState; text: string };
// The plan as Claude Code's todo list stands.
export type Planned = { text: string; state: 'done' | 'running' | 'pending' };
// One entry of the job's last week: the state it was in then, a change or a step within one.
export type Turn = { at: string; state: TaskState };
// `place` is what the thread is called where it lives: a Telegram topic's name, General or DM, or
// T3 Code's own title for its thread.
export type TaskRow = {
  id: string;
  app: string;
  name: string;
  place: string;
  state: TaskState;
  line: string;
  since: string;
  at: string;
  agents: TaskAgent[];
  track: Turn[];
  link?: string;
};
export type Task = Omit<TaskRow, 'agents'> & {
  needs?: string;
  pin?: string;
  lately: TaskMoment[];
  steps: TaskStep[];
  plan: Planned[];
  agents: AgentTrail[];
};
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

// How long each step took, newest first: until the next one began, and the newest, while it
// works, so far: "8s", "2 min", "now". A reply ends its turn, and what follows it is the wait for
// the next one, so a reply says when it was said instead.
export function stepTimes(steps: TaskStep[], working: boolean, now = new Date()) {
  return steps.map((step, i) => {
    if (step.kind === 'say') return timeOfDay(step.at);
    if (i === 0 && !working) return '';
    const end = i === 0 ? now.getTime() : Date.parse(steps[i - 1]!.at);
    const seconds = Math.max(0, Math.round((end - Date.parse(step.at)) / 1000));
    if (seconds >= 60) return duration(seconds * 1000);
    return i === 0 ? 'now' : `${seconds}s`;
  });
}

// Where a moment falls on a lane `width` wide: the last week on a log scale, now at the right edge.
// It's about linear for the last few minutes, then each step left covers more time, so the last
// hour takes the right 40% and the last day 77%. Tuned to hex's real sessions: TAU is about twice
// the median working stretch (61s), and a week is as long as Tasks keeps a finished thread.
const TAU = 2 * 60_000;
const WEEK = 7 * 24 * 3_600_000;
const FULL = Math.log1p(WEEK / TAU);
export const LANE_TICKS = [3_600_000, 24 * 3_600_000];

export function laneX(at: number, now: number, width: number) {
  return width * (1 - Math.min(1, Math.log1p(Math.max(0, now - at) / TAU) / FULL));
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
