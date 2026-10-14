import { Column, Text } from '@expo/ui';
import { animation, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';

import { AgentRow, GroupHead, INSET, Line } from '@/components/tasks/parts';
import { idleLine, taskTime, type TaskGroup, type TaskRow } from '@/live/tasks';
import { motion, rowsKey } from '@/motion';
import { theme } from '@/theme';

// One group of hex's threads under its heading. A working thread shows its agents under it, each
// opening its own steps; Idle folds to one line of names.
export function ThreadGroup({
  group,
  onOpen,
  onAgent,
}: {
  group: TaskGroup;
  onOpen: (task: TaskRow) => void;
  onAgent: (task: TaskRow, agent: string) => void;
}) {
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[
        animation(
          motion.list,
          rowsKey(group.tasks.map((row) => `${row.id}:${row.state}:${row.agents.length}`)),
        ),
      ]}
    >
      <GroupHead title={group.title} count={group.tasks.length} />
      {group.key === 'idle' ? (
        <Text
          textStyle={{ fontSize: 15, lineHeight: 20 }}
          modifiers={[
            foregroundStyle(theme.tertiary),
            padding({ leading: INSET, trailing: INSET, top: 6, bottom: 14 }),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        >
          {idleLine(group.tasks)}
        </Text>
      ) : (
        group.tasks.map((row) => (
          <Column key={row.id} alignment="start" spacing={0}>
            <Line
              state={row.state}
              title={row.name}
              where={row.where}
              time={taskTime(row)}
              text={row.line}
              onPress={() => onOpen(row)}
            />
            {row.state === 'working' &&
              row.agents.map((agent) => (
                <AgentRow key={agent.id} agent={agent} onPress={() => onAgent(row, agent.id)} />
              ))}
          </Column>
        ))
      )}
    </Column>
  );
}
