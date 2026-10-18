import { timeOfDay } from './calls';

export type TaskState = 'needs' | 'working' | 'done' | 'failed' | 'idle';
// What a step did: a thought, something it said, a step of its plan, a command, a read, an edit, a
// search of the code or the web, an agent it started, or another tool.
export type StepKind =
  'think' | 'say' | 'plan' | 'run' | 'read' | 'edit' | 'search' | 'web' | 'agent' | 'tool';
// A step that called a tool says how it went, `detail` is what it acted on (the command, a path,
// the query), `result` the first lines of what came back, and `agent` the agent it started.
export type TaskStep = {
  id?: string;
  at: string;
  end?: string;
  kind: StepKind;
  text: string;
  state?: 'running' | 'done' | 'failed';
  detail?: string;
  result?: string;
  agent?: string;
};
// An agent a thread started: a Claude Code subagent or session, or a T3 Code delegation. `who` is
// its model in words, `line` its newest step while it works, `result` what it handed back, and
// `link` opens it in T3 Code. Stopped is interrupted or cancelled.
export type AgentState = 'working' | 'done' | 'failed' | 'stopped';
export type TaskAgent = {
  id: string;
  label: string;
  state: AgentState;
  who?: string;
  since?: string;
  end?: string;
  line?: string;
  result?: string;
  link?: string;
};
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

function took(ms: number) {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return seconds < 60 ? `${seconds}s` : duration(ms);
}

// A step's mark when its state says more than its kind: turning while it runs, red when it failed.
// Only a running step turns, so a thread waiting on its agents shows them at work instead.
export function stepMark(step: TaskStep) {
  if (step.state === 'failed') return 'failed';
  if (step.state === 'running') return 'working';
  return undefined;
}

// How long each step took, newest first: from when it began until its result came back, and while
// it runs, so far: "8s", "2 min". A reply ends its turn, and what follows it is the wait for the
// next one, so a reply says when it was said instead. A step that never said when it ended lasts
// until the next one began, and says nothing when that was at once.
export function stepTimes(steps: TaskStep[], now = new Date()) {
  return steps.map((step, i) => {
    if (step.kind === 'say') return timeOfDay(step.at);
    const at = Date.parse(step.at);
    if (step.end) return took(Date.parse(step.end) - at);
    if (step.state === 'running') return took(now.getTime() - at);
    const until = i === 0 ? at : Date.parse(steps[i - 1]!.at);
    return until - at < 500 ? '' : took(until - at);
  });
}

const started = (agent: TaskAgent) => (agent.since ? Date.parse(agent.since) : 0);
const ended = (agent: TaskAgent) => (agent.end ? Date.parse(agent.end) : started(agent));
const inOrder = <A extends TaskAgent>(agents: A[]) => [
  ...agents.filter((agent) => agent.state === 'working').sort((a, b) => started(b) - started(a)),
  ...agents.filter((agent) => agent.state !== 'working').sort((a, b) => ended(b) - ended(a)),
];

// A thread's agents as the Trace lists them: those at work first, newest started first, then the
// finished, newest finished first. Earlier tries, agents that stopped and were run again under the
// same name, are kept apart.
export function agentsInOrder<A extends TaskAgent>(agents: A[]) {
  const retried = (agent: A) =>
    agent.state === 'stopped' &&
    agents.some((other) => other.label === agent.label && started(other) > started(agent));
  return {
    shown: inOrder(agents.filter((agent) => !retried(agent))),
    tries: inOrder(agents.filter(retried)),
  };
}

export const atWork = <A extends TaskAgent>(agents: A[]) =>
  inOrder(agents.filter((agent) => agent.state === 'working'));

// How many agents are in each state, those at work first: "2 working · 9 done".
export function agentCounts(agents: TaskAgent[]) {
  return (['working', 'done', 'failed', 'stopped'] as const)
    .map((state) => [state, agents.filter((agent) => agent.state === state).length] as const)
    .filter(([, count]) => count)
    .map(([state, count]) => `${count} ${state}`)
    .join(' · ');
}

// Who an agent is and how it's going: "Opus 5.5 · 4 min" while it works or how long it took once
// done, "Opus 5.5 · stopped" or "· failed" otherwise.
export function agentMeta(agent: TaskAgent, now = new Date()) {
  const end = agent.state === 'working' ? now.getTime() : agent.end && Date.parse(agent.end);
  const time =
    agent.state === 'stopped' || agent.state === 'failed'
      ? agent.state
      : agent.since && end
        ? took(end - Date.parse(agent.since))
        : '';
  return [agent.who, time].filter(Boolean).join(' · ');
}

// An agent's steps once it's open, without its last reply when that only repeats what it handed
// back, which shows above them.
export function agentSteps(agent: AgentTrail) {
  const [last, ...rest] = agent.steps;
  if (last?.kind !== 'say' || !agent.result) return agent.steps;
  const same = Math.min(60, last.text.length, agent.result.length);
  return last.text.slice(0, same) === agent.result.slice(0, same) ? rest : agent.steps;
}

// A thread's agents at work in a few words, each by its name up to a colon: "2 agents working ·
// today, sol".
export function agentsWorking(agents: TaskAgent[]) {
  const working = atWork(agents);
  if (!working.length) return undefined;
  const names = working.map((agent) => agent.label.split(':')[0]!.trim());
  const count = `${working.length} agent${working.length === 1 ? '' : 's'}`;
  return `${count} working · ${names.join(', ')}`;
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
