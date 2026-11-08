import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';

import { hex } from '@/hex';
import { useWatch } from '@/hooks/use-watch';
import { agentLine, justFinished } from '@/live/agents';
import type { AgentTask, CallCard } from '@/live/agents';
import type { CallId } from '@/live/calls';
import { motion } from '@/motion';

interface Live {
  call: CallId | null;
  tasks: AgentTask[];
  cards: CallCard[];
}

// The call hex holds right now, wherever it is (this app, a phone call, the web page), and what
// its agents are doing, from the voice plugin's /activity long poll: it answers the moment a call
// starts or ends, or a task or an agent's step changes, so the line moves with the agent. The same
// answer carries the asks hex put on screen, for the transcript.
export const useAgentLine = (haptics: boolean) => {
  const [live, setLive] = useState<Live>({ call: null, tasks: [], cards: [] });
  const [finished, setFinished] = useState<AgentTask>();
  const seen = useRef<AgentTask[]>([]);

  useWatch('activity', hex.activity.watch, (activity) => {
    const tasks = activity.call ? activity.tasks : [];
    const done = justFinished(seen.current, tasks);
    seen.current = tasks;
    setLive({ call: activity.call, tasks, cards: activity.call ? (activity.asks ?? []) : [] });

    if (!activity.call) {
      setFinished(undefined);
    }

    if (!done) {
      return;
    }

    setFinished(done);

    if (haptics && process.env.EXPO_OS === 'ios') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    }
  });

  useEffect(() => {
    if (!finished) {
      return;
    }

    const timer = setTimeout(() => {
      setFinished(undefined);
    }, motion.agent.hold);

    return () => {
      clearTimeout(timer);
    };
  }, [finished]);

  return { call: live.call, line: agentLine(live.tasks, finished), cards: live.cards };
};
