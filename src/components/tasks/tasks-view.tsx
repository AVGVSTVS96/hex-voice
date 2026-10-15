import { Column, Row, Spacer } from '@expo/ui';
import { ZStack, useNativeState } from '@expo/ui/swift-ui';
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
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Linking } from 'react-native';

import {
  CheckStrip,
  Chips,
  GoThrough,
  GroupBlock,
  GroupBy,
  ListHead,
  PicksStrip,
  Search,
} from '@/components/tasks/inbox';
import { LastCheck } from '@/components/tasks/last-check';
import { Empty, Scroll, ios } from '@/components/tasks/parts';
import { Detail, Steps } from '@/components/tasks/task-page';
import { useAsks, useCheck } from '@/hooks/use-asks';
import { useTask, useTasks } from '@/hooks/use-tasks';
import type { Ask, AskOption } from '@/live/asks';
import {
  countsLine,
  groupEntries,
  inboxEntries,
  picksOf,
  placeOf,
  search,
  stageCounts,
  taskOf,
  topicLine,
  topicsOf,
  type Grouping,
  type Place,
  type Stage,
} from '@/live/inbox';
import type { TaskRow } from '@/live/tasks';
import { motion } from '@/motion';
import { theme } from '@/theme';

// Where Tasks opens: on a task's own page, or on the stream scrolled to a stage. Every opening
// brings a new one.
export type TasksAt = { task?: string; stage?: Stage };

export type TasksProps = {
  open: boolean;
  at: TasksAt;
  haptics: boolean;
  onTalk: (task: TaskRow) => void;
  onGoThrough: () => void;
};

// The pages pushed beside or over the list: a task's own page, one agent's steps (from the task's
// page), and what the last check did.
type Pushed = 'task' | 'activity' | 'check';

// Wide enough for the list and a task's page side by side, like Mail.
const COLUMNS = 760;

