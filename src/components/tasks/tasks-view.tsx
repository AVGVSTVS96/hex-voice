import { Column, Row, Spacer } from '@expo/ui';
import { List, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  animation,
  background,
  clipped,
  frame,
  listStyle,
  offset,
  scrollContentBackground,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';

import {
  CheckRow,
  GoThrough,
  ListHead,
  PicksRow,
  Search,
  Tabs,
  TopicHead,
} from '@/components/tasks/inbox';
import { LastCheck } from '@/components/tasks/last-check';
import { Empty, ios, laneWidth, listRow } from '@/components/tasks/parts';
import { EntryRow, QuietRow } from '@/components/tasks/rows';
import { Detail } from '@/components/tasks/task-page';
import { Trace } from '@/components/tasks/trace';
import { useAsks, useCheck } from '@/hooks/use-asks';
import { useTask, useTasks } from '@/hooks/use-tasks';
import type { Ask, AskOption } from '@/live/asks';
import {
  inboxEntries,
  picksOf,
  placeOf,
  search,
  stageCounts,
  taskOf,
  topicsOf,
  type Place,
  type Stage,
} from '@/live/inbox';
import type { TaskRow } from '@/live/tasks';
import { motion, rowsKey } from '@/motion';
import { theme } from '@/theme';

// Where Tasks opens: on a task's own page, or on a stage's tab. Every opening brings a new one.
export type TasksAt = { task?: string; stage?: Stage };

export type TasksProps = {
  open: boolean;
  at: TasksAt;
  haptics: boolean;
  onTalk: (task: TaskRow) => void;
  onGoThrough: () => void;
};

// The pages pushed beside or over the list: a topic's page, a thread's steps (from the topic's
// page), and what the last check did.
type Pushed = 'task' | 'trace' | 'check';

// Wide enough for the list and a topic's page side by side, as C has it on a big iPad: Tasks on
// a 13-inch beside a call, or anywhere before one. An 11-inch keeps one wide list beside a call.
const COLUMNS = 900;
const EMPTY: Record<Stage, string> = {
  needs: 'Nothing waits on you',
  working: 'Nothing is working',
  done: 'Nothing finished today',
  quiet: 'Nothing is quiet',
};

// Everything hex has going, a stage at a time: tabs for what needs you, what's working, what's done
// and what's quiet, each cut into its topics with their lanes. An ask answers in its row when its
// choices fit one line; anything else steps down to its topic's page, and a thread there down to
// its steps and thinking. The phone holds it in a sheet and iPad in a pane; each opening starts
// fresh.
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
  const [stage, setStage] = useState<Stage>('needs');
  const [query, setQuery] = useState<string | null>(null);
  const [path, setPath] = useState<Pushed[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [missing, setMissing] = useState<Set<Place>>(new Set());
  const task = useTask(taskId, version);
  const traced = useTask(traceId, version);
  const check = useCheck(path.includes('check') ? yours.list?.check?.at : undefined);
  const columns = width >= COLUMNS;
  const listWidth = columns ? Math.round(Math.min(440, Math.max(360, width * 0.42))) : width;
  const pageWidth = columns ? width - listWidth - 1 : width;

  const entries = useMemo(
    () => inboxEntries(tasks ?? [], yours.list, yours.shown),
    [tasks, yours.list, yours.shown],
  );
  const counts = stageCounts(entries, yours.answered);
  const loaded = !!(yours.list && tasks);
  useEffect(() => {
    if (!open) return;
    setTaskId(at.task ?? null);
    setPath(at.task ? ['task'] : []);
    setQuery(null);
  }, [open, at]);
  // A tab opens where it was sent, or on what needs you while anything does.
  useEffect(() => {
    if (open && loaded) setStage(at.stage ?? (counts.needs ? 'needs' : 'working'));
  }, [open, loaded, at]);

  const shown = useMemo(
    () =>
      query !== null ? search(entries, query) : entries.filter((entry) => entry.stage === stage),
    [entries, stage, query],
  );
  const topics = useMemo(() => topicsOf(shown, entries, tasks ?? []), [shown, entries, tasks]);
  const picks = picksOf(entries, yours.answered);

  // With room for both, a topic's page is always up beside the list: the first one there is,
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
  const openTrace = (id: string) => {
    tick();
    setTraceId(id);
    setPath(['task', 'trace']);
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
  // A link to an app that isn't installed fails without a word from iOS, so its place says so.
  const openLink = (link: string, place: Place) => {
    tap();
    Linking.openURL(link).then(
      () => missing.has(place) && setMissing(new Set([...missing].filter((one) => one !== place))),
      () => setMissing(new Set([...missing, place])),
    );
  };
  const chooseStage = (next: Stage) => {
    tick();
    setStage(next);
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
  const actions = {
    width: listWidth,
    selected,
    answered: yours.answered,
    onOpen: openTask,
    onOpenLink: openLink,
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
  const unreachable = (offline || yours.offline) && !loaded;
  const goThrough = query === null && stage === 'needs' && yours.open.length > 0;

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
          <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
            <ListHead
              line={line}
              onSearch={() => {
                tick();
                setQuery('');
              }}
            />
            <Tabs counts={counts} stage={stage} offline={unreachable} onChange={chooseStage} />
          </Column>
        )}
        <List
          modifiers={[
            listStyle('plain'),
            scrollContentBackground('hidden'),
            background(theme.sheet),
            frame({ maxWidth: Infinity, maxHeight: Infinity }),
            animation(
              motion.list,
              rowsKey(shown.map((entry) => `${entry.id}:${yours.answered[entry.id] ?? ''}`)),
            ),
          ]}
        >
          {query === null && stage === 'needs' && picks.length > 1 ? (
            <PicksRow picks={picks} width={listWidth} onTake={takePicks} />
          ) : null}
          {topics.flatMap((topic) => {
            if (query === null && stage === 'quiet')
              return [
                <QuietRow key={topic.name} topic={topic} width={listWidth} onOpen={openTask} />,
              ];
            const lead = topic.entries.map(taskOf).find(Boolean);
            return [
              <TopicHead
                key={`${topic.name}:head`}
                topic={topic}
                width={listWidth}
                onPress={lead ? () => openTask(lead) : undefined}
              />,
              ...topic.entries.map((entry, i) => (
                <EntryRow key={entry.id} entry={entry} first={i === 0} {...actions} />
              )),
            ];
          })}
          {query === null && stage === 'needs' && yours.list?.check ? (
            <CheckRow check={yours.list.check} width={listWidth} onPress={openCheck} />
          ) : null}
          {loaded && !topics.length ? (
            <Empty text={query ? 'Nothing matches' : EMPTY[stage]} width={listWidth} />
          ) : null}
          {unreachable ? <Empty text="Can’t reach hex" width={listWidth} /> : null}
          {goThrough ? (
            <Spacer
              modifiers={[
                frame({ height: 72 }),
                ...listRow(listWidth, { top: false, bottom: false }),
              ]}
            />
          ) : null}
        </List>
      </Column>
      {goThrough ? (
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
            asks={yours.shown.filter((ask) => ask.topic === opened.name)}
            answered={yours.answered}
            threads={threads}
            missing={missing}
            lane={laneWidth(pageWidth)}
            onBack={columns ? undefined : back}
            onTrace={openTrace}
            onAnswer={answer}
            onUndo={undo}
            onTalk={() => {
              tick();
              onTalk(opened);
            }}
            onOpen={(thread) => openLink(thread.link!, placeOf(thread.app))}
            onOpenTask={openTask}
            foot={foot}
          />
        ) : (
          <Spacer />
        )}
      </Column>
      <Column alignment="center" spacing={0} modifiers={page('trace')}>
        {traced ? <Trace task={traced} onBack={back} /> : <Spacer />}
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
