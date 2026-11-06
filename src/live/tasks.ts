import * as z from 'zod/mini';

import { timeOfDay } from './calls';

export const TaskId = z.string().brand<'TaskId'>();
export type TaskId = z.infer<typeof TaskId>;

export const TaskState = z.catch(z.enum(['needs', 'working', 'done', 'failed', 'idle']), 'idle');
export type TaskState = z.infer<typeof TaskState>;
// What a step did: a thought, something it said, a step of its plan, a command, a read, an edit, a
// search of the code or the web, an agent it started, or another tool.
const StepKind = z.catch(
  z.enum(['think', 'say', 'plan', 'run', 'read', 'edit', 'search', 'web', 'agent', 'tool']),
  'tool',
);
export type StepKind = z.infer<typeof StepKind>;
// A step that called a tool says how it went, `detail` is what it acted on (the command, a path,
// the query), `result` the first lines of what came back, and `agent` the agent it started.
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
// An agent a thread started: a Claude Code subagent or session, or a T3 Code delegation. `who` is
// its model in words, `line` its newest step while it works, `result` what it handed back, and
// `link` opens it in T3 Code. Stopped is interrupted or cancelled.
const AgentState = z.catch(z.enum(['working', 'done', 'failed', 'stopped']), 'done');
export type AgentState = z.infer<typeof AgentState>;
const agent = {
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
const TaskAgent = z.object(agent);
export type TaskAgent = z.infer<typeof TaskAgent>;
const AgentTrail = z.object({ ...agent, steps: z.array(TaskStep) });
export type AgentTrail = z.infer<typeof AgentTrail>;
const TaskMoment = z.object({ at: z.string(), state: TaskState, text: z.string() });
export type TaskMoment = z.infer<typeof TaskMoment>;
// The plan as Claude Code's todo list stands.
const Planned = z.object({
  text: z.string(),
  state: z.catch(z.enum(['done', 'running', 'pending']), 'pending'),
});
export type Planned = z.infer<typeof Planned>;
// One entry of the job's last week: the state it was in then, a change or a step within one.
const Turn = z.object({ at: z.string(), state: TaskState });
export type Turn = z.infer<typeof Turn>;
// `place` is what the thread is called where it lives: a Telegram topic's name, General or DM, or
// T3 Code's own title for its thread.
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
// A thread off the board, closed or quiet past a week: a page to read, with nothing to act on.
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
// What hex has for one thread: its task while it's on the board, else its page, which has no
// state.
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
// A task hex closed in the last day: what it was, the proof it was closed with, and the topic it
// was done in, named as that project's threads are, with `run` its thread while that's on the board.
// `app` and `link` are where its thread lives.
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
// A thread's chat: the latest of what you said and hex replied across its sessions (`turns`, out
// of `total`), what you sent that its session hasn't taken in yet, and whether words typed here
// reach it (T3 Code threads take only what's typed in T3 Code).
const ChatTurn = z.object({ from: z.catch(z.enum(['me', 'hex']), 'hex'), text: z.string() });
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

// How long it's worked, or since when it's waited or finished: "14 min", "9:30", "Oct 11".
export function taskTime(task: TaskRow, now = new Date()) {
  if (task.state === 'working') return duration(now.getTime() - Date.parse(task.since));
  return clock(new Date(task.state === 'needs' ? task.since : task.at), now);
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

// A thread's agents in a few words, each by its name up to a colon: those at work while it works,
// "2 agents working · today, sol", and once it's done all it ran, "2 agents · voice, sol".
export function agentWords(agents: TaskAgent[], working: boolean) {
  const named = working ? atWork(agents) : agentsInOrder(agents).shown;
  if (!named.length) return undefined;
  const names = named.map((agent) => agent.label.split(':')[0]!.trim());
  const count = `${named.length} agent${named.length === 1 ? '' : 's'}`;
  return `${count}${working ? ' working' : ''} · ${names.join(', ')}`;
}

// A thread that isn't working shows its last run on its topic's page while it kept what it did.
export const lastRun = (task: Task) =>
  task.state !== 'working' && !!(task.steps.length || task.agents.length);

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
