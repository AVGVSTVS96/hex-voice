import { Column, Host, Spacer, Text } from '@expo/ui';
import { BottomSheet, Group as SheetContent, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  animation,
  background,
  foregroundStyle,
  frame,
  offset,
  padding,
  presentationBackground,
  presentationBackgroundInteraction,
  presentationDetents,
  presentationDragIndicator,
  type PresentationDetent,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

import { AskCard, FoldedAsk } from '@/components/tasks/ask-card';
import { LastCheck } from '@/components/tasks/last-check';
import { AgentRow, GroupHead, Header, INSET, Line, Scroll, ios } from '@/components/tasks/parts';
import { Detail, Steps } from '@/components/tasks/task-page';
import { CheckStrip, Filters, FreshList, GoThrough, StuckList } from '@/components/tasks/yours';
import { useAsks, useCheck } from '@/hooks/use-asks';
import { useTask, useTasks } from '@/hooks/use-tasks';
import { filterAsks, filterCounts, yoursSubtitle, type AskFilter } from '@/live/asks';
import { groupTasks, idleLine, taskTime, type TaskRow } from '@/live/tasks';
import { motion } from '@/motion';
import { theme } from '@/theme';

type Props = {
  isPresented: boolean;
  onDismiss: () => void;
  onCall: boolean;
  haptics: boolean;
  onTalk: (task: TaskRow) => void;
  onGoThrough: () => void;
};

// The pages pushed over the list: a task's own page, one agent's steps (from the task's page or
// straight from its row in the list), and what the last check did.
type Pushed = 'task' | 'activity' | 'check';

// Everything waiting on you and every hex task, in one sheet. It opens on your asks, each answered
// in place, most unblocking first, with what hex's last check did and a way to go through them on
// a call; then what's stuck, what finished since you looked, and the threads themselves: working,
// done today, the rest folded into one Idle line. Before a call it opens full height; on a call it
// opens half height so the call goes on behind it. Pages push in like the voice page in Settings,
// and each keeps what it showed while it slides back out.
export function TasksSheet({
  isPresented,
  onDismiss,
  onCall,
  haptics,
  onTalk,
  onGoThrough,
}: Props) {
  const { width } = useWindowDimensions();
  const { tasks, version, offline } = useTasks(isPresented);
  const yours = useAsks(isPresented);
  const [filter, setFilter] = useState<AskFilter>('all');
  const [path, setPath] = useState<Pushed[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [agent, setAgent] = useState<string | null>(null);
  const task = useTask(taskId, version);
  const check = useCheck(path.includes('check') ? yours.list?.check?.at : undefined);
  const [detent, setDetent] = useState<PresentationDetent>(onCall ? 'medium' : 'large');
  useEffect(() => {
    if (isPresented) setDetent(onCall ? 'medium' : 'large');
  }, [isPresented, onCall]);

  const tick = () => {
    if (ios && haptics) void Haptics.selectionAsync();
  };
  const tap = () => {
    if (ios && haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const openTask = (id: string) => {
    tick();
    setTaskId(id);
    setPath(['task']);
  };
  const openActivity = (id: string, who: string | null) => {
    tick();
    setTaskId(id);
    setAgent(who);
    setPath((now) => (now.at(-1) === 'task' ? ['task', 'activity'] : ['activity']));
  };
  const openCheck = () => {
    tick();
    setPath(['check']);
  };
  const back = () => {
    tick();
    setPath((now) => now.slice(0, -1));
  };
  const asks = yours.asks ?? [];
  // A thread that needs you shows as its asks; one whose need isn't an ask keeps its own row.
  const groups = groupTasks(
    (tasks ?? []).filter(
      (row) => row.state !== 'needs' || !asks.some((ask) => ask.task === row.id),
    ),
  );
  const working = groups.find((group) => group.key === 'working')?.tasks.length ?? 0;
  const stuck = yours.list?.stuck ?? [];
  const front = path.at(-1);
  const x = (slot: Pushed | 'list') =>
    slot === (front ?? 'list') ? 0 : slot === 'list' || path.includes(slot) ? -width / 3 : width;
  const page = (slot: Pushed | 'list') => [
    frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
    background(theme.sheet),
    offset({ x: x(slot) }),
    animation(motion.page, x(slot)),
    accessibilityHidden(x(slot) !== 0),
  ];
  const shown = task ?? tasks?.find((row) => row.id === taskId);
  const loaded = yours.list && tasks;

  return (
    <Host seedColor={theme.tint} style={{ position: 'absolute' }}>
      <BottomSheet
        isPresented={isPresented}
        onIsPresentedChange={(presented) => {
          if (!presented) onDismiss();
        }}
        onDismiss={() => setPath([])}
        testID="tasks-sheet"
      >
        <SheetContent
          modifiers={[
            presentationDragIndicator('visible'),
            presentationDetents(onCall ? ['medium', 'large'] : ['large'], {
              selection: detent,
              onSelectionChange: setDetent,
            }),
            ...(onCall
              ? [presentationBackgroundInteraction({ type: 'enabledUpThrough', detent: 'medium' })]
              : []),
            presentationBackground(theme.sheet),
          ]}
        >
          <ZStack
            alignment="top"
            modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
          >
            <Column alignment="center" spacing={6} modifiers={page('list')}>
              <Header
                title="Tasks"
                subtitle={
                  (offline || yours.offline) && !loaded
                    ? 'Can’t reach hex'
                    : loaded
                      ? yoursSubtitle(asks.length, stuck.length, working)
                      : ' '
                }
              />
              <Scroll>
                <Cards>
                  {yours.list?.check ? (
                    <CheckStrip check={yours.list.check} onPress={openCheck} />
                  ) : null}
                  {asks.length ? (
                    <GoThrough
                      onPress={() => {
                        tick();
                        onGoThrough();
                      }}
                    />
                  ) : null}
                </Cards>
                {asks.length ? (
                  <Filters
                    filter={filter}
                    counts={filterCounts(asks)}
                    onChange={(next) => {
                      tick();
                      setFilter(next);
                    }}
                  />
                ) : null}
                <Cards>
                  {yours.answered.map(({ ask, label }) => (
                    <FoldedAsk
                      key={ask.id}
                      ask={ask}
                      label={label}
                      onUndo={() => {
                        tick();
                        yours.undo(ask.id);
                      }}
                    />
                  ))}
                  {filterAsks(asks, filter).map((ask) => (
                    <AskCard
                      key={ask.id}
                      ask={ask}
                      onAnswer={(asked, option) => {
                        tap();
                        yours.answer(asked, option);
                      }}
                    />
                  ))}
                </Cards>
                <StuckList
                  stuck={stuck}
                  onAct={(item) => {
                    tap();
                    void yours.act(item.id);
                  }}
                />
                <FreshList
                  fresh={yours.list?.fresh ?? []}
                  onRead={(item) => {
                    tick();
                    void yours.read(item.id);
                  }}
                />
                {groups.map((group) => (
                  <Column key={group.key} alignment="start" spacing={0}>
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
                            onPress={() => openTask(row.id)}
                          />
                          {row.state === 'working' &&
                            row.agents.map((agent) => (
                              <AgentRow
                                key={agent.id}
                                agent={agent}
                                onPress={() => openActivity(row.id, agent.id)}
                              />
                            ))}
                        </Column>
                      ))
                    )}
                  </Column>
                ))}
              </Scroll>
            </Column>
            <Column alignment="center" spacing={0} modifiers={page('task')}>
              {shown ? (
                <Detail
                  task={shown}
                  onBack={back}
                  onActivity={(who) => openActivity(shown.id, who)}
                  onAnswer={(asked, option) => {
                    tap();
                    yours.answer(asked, option);
                  }}
                  onTalk={() => {
                    tick();
                    onTalk(shown);
                  }}
                />
              ) : (
                <Spacer />
              )}
            </Column>
            <Column alignment="center" spacing={0} modifiers={page('activity')}>
              {task ? <Steps task={task} agent={agent} onBack={back} /> : <Spacer />}
            </Column>
            <Column alignment="center" spacing={0} modifiers={page('check')}>
              <LastCheck check={check} onBack={back} />
            </Column>
          </ZStack>
        </SheetContent>
      </BottomSheet>
    </Host>
  );
}

// The asks and the strips above them sit inset as cards, a little apart.
function Cards({ children }: { children: ReactNode }) {
  return (
    <Column
      alignment="start"
      spacing={12}
      modifiers={[
        padding({ leading: 16, trailing: 16, top: 8, bottom: 8 }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      {children}
    </Column>
  );
}
