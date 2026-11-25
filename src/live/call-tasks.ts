import * as z from "zod/mini";

import type { CallRecord, CallTask } from "./calls";
import { TaskId, TaskStep } from "./tasks";
import type { AgentState, AgentTrail, Task, TaskStep as Step } from "./tasks";

export const CallSteps = z.object({
  version: z.number(),
  tasks: z.array(z.object({ id: z.string(), steps: z.array(TaskStep) })),
});

export type CallSteps = z.infer<typeof CallSteps>;

const STATES: Record<CallTask["state"], AgentState> = {
  running: "working",
  done: "done",
  failed: "failed",
};

const timeIn = (call: Pick<CallRecord, "started">, at: number) =>
  new Date(Date.parse(call.started) + at).toISOString();

const trailOf = (
  call: Pick<CallRecord, "started">,
  updates: CallTask[],
  steps: Step[],
): AgentTrail | undefined => {
  const first = updates.at(0);
  const latest = updates.at(-1);

  if (!first || !latest) {
    return undefined;
  }

  const state = STATES[latest.state];
  const newest = steps.toReversed();

  return {
    id: latest.id,
    label: latest.text,
    state,
    since: timeIn(call, first.at),
    ...(state !== "working" && { end: timeIn(call, latest.at) }),
    ...(newest[0] && { line: newest[0].text }),
    steps: newest,
  };
};

const stateOf = (agents: AgentTrail[]) => {
  if (agents.some((agent) => agent.state === "working")) {
    return "working";
  }

  return agents.some((agent) => agent.state === "failed") ? "failed" : "done";
};

export const callTrace = (
  call: Pick<CallRecord, "id" | "started" | "title" | "tasks">,
  found: CallSteps | undefined,
): Task => {
  const ids = [...new Set(call.tasks.map((task) => task.id))];

  const agents = ids.flatMap((id) => {
    const trail = trailOf(
      call,
      call.tasks.filter((task) => task.id === id),
      found?.tasks.find((task) => task.id === id)?.steps ?? [],
    );

    return trail ? [trail] : [];
  });

  const state = stateOf(agents);
  const last = Math.max(0, ...call.tasks.map((task) => task.at));
  const name = call.title ?? "This call";

  return {
    id: TaskId.parse(call.id),
    app: "voice",
    name,
    place: name,
    state,
    running: state === "working",
    line: "",
    since: timeIn(call, Math.min(...call.tasks.map((task) => task.at), last)),
    at: timeIn(call, last),
    track: [],
    lately: [],
    steps: [],
    plan: [],
    agents,
  };
};
