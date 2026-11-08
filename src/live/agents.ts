import * as z from "zod/mini";

import { Ask, Sent } from "./asks";
import { CallId } from "./calls";

const AgentTask = z.object({
  id: z.string(),
  state: z.catch(z.enum(["running", "done", "failed"]), "done"),
  text: z.string(),
  to: z.optional(z.string()),
  line: z.optional(z.string()),
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
