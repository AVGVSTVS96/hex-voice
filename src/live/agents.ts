import * as z from "zod/mini";

import { Ask, Sent } from "./asks";
import { CallId } from "./calls";
import { TaskId, TaskStep } from "./tasks";
import type { Task } from "./tasks";

const AgentTask = z.object({
  id: z.string(),
  state: z.catch(z.enum(["running", "done", "failed"]), "done"),
  text: z.string(),
  to: z.optional(z.string()),
  line: z.optional(z.string()),
  agent: z.optional(z.string()),
});

export type AgentTask = z.infer<typeof AgentTask>;

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

export interface AgentLine {
  id: string;
  agent?: string;
  state: AgentTask["state"];
  text: string;
  waiting: boolean;
  where: string;
}

export const agentLine = (tasks: AgentTask[], finished?: AgentTask): AgentLine | null => {
  const running = tasks.filter((task) => task.state === "running");
  const task = running.at(0);

  if (task) {
    const more = running.length > 1 ? `+${running.length - 1}` : "";

    return {
      id: task.id,
      ...(task.agent !== undefined && { agent: task.agent }),
      state: "running",
      text: task.line ?? task.text,
      waiting: (task.line ?? "") === "",
      where: [task.to, more].filter(Boolean).join("  "),
    };
  }

  if (!finished || finished.state === "running") {
    return null;
  }

  return {
    id: finished.id,
    ...(finished.agent !== undefined && { agent: finished.agent }),
    state: finished.state,
    text: finished.state === "failed" ? (finished.line ?? finished.text) : finished.text,
    waiting: false,
    where: finished.state,
  };
};

export const justFinished = (before: AgentTask[], after: AgentTask[]) => {
  const wasRunning = new Set(before.flatMap((task) => (task.state === "running" ? [task.id] : [])));

  return after.find((task) => task.state !== "running" && wasRunning.has(task.id));
};

export const Agent = z.object({
  id: TaskId,
  session: z.string(),
  place: z.string(),
  label: z.string(),
  who: z.string(),
  state: z.catch(z.enum(["working", "done", "stopped"]), "done"),
  since: z.string(),
  end: z.optional(z.string()),
});

export type Agent = z.infer<typeof Agent>;

export const AgentList = z.object({ version: z.number(), agents: z.array(Agent) });

export const AgentSteps = z.object({ version: z.number(), steps: z.array(TaskStep) });

export type AgentSteps = z.infer<typeof AgentSteps>;

export const agentTask = (agent: Agent, steps: AgentSteps["steps"]): Task => ({
  id: agent.id,
  app: "chex",
  name: agent.label,
  place: agent.place,
  state: agent.state === "working" ? "working" : "done",
  running: agent.state === "working",
  line: "",
  since: agent.since,
  at: agent.end ?? agent.since,
  track: [],
  lately: [],
  steps: steps.toReversed(),
  plan: [],
  agents: [],
});
