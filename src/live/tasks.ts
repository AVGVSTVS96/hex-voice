import * as z from 'zod/mini';

import { timeOfDay } from './calls';
import { Shared } from './media';

export const TaskId = z.string().brand<'TaskId'>();

export type TaskId = z.infer<typeof TaskId>;

export const TaskState = z.catch(z.enum(['needs', 'working', 'done', 'failed', 'idle']), 'idle');

export type TaskState = z.infer<typeof TaskState>;

const StepKind = z.catch(
  z.enum(['think', 'say', 'plan', 'run', 'read', 'edit', 'search', 'web', 'agent', 'tool']),
  'tool',
);

export type StepKind = z.infer<typeof StepKind>;

const TaskStep = z.object({
  id: z.optional(z.string()),
  at: z.string(),
  end: z.optional(z.string()),
  kind: StepKind,
  text: z.string(),
  state: z.catch(z.optional(z.enum(['running', 'done', 'failed'])), undefined),
  detail: z.optional(z.string()),
  result: z.optional(z.string()),
  agent: z.optional(z.string()),
});

export type TaskStep = z.infer<typeof TaskStep>;

const AgentState = z.catch(z.enum(['working', 'done', 'failed', 'stopped']), 'done');

export type AgentState = z.infer<typeof AgentState>;

const agentFields = {
  id: z.string(),
  label: z.string(),
  state: AgentState,
  who: z.optional(z.string()),
  since: z.optional(z.string()),
  end: z.optional(z.string()),
  line: z.optional(z.string()),
  result: z.optional(z.string()),
  link: z.optional(z.string()),
};

const TaskAgent = z.object(agentFields);

export type TaskAgent = z.infer<typeof TaskAgent>;

const AgentTrail = z.object({ ...agentFields, steps: z.array(TaskStep) });

export type AgentTrail = z.infer<typeof AgentTrail>;

const TaskMoment = z.object({ at: z.string(), state: TaskState, text: z.string() });

export type TaskMoment = z.infer<typeof TaskMoment>;

const Planned = z.object({
  text: z.string(),
  state: z.catch(z.enum(['done', 'running', 'pending']), 'pending'),
});

export type Planned = z.infer<typeof Planned>;

const Turn = z.object({ at: z.string(), state: TaskState });

export type Turn = z.infer<typeof Turn>;

const row = {
  id: TaskId,
  app: z.string(),
  name: z.string(),
  place: z.string(),
  state: TaskState,
  running: z.boolean(),
  line: z.string(),
  since: z.string(),
  at: z.string(),
  track: z.array(Turn),
  link: z.optional(z.string()),
};

export const TaskRow = z.object({ ...row, agents: z.array(TaskAgent) });

export type TaskRow = z.infer<typeof TaskRow>;

export const Task = z.object({
  ...row,
  needs: z.optional(z.string()),
  pin: z.optional(z.string()),
  lately: z.array(TaskMoment),
  steps: z.array(TaskStep),
  plan: z.array(Planned),
  agents: z.array(AgentTrail),
});

export type Task = z.infer<typeof Task>;

const Page = z.object({
  id: TaskId,
  app: z.string(),
  name: z.string(),
  place: z.string(),
  at: z.optional(z.string()),
  line: z.optional(z.string()),
  link: z.optional(z.string()),
  pin: z.optional(z.string()),
  state: z.optional(z.never()),
});

export const TaskOrPage = z.union([
  z.pipe(
    Task,
    z.transform((task) => ({ ...task, kind: 'task' as const })),
  ),
  z.pipe(
    Page,
    z.transform((page) => ({ ...page, kind: 'page' as const })),
  ),
]);

export type TaskOrPage = z.output<typeof TaskOrPage>;

export type TaskPage = Extract<TaskOrPage, { kind: 'page' }>;

export const Finished = z.object({
  id: z.string(),
  title: z.string(),
  topic: z.string(),
  app: z.string(),
  proof: z.string(),
  at: z.string(),
  run: z.optional(TaskId),
  link: z.optional(z.string()),
});

export type Finished = z.infer<typeof Finished>;

export const TaskList = z.object({
  version: z.number(),
  tasks: z.array(TaskRow),
  finished: z.catch(z.array(Finished), []),
});

export type TaskList = z.infer<typeof TaskList>;

const ChatTurn = z.object({
  from: z.catch(z.enum(['me', 'hex']), 'hex'),
  text: z.string(),
  media: z.optional(z.array(Shared)),
});

export type ChatTurn = z.infer<typeof ChatTurn>;

export const Chat = z.object({
  version: z.number(),
  sends: z.boolean(),
  total: z.number(),
  turns: z.array(ChatTurn),
  waiting: z.array(z.object({ key: z.string(), text: z.string(), at: z.string() })),
});

export type Chat = z.infer<typeof Chat>;

export const TaskCounts = z.object({
  version: z.number(),
  needs: z.number(),
  working: z.number(),
  yours: z.optional(z.number()),
});

export type TaskCounts = z.infer<typeof TaskCounts>;

