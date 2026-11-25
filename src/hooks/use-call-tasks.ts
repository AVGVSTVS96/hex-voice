import { useState } from "react";

import { hex } from "@/hex";
import { usePastCall } from "@/hooks/use-calls";
import { useWatch } from "@/hooks/use-watch";
import { callTrace } from "@/live/call-tasks";
import type { CallSteps } from "@/live/call-tasks";
import type { CallId } from "@/live/calls";

type Followed = CallSteps & { call: CallId };

export const useCallTasks = (id: CallId | undefined) => {
  const { call, failed } = usePastCall(id);
  const [steps, setSteps] = useState<Followed>();

  useWatch<CallId, Followed>(
    id ?? null,
    async (after, signal, watched) => ({
      ...(await hex.calls.steps(watched, after, signal)),
      call: watched,
    }),
    setSteps,
  );

  return {
    task: call ? callTrace(call, steps?.call === call.id ? steps : undefined) : undefined,
    failed,
    refused: undefined,
  };
};
