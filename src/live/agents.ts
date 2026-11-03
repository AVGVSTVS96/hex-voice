import * as z from 'zod/mini';

import { Ask, Sent } from './asks';
import { CallId } from './calls';

const AgentTask = z.object({
  id: z.string(),
  state: z.catch(z.enum(['running', 'done', 'failed']), 'done'),
  text: z.string(),
  to: z.optional(z.string()),
  line: z.optional(z.string()),
});
export type AgentTask = z.infer<typeof AgentTask>;
// An ask hex put on screen during the call, with the answer once it has one and what that reached,
// until an undo takes it back.
const CallCard = z.object({
  at: z.number(),
  ask: Ask,
  answer: z.optional(z.string()),
  sent: z.optional(Sent),
});
export type CallCard = z.infer<typeof CallCard>;
export const AgentActivity = z.object({
  version: z.number(),
  call: z.nullable(CallId),
  tasks: z.array(AgentTask),
  asks: z.optional(z.array(CallCard)),
});
export type AgentLine = {
  id: string;
  state: AgentTask['state'];
  text: string;
  waiting: boolean;
  where: string;
};

// The tasks come most recently changed first, so the first running one is the agent that
// took a step last. A task that just finished holds the line until something runs again.
export function agentLine(tasks: AgentTask[], finished?: AgentTask): AgentLine | null {
  const running = tasks.filter((task) => task.state === 'running');
  const [task] = running;
  if (task) {
    const more = running.length > 1 ? `+${running.length - 1}` : '';
    return {
      id: task.id,
      state: 'running',
      text: task.line ?? task.text,
      waiting: !task.line,
      where: [task.to, more].filter(Boolean).join('  '),
    };
  }
  if (!finished || finished.state === 'running') return null;
  return {
    id: finished.id,
    state: finished.state,
    text: finished.state === 'failed' ? (finished.line ?? finished.text) : finished.text,
    waiting: false,
    where: finished.state,
  };
}

// The task a new snapshot shows finishing: running in the last one, done or failed now.
export function justFinished(before: AgentTask[], after: AgentTask[]) {
  const wasRunning = new Set(
    before.filter((task) => task.state === 'running').map((task) => task.id),
  );
  return after.find((task) => task.state !== 'running' && wasRunning.has(task.id));
}