export const taskTime = (task: TaskRow, now = new Date()) => {
  if (task.state === 'working') {
    return duration(now.getTime() - Date.parse(task.since));
  }

  return clock(new Date(task.state === 'needs' ? task.since : task.at), now);
};

export const clock = (at: Date, now = new Date()) => {
  if (at.getTime() >= startOfDay(now)) {
    return timeOfDay(at.toISOString());
  }

  return at.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const duration = (ms: number) => {
  const minutes = Math.max(0, Math.round(ms / 60_000));

  if (minutes < 1) {
    return 'now';
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.round(minutes / 60);

  return hours < 24 ? `${hours} hr` : `${Math.round(hours / 24)} d`;
};

const took = (ms: number) => {
  const seconds = Math.max(1, Math.round(ms / 1000));

  return seconds < 60 ? `${seconds}s` : duration(ms);
};

export const stepMark = (step: TaskStep): 'failed' | 'working' | undefined => {
  if (step.state === 'failed') {
    return 'failed';
  }

  if (step.state === 'running') {
    return 'working';
  }

  return undefined;
};

export const stepTimes = (steps: TaskStep[], now = new Date()) =>
  steps.map((step, i) => {
    if (step.kind === 'say') {
      return timeOfDay(step.at);
    }

    const at = Date.parse(step.at);

    if (step.end !== undefined && step.end !== '') {
      return took(Date.parse(step.end) - at);
    }

    if (step.state === 'running') {
      return took(now.getTime() - at);
    }

    const until = i === 0 ? at : Date.parse(steps[i - 1].at);

    return until - at < 500 ? '' : took(until - at);
  });

const started = (agent: TaskAgent) =>
  agent.since === undefined || agent.since === '' ? 0 : Date.parse(agent.since);

const ended = (agent: TaskAgent) =>
  agent.end === undefined || agent.end === '' ? started(agent) : Date.parse(agent.end);

const inOrder = <A extends TaskAgent>(agents: A[]) => [
  ...agents
    .filter((agent) => agent.state === 'working')
    .toSorted((a, b) => started(b) - started(a)),
  ...agents.filter((agent) => agent.state !== 'working').toSorted((a, b) => ended(b) - ended(a)),
];

export const agentsInOrder = <A extends TaskAgent>(agents: A[]) => {
  const retried = (agent: A) =>
    agent.state === 'stopped' &&
    agents.some((other) => other.label === agent.label && started(other) > started(agent));

  return {
    shown: inOrder(agents.filter((agent) => !retried(agent))),
    tries: inOrder(agents.filter(retried)),
  };
};

export const atWork = <A extends TaskAgent>(agents: A[]) =>
  inOrder(agents.filter((agent) => agent.state === 'working'));

export const agentCounts = (agents: TaskAgent[]) =>
  (['working', 'done', 'failed', 'stopped'] as const)
    .flatMap((state) => {
      const count = agents.filter((agent) => agent.state === state).length;

      return count > 0 ? [`${count} ${state}`] : [];
    })
    .join(' · ');

export const agentMeta = (agent: TaskAgent, now = new Date()) => {
  const { since, state } = agent;
  const finish = agent.end === undefined ? Number.NaN : Date.parse(agent.end);
  const end = state === 'working' ? now.getTime() : finish;
  const timed = since !== undefined && since !== '' && end !== 0 && !Number.isNaN(end);
  const spent = timed ? took(end - Date.parse(since)) : '';
  const time = state === 'stopped' || state === 'failed' ? state : spent;

  return [agent.who, time].filter(Boolean).join(' · ');
};

export const agentSteps = (agent: AgentTrail) => {
  const [last, ...rest] = agent.steps;

  if (last?.kind !== 'say' || agent.result === undefined || agent.result === '') {
    return agent.steps;
  }

  const same = Math.min(60, last.text.length, agent.result.length);

  return last.text.slice(0, same) === agent.result.slice(0, same) ? rest : agent.steps;
};

export const agentWords = (agents: TaskAgent[], working: boolean): string | undefined => {
  const named = working ? atWork(agents) : agentsInOrder(agents).shown;

  if (!named.length) {
    return undefined;
  }

  const names = named.map((agent) => agent.label.split(':')[0].trim());
  const count = `${named.length} agent${named.length === 1 ? '' : 's'}`;

  return `${count}${working ? ' working' : ''} · ${names.join(', ')}`;
};

export const lastRun = (task: Task) =>
  task.state !== 'working' && !!(task.steps.length || task.agents.length);

const TAU = 2 * 60_000;
const WEEK = 7 * 24 * 3_600_000;
const FULL = Math.log1p(WEEK / TAU);
export const LANE_TICKS = [3_600_000, 24 * 3_600_000];

export const laneX = (at: number, now: number, width: number) =>
  width * (1 - Math.min(1, Math.log1p(Math.max(0, now - at) / TAU) / FULL));

export const startOfDay = (now: Date) => {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);

  return day.getTime();
};

export const STATE_WORDS: Record<TaskState, string> = {
  needs: 'waiting on you',
  working: 'working',
  done: 'done',
  failed: 'failed',
  idle: 'idle',
};
