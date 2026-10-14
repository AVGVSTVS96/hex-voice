import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';

import { agentLine, justFinished, type AgentTask, type CallCard } from '@/live/agents';
import { agentsAPI } from '@/live/api';
import { motion } from '@/motion';

const RETRY = 2000;

// What hex's agents are doing on this call, from the voice plugin's /activity long poll: it
// answers the moment a task or an agent's step changes, so the line moves with the agent. The
// same answer carries the asks hex put on screen, for the transcript.
export function useAgentLine(live: boolean, haptics: boolean) {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [cards, setCards] = useState<CallCard[]>([]);
  const [finished, setFinished] = useState<AgentTask>();
  const feel = useRef(haptics);
  feel.current = haptics;

  useEffect(() => {
    if (!live) {
      setTasks([]);
      setCards([]);
      setFinished(undefined);
      return;
    }
    const controller = new AbortController();
    let version: number | undefined;
    let seen: AgentTask[] = [];
    void (async () => {
      while (!controller.signal.aborted) {
        try {
          const activity = await agentsAPI.watch(version, controller.signal);
          const current = activity.call ? activity.tasks : [];
          const done = justFinished(seen, current);
          version = activity.version;
          seen = current;
          setTasks(current);
          setCards(activity.call ? (activity.asks ?? []) : []);
          if (!done) continue;
          setFinished(done);
          if (feel.current && process.env.EXPO_OS === 'ios')
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
        } catch {
          if (controller.signal.aborted) return;
          await new Promise((resolve) => setTimeout(resolve, RETRY));
        }
      }
    })();
    return () => controller.abort();
  }, [live]);

  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(() => setFinished(undefined), motion.agent.hold);
    return () => clearTimeout(timer);
  }, [finished]);

  return { line: agentLine(tasks, finished), cards };
}