// Everything hex has going, as one inbox: what needs you, answered right in its row, then what's
// working, what finished today, and the rest folded quiet. Group it by state, topic or app; a
// topic chip narrows it to that topic in every app it lives in; search finds anything. A row
// opens its task's page, which pushes in over the list, or fills the column beside it when
// there's room. The phone holds it in a sheet and iPad in a pane; each opening starts fresh.
export function TasksView({
  open,
  at,
  width,
  line,
  haptics,
  onTalk,
  onGoThrough,
  foot,
}: TasksProps & { width: number; line?: number; foot?: number }) {
  const { tasks, version, offline } = useTasks(open);
  const yours = useAsks(open);
  const [by, setBy] = useState<Grouping>('state');
  const [topic, setTopic] = useState<string | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [path, setPath] = useState<Pushed[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [agent, setAgent] = useState<string | null>(null);
  const [missing, setMissing] = useState<Set<Place>>(new Set());
  const task = useTask(taskId, version);
  const scrollTo = useNativeState<string | null>(null);
  const check = useCheck(path.includes('check') ? yours.list?.check?.at : undefined);
  const columns = width >= COLUMNS;
  const listWidth = columns ? Math.round(Math.min(440, Math.max(360, width * 0.38))) : width;
  const pageWidth = columns ? width - listWidth : width;

  useEffect(() => {
    if (!open) return;
    setTaskId(at.task ?? null);
    setPath(at.task ? ['task'] : []);
    setTopic(null);
    setQuery(null);
  }, [open, at]);

  const entries = useMemo(
    () => inboxEntries(tasks ?? [], yours.list, yours.shown),
    [tasks, yours.list, yours.shown],
  );
  const topics = useMemo(() => topicsOf(entries), [entries]);
  const shown = useMemo(() => {
    if (query !== null) return search(entries, query);
    return topic ? entries.filter((entry) => entry.topic === topic) : entries;
  }, [entries, topic, query]);
  const grouping = topic || query ? 'state' : by;
  const groups = useMemo(() => groupEntries(shown, grouping), [shown, grouping]);
  const counts = stageCounts(entries, yours.answered);
  const picks = picksOf(entries, yours.answered);
  const loaded = !!(yours.list && tasks);
  useEffect(() => {
    if (open && loaded && at.stage) scrollTo.set(at.stage);
  }, [open, loaded, at, scrollTo]);

  // With room for both, a task's page is always up beside the list: the first one there is,
  // until you open another. Its row is the one you tapped, or its first.
  const first = shown.map(taskOf).find((id) => id && tasks?.some((row) => row.id === id));
  useEffect(() => {
    if (columns && open && !taskId && first) setTaskId(first);
  }, [columns, open, taskId, first]);
  const selected = columns
    ? ((
        shown.find((entry) => entry.id === picked && taskOf(entry) === taskId) ??
        shown.find((entry) => taskOf(entry) === taskId)
      )?.id ?? null)
    : null;

  const tick = () => {
    if (ios && haptics) void Haptics.selectionAsync();
  };
  const tap = () => {
    if (ios && haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const openTask = (id: string, entry?: string) => {
    tick();
    setTaskId(id);
    setPicked(entry ?? null);
    setPath(['task']);
  };
  const openActivity = (id: string, who: string | null) => {
    tick();
    setTaskId(id);
    setAgent(who);
    setPath(['task', 'activity']);
  };
  const openCheck = () => {
    tick();
    setPath(['check']);
  };
  const back = () => {
    tick();
    setPath((now) => now.slice(0, -1));
  };
  const answer = (ask: Ask, option: AskOption) => {
    tap();
    yours.answer(ask, option);
  };
  const undo = (ask: Ask) => {
    tick();
    yours.undo(ask.id);
  };
  const takePicks = () => {
    tap();
    for (const { ask, option } of picks) yours.answer(ask, option);
  };
  // A link to an app that isn't installed fails without a word from iOS, so the place says so.
  const openPlace = (thread: TaskRow) => {
    tap();
    const place = placeOf(thread.app);
    Linking.openURL(thread.link!).then(
      () => missing.has(place) && setMissing(new Set([...missing].filter((one) => one !== place))),
      () => setMissing(new Set([...missing, place])),
    );
  };
  const chooseTopic = (next: string | null) => {
    tick();
    setTopic(next);
    if (columns) setTaskId(null);
  };

  const front = path.at(-1) ?? (columns ? 'task' : 'list');
  const x = (slot: Pushed | 'list') => {
    if (columns && slot === 'list') return 0;
    if (slot === front) return 0;
    const behind = slot === 'list' || path.includes(slot) || (columns && slot === 'task');
    return behind ? -pageWidth / 3 : pageWidth;
  };
  const page = (slot: Pushed | 'list') => [
    frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
    background(theme.sheet),
    offset({ x: x(slot) }),
    animation(motion.page, x(slot)),
    accessibilityHidden(x(slot) !== 0),
  ];
  const opened = task ?? tasks?.find((row) => row.id === taskId);
  const threads = opened ? (tasks ?? []).filter((row) => row.name === opened.name) : [];
  const chosen = topic ? topics.find((one) => one.name === topic) : undefined;
  const actions = {
    selected,
    answered: yours.answered,
    onOpen: openTask,
    onAnswer: answer,
    onUndo: undo,
    onAct: (id: string) => {
      tap();
      void yours.act(id);
    },
    onRead: (id: string) => {
      tick();
      void yours.read(id);
    },
  };

  const list = (
    <ZStack alignment="bottom" modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
      <Column
        alignment="start"
        spacing={0}
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
      >
        {query !== null ? (
          <Search
            query={query}
            onChange={setQuery}
            onCancel={() => {
              tick();
              setQuery(null);
            }}
          />
        ) : (
          <ListHead
            title={chosen ? chosen.name : 'Tasks'}
            subtitle={
              chosen
                ? topicLine(chosen)
                : (offline || yours.offline) && !loaded
                  ? 'Can’t reach hex'
                  : countsLine(counts)
            }
            marks={chosen?.marks}
            line={line}
            onSearch={() => {
              tick();
              setTopic(null);
              setQuery('');
            }}
          />
        )}
        {query === null && !topic ? (
          <GroupBy
            by={by}
            onChange={(next) => {
              tick();
              setBy(next);
            }}
          />
        ) : null}
        {query === null ? (
          <Chips total={entries.length} topics={topics} topic={topic} onChange={chooseTopic} />
        ) : null}
        <Scroll target={scrollTo}>
          {query === null && !topic && (yours.list?.check || picks.length > 1) ? (
            <Strips>
              {yours.list?.check ? (
                <CheckStrip check={yours.list.check} onPress={openCheck} />
              ) : null}
              {picks.length > 1 ? <PicksStrip picks={picks} onTake={takePicks} /> : null}
            </Strips>
          ) : null}
          {groups.map((group) => (
            <GroupBlock
              key={`${grouping}:${topic ?? ''}:${group.key}`}
              group={group}
              by={grouping}
              open={!!topic || !!query}
              onTopic={chooseTopic}
              {...actions}
            />
          ))}
          {loaded && !groups.length ? (
            <Empty text={query ? 'Nothing matches' : 'Nothing waits on you'} />
          ) : null}
          {counts.needs ? <Spacer style={{ height: 72 }} /> : null}
        </Scroll>
      </Column>
      {counts.needs && yours.open.length ? (
        <GoThrough
          count={yours.open.length}
          foot={foot}
          onPress={() => {
            tick();
            onGoThrough();
          }}
        />
      ) : null}
    </ZStack>
  );

  const pages = (
    <>
      <Column alignment="center" spacing={0} modifiers={page('task')}>
        {opened ? (
          <Detail
            task={opened}
            asks={yours.shown.filter((ask) => ask.task === opened.id)}
            answered={yours.answered}
            topic={topics.find((one) => one.name === opened.name)}
            threads={threads}
            missing={missing}
            onBack={columns ? undefined : back}
            onActivity={(who) => openActivity(opened.id, who)}
            onAnswer={answer}
            onUndo={undo}
            onTalk={() => {
              tick();
              onTalk(opened);
            }}
            onOpen={openPlace}
            onOpenTask={openTask}
            foot={foot}
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
    </>
  );

  const fill = [frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }), clipped()];
  if (columns)
    return (
      <Row alignment="start" spacing={0} modifiers={fill}>
        <Column
          alignment="start"
          spacing={0}
          modifiers={[
            frame({ width: listWidth }),
            frame({ maxHeight: Infinity, alignment: 'top' }),
          ]}
        >
          {list}
        </Column>
        <Column
          alignment="start"
          spacing={0}
          modifiers={[frame({ width: 1 }), frame({ maxHeight: Infinity }), background(theme.edge)]}
        >
          <Spacer />
        </Column>
        <ZStack alignment="top" modifiers={fill}>
          {pages}
        </ZStack>
      </Row>
    );
  return (
    <ZStack alignment="top" modifiers={fill}>
      <Column alignment="center" spacing={0} modifiers={page('list')}>
        {list}
      </Column>
      {pages}
    </ZStack>
  );
}

// The strips over the stream sit inset as cards, a little apart.
function Strips({ children }: { children: ReactNode }) {
  return (
    <Column
      alignment="start"
      spacing={10}
      modifiers={[
        padding({ leading: 16, trailing: 16, top: 12, bottom: 2 }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      {children}
    </Column>
  );
}
