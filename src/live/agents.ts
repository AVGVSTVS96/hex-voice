import type { Ask } from './asks';

export type AgentTask = {
  id: string;
  state: 'running' | 'done' | 'failed';
  text: string;
  to?: string;
  line?: string;
};
// An ask hex put on screen during the call, with the answer once it has one.
export type CallCard = { at: number; ask: Ask; answer?: string };
export type AgentActivity = {
  version: number;
  call: string | null;
  tasks: AgentTask[];
  asks?: CallCard[];
};
export type AgentLine = {
  id: string;
  state: AgentTask['state'];
  text: string;
  waiting: boolean;
  where: string;
};

export interface AgentsAPI {
  watch(after: number | undefined, signal: AbortSignal): Promise<AgentActivity>;
}

export function createAgentsAPI(options: {
  fetch: typeof globalThis.fetch;
  hexUrl?: string;
  token?: string;
}): AgentsAPI {
  return {
    async watch(after, signal) {
      const origin = options.hexUrl?.trim().replace(/\/+$/, '');
      if (!origin) throw new Error('Set EXPO_PUBLIC_HEX_URL to your hex voice address.');
      const query = after === undefined ? '' : `?after=${after}`;
      const response = await options.fetch(`${origin}/activity${query}`, {
        headers: options.token ? { Authorization: `Bearer ${options.token}` } : {},
        signal,
      });
      if (!response.ok) throw new Error(`hex answered HTTP ${response.status}.`);
      return (await response.json()) as AgentActivity;
    },
  };
}

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
