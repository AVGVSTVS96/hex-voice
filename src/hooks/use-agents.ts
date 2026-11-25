import { useState } from "react";
import * as z from "zod/mini";

import { hex } from "@/hex";
import { useKept } from "@/hooks/use-kept";
import { useWatch } from "@/hooks/use-watch";
import { Agent } from "@/live/agents";
import type { AgentSteps } from "@/live/agents";
import type { TaskId } from "@/live/tasks";

export const useAgents = (open: boolean) => {
  const [agents, keep] = useKept("agents", z.array(Agent));

  const watching = useWatch(open ? "agents" : null, hex.agents.list, (list) => {
    keep(list.agents);
  });

  return { agents, failed: watching === "offline" && !agents };
};

type Followed = AgentSteps & { agent: TaskId };

export const useAgentSteps = (id: TaskId | null) => {
  const [steps, setSteps] = useState<Followed>();

  const watching = useWatch<TaskId, Followed>(
    id,
    async (after, signal, agent) => ({ ...(await hex.agents.steps(agent, after, signal)), agent }),
    setSteps,
  );

  const mine = steps?.agent === id ? steps : undefined;

  return { steps: mine?.steps, failed: watching === "offline" && !mine, refused: undefined };
};
