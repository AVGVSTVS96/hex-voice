import { Column, Spacer } from '@expo/ui';
import { ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  animation,
  background,
  clipped,
  frame,
  offset,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';

import { LastCheck } from '@/components/tasks/last-check';
import { Empty, Header, ios } from '@/components/tasks/parts';
import { TabBar, TabPane } from '@/components/tasks/tabs';
import { Detail, Steps } from '@/components/tasks/task-page';
import { ThreadGroup } from '@/components/tasks/threads';
import {
  AskList,
  CheckStrip,
  Filters,
  FreshList,
  GoThrough,
  StuckList,
} from '@/components/tasks/yours';
import { useAsks, useCheck } from '@/hooks/use-asks';
import { useTask, useTasks } from '@/hooks/use-tasks';
import { filterAsks, filterCounts, type Ask, type AskFilter, type AskOption } from '@/live/asks';
import { firstTab, tabCounts, type Tab } from '@/live/tabs';
import { groupTasks, type TaskGroup, type TaskRow } from '@/live/tasks';
import { motion } from '@/motion';
import { theme } from '@/theme';

// Where Tasks opens: on a task's own page, or on a tab. Every opening brings a new one.
export type TasksAt = { task?: string; tab?: Tab };

export type TasksProps = {
  open: boolean;
  at: TasksAt;
  haptics: boolean;
  onTalk: (task: TaskRow) => void;
  onGoThrough: () => void;
};

// The pages pushed over the list: a task's own page, one agent's steps (from the task's page or
// straight from its row in the list), and what the last check did.
type Pushed = 'task' | 'activity' | 'check';

// Everything waiting on you and every hex task, in three tabs. Yours: your asks, each answered in
// place, most unblocking first, with what hex's last check did, a way to go through them on a
// call, and what's stuck. Working: the threads at work, each with its agents. Done: what finished
// since you looked, what finished today, the rest folded into one Idle line. Pages push in like
// the voice page in Settings, and each keeps what it showed while it slides back out. The phone
// holds it in a sheet and iPad in a pane of its own; each opening starts fresh at `at`.
export function TasksView({
  open,
  at,
  width,
  haptics,
  onTalk,
  onGoThrough,
}: TasksProps & { width: number }) {
  const { tasks, version, offline } = useTasks(open);
  const yours = useAsks(open);
  const [filter, setFilter] = useState<AskFilter>('all');
  const [chosen, setChosen] = useState<Tab | null>(null);
  const [path, setPath] = useState<Pushed[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [agent, setAgent] = useState<string | null>(null);
  const task = useTask(taskId, version);
  const check = useCheck(path.includes('check') ? yours.list?.check?.at : undefined);

  useEffect(() => {
    if (!open) return;
    if (at.task) setTaskId(at.task);
    setPath(at.task ? ['task'] : []);
    setChosen(at.tab ?? null);
    setFilter('all');
  }, [open, at]);

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
  const asks = yours.open;
  // A thread that needs you shows as its asks; one whose need isn't an ask keeps its own row.
  const groups = groupTasks(
    (tasks ?? []).filter(
      (row) => row.state !== 'needs' || !yours.shown.some((ask) => ask.task === row.id),
    ),
  );
  const group = (key: TaskGroup['key']) => groups.find((one) => one.key === key);
  const stuck = yours.list?.stuck ?? [];
  const fresh = yours.list?.fresh ?? [];
  const counts = tabCounts(asks.length, stuck.length, groups, fresh);
  const loaded = yours.list && tasks;
  useEffect(() => {
    if (open && loaded && !chosen) setChosen(firstTab(counts));
  }, [open, loaded, chosen]);
  const tab = chosen ?? 'yours';
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
  const answer = (ask: Ask, option: AskOption) => {
    tap();
    yours.answer(ask, option);
  };
  const undo = (ask: Ask) => {
    tick();
    yours.undo(ask.id);
  };
  const threads = (key: TaskGroup['key']) => {
    const found = group(key);
    return found ? (
      <ThreadGroup
        group={found}
        onOpen={(row) => openTask(row.id)}
        onAgent={(row, who) => openActivity(row.id, who)}
      />
    ) : null;
  };

  return (
    <ZStack
      alignment="top"
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }), clipped()]}
    >
      <Column alignment="center" spacing={6} modifiers={page('list')}>
        <Header
          title="Tasks"
          subtitle={(offline || yours.offline) && !loaded ? 'Can’t reach hex' : ''}
        />
        <TabBar
          tab={tab}
          counts={counts}
          onChange={(next) => {
            tick();
            setChosen(next);
          }}
        />
        <ZStack
          alignment="top"
          modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
        >
          <TabPane shown={tab === 'yours'}>
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
                counts={filterCounts(asks, stuck.length, group('needs')?.tasks.length)}
                onChange={(next) => {
                  tick();
                  setFilter(next);
                }}
              />
            ) : null}
            <AskList
              asks={filterAsks(yours.shown, filter)}
              answered={yours.answered}
              onAnswer={answer}
              onUndo={undo}
              onOpenTask={openTask}
            />
            {filter === 'all' || filter === 'stuck' ? (
              <StuckList
                stuck={stuck}
                onAct={(item) => {
                  tap();
                  void yours.act(item.id);
                }}
              />
            ) : null}
            {filter === 'all' ? threads('needs') : null}
            {loaded && !counts.yours && !yours.shown.length ? (
              <Empty text="Nothing waits on you" />
            ) : null}
          </TabPane>
          <TabPane shown={tab === 'working'}>
            {threads('working')}
            {loaded && !counts.working ? <Empty text="Nothing running" /> : null}
          </TabPane>
          <TabPane shown={tab === 'done'}>
            <FreshList
              fresh={fresh}
              onRead={(item) => {
                tick();
                void yours.read(item.id);
              }}
            />
            {threads('done')}
            {threads('idle')}
            {loaded && !fresh.length && !group('done') && !group('idle') ? (
              <Empty text="Nothing finished yet" />
            ) : null}
          </TabPane>
        </ZStack>
      </Column>
      <Column alignment="center" spacing={0} modifiers={page('task')}>
        {shown ? (
          <Detail
            task={shown}
            asks={yours.shown.filter((ask) => ask.task === shown.id)}
            answered={yours.answered}
            onBack={back}
            onActivity={(who) => openActivity(shown.id, who)}
            onAnswer={answer}
            onUndo={undo}
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
