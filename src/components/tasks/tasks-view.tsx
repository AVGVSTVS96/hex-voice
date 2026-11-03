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
  padding,
  scrollContentBackground,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { BarStyle, Empty, ios, listRow, type Bar } from '@/components/tasks/parts';
import { EntryRow, QuietRow } from '@/components/tasks/rows';
import { Detail } from '@/components/tasks/task-page';
import { Messages, ThreadPage } from '@/components/tasks/thread';
import { Trace } from '@/components/tasks/trace';
import { useAsks, useCheck } from '@/hooks/use-asks';
import { useChat } from '@/hooks/use-chat';
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
  type Tile,
} from '@/live/inbox';
import type { TaskRow } from '@/live/tasks';
import { motion, rowsKey } from '@/motion';
import type { Fold } from '@/screens/layout';
import { theme } from '@/theme';

// Where Tasks opens: on a task's own page, or on a stage's tab. Every opening brings a new one.
export type TasksAt = { task?: string; stage?: Stage };

export type TasksProps = {
  open: boolean;
  at: TasksAt;
  haptics: boolean;
  onTalk: (task: TaskRow) => void;
  onGoThrough: () => void;
  onOpenCall: (id: string) => void;
};

// The pages pushed beside or over the list: a topic's page, a thread's messages and its steps
// (from the topic's page), and what the last check did.
type Pushed = 'task' | 'thread' | 'trace' | 'check';
type Slot = Pushed | 'list';
// Where a page sits along iPhone Duo's pages, how long it is, and whether it's on screen.
type Spot = { at: number; length: number; shown: boolean };

// Wide enough for the list and a topic's page side by side, as C has it on a big iPad: Tasks on
// a 13-inch beside a call, or anywhere before one. An 11-inch keeps one wide list beside a call.
const COLUMNS = 900;
// On iPhone Duo's pages, a page shorter than this draws its bar on one line, and a list shorter
// than SHORT_LIST drops its title and keeps search at the tabs' end.
const SHORT_PAGE = 520;
const SHORT_LIST = 360;
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
// fresh. On iPhone Duo it's a place of its own (`paged`, `height` tall with `top` taken at its
// top): one page at a time folded, and open, a page each side of the `fold` showing the deepest
// two levels, list and topic, topic and thread, thread and steps, each step down sliding both
// along. Open on its side, a thread you write to takes both pages while the keyboard is up.
export function TasksView({
  open,
  at,
  width,
  height = 0,
  line,
  haptics,
  onTalk,
  onGoThrough,
  onOpenCall,
  foot,
  top = 0,
  fold,
  paged = false,
}: TasksProps & {
  width: number;
  height?: number;
  line?: number;
  foot?: number;
  top?: number;
  fold?: Fold;
  paged?: boolean;
}) {
  const { tasks, version, offline } = useTasks(open);
  const yours = useAsks(open);
  const [stage, setStage] = useState<Stage>('needs');
  const [query, setQuery] = useState<string | null>(null);
  const [path, setPath] = useState<Pushed[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [missing, setMissing] = useState<Set<Place>>(new Set());
  const [writing, setWriting] = useState(0);
  const [typing, setTyping] = useState(false);
  const task = useTask(taskId, version);
  const traced = useTask(traceId, version);
  const check = useCheck(path.includes('check') ? yours.list?.check?.at : undefined);
  const columns = !fold && width >= COLUMNS;
  // With a page beside the list, a topic's page is always up: the list and a topic, open or not.
  const beside = columns || !!fold;
  const listWidth = columns
    ? Math.round(Math.min(440, Math.max(360, width * 0.42)))
    : fold?.axis === 'row'
      ? fold.at
      : width;
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
    if (beside && open && !taskId && first) setTaskId(first);
  }, [beside, open, taskId, first]);
  const selected = beside
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
    setPath((now) => [...now.filter((slot) => slot !== 'trace'), 'trace']);
  };
  const openThread = (write = false) => {
    tick();
    setPath(['task', 'thread']);
    if (write) setWriting((times) => times + 1);
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
  // Each place a row opens from its swipe: a thread in its app, a call in Calls, or a page.
  const openTile = (tile: Tile) => {
    if (tile.kind === 'app') {
      if (tile.link) openLink(tile.link, tile.place);
      return;
    }
    tap();
    if (tile.kind === 'call') onOpenCall(tile.call);
    else void Linking.openURL(tile.url);
  };
  const chooseStage = (next: Stage) => {
    tick();
    setStage(next);
    if (beside) setTaskId(null);
  };

  const stack: Slot[] = ['list', ...path];
  if (beside && stack.length === 1) stack.push('task');
  const front = stack.at(-1)!;
  const x = (slot: Pushed | 'list') => {
    if (columns && slot === 'list') return 0;
    if (slot === front) return 0;
    const behind = slot === 'list' || path.includes(slot) || (columns && slot === 'task');
    return behind ? -pageWidth / 3 : pageWidth;
  };
  const opened = task ?? tasks?.find((row) => row.id === taskId);
  const threads = opened ? (tasks ?? []).filter((row) => row.name === opened.name) : [];
  const said = useChat(open && opened && (beside || path.includes('task')) ? opened.id : null);
  // iPhone Duo's pages: the front page on the second, the one below it on the first; the rest wait
  // a third of a page behind the first, or past the second. A thread you write to on the pages
  // stacked one over the other takes both.
  const size = fold?.axis === 'row' ? width : height;
  const alone = fold?.axis === 'column' && typing && front === 'thread';
  const spot = (slot: Slot): Spot => {
    if (!fold) return { at: 0, length: size, shown: slot === front };
    const second = { at: fold.at + fold.band, length: size - fold.at - fold.band };
    const i = stack.indexOf(slot);
    if (alone && slot === front) return { at: 0, length: size, shown: true };
    if (i === stack.length - 1) return { ...second, shown: true };
    if (i === stack.length - 2 && !alone) return { at: 0, length: fold.at, shown: true };
    if (i >= 0) return { at: -fold.at / 3, length: fold.at, shown: false };
    return { at: size, length: second.length, shown: false };
  };
  const lengthOf = (slot: Slot) => (fold ? spot(slot).length : size);
  const tall = (slot: Slot) => (fold?.axis === 'column' ? lengthOf(slot) : height);
  const bar = (slot: Slot): Bar =>
    !paged ? 'center' : tall(slot) - top < SHORT_PAGE ? 'inline' : 'large';
  // Pages that reach the foot keep clear of the home indicator; the one above the fold doesn't.
  const footOf = (slot: Slot) =>
    fold?.axis === 'column' && spot(slot).at <= 0 && !(alone && slot === front) ? 0 : foot;
  const topOf = (slot: Slot) => (fold?.axis === 'column' && spot(slot).at > 0 ? 0 : top);
  const widthOf = (slot: Slot) =>
    fold?.axis === 'row' ? lengthOf(slot) : slot === 'list' ? listWidth : pageWidth;
  const page = (slot: Slot) => {
    if (fold) {
      const { at, length, shown } = spot(slot);
      const row = fold.axis === 'row';
      return [
        padding({ top: topOf(slot) }),
        frame({ width: row ? length : width, height: row ? height : length, alignment: 'top' }),
        background(theme.sheet),
        offset(row ? { x: at } : { y: at }),
        animation(motion.page, at * 4096 + length),
        accessibilityHidden(!shown),
      ];
    }
    return [
      padding({ top }),
      frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
      background(theme.sheet),
      offset({ x: x(slot) }),
      animation(motion.page, x(slot)),
      accessibilityHidden(x(slot) !== 0),
    ];
  };
  // Back goes a level up, named on iPhone Duo for the page it goes to. Beside the list (iPad) a
  // topic's page has none, and on the Duo's open pages only the first page has one.
  const nameOf = (slot: Slot | undefined) =>
    slot === 'list'
      ? 'Tasks'
      : slot === 'task'
        ? (opened?.name ?? '')
        : slot === 'thread'
          ? ((opened?.place || opened?.name) ?? '')
          : '';
  const backFor = (slot: Slot) => {
    if (slot === 'list' || (columns && slot === 'task')) return {};
    if (fold && !(spot(slot).shown && spot(slot).at <= 0)) return {};
    return { onBack: back, back: paged ? nameOf(stack[stack.indexOf(slot) - 1]) : undefined };
  };
  const styled = (slot: Slot, children: ReactNode) => (
    <BarStyle.Provider value={bar(slot)}>{children}</BarStyle.Provider>
  );
  const actions = {
    width: listWidth,
    selected,
    answered: yours.answered,
    onOpen: openTask,
    onOpenTile: openTile,
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
  const short = paged && tall('list') - top < SHORT_LIST;
  const startSearch = () => {
    tick();
    setQuery('');
  };
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
            {short ? null : <ListHead line={line} onSearch={startSearch} />}
            <Tabs
              counts={counts}
              stage={stage}
              offline={unreachable}
              onChange={chooseStage}
              onSearch={short ? startSearch : undefined}
            />
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
          foot={footOf('list')}
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
          styled(
            'task',
            <Detail
              task={opened}
              asks={yours.shown.filter((ask) => ask.topic === opened.name)}
              answered={yours.answered}
              threads={threads}
              missing={missing}
              width={widthOf('task')}
              {...backFor('task')}
              onTrace={openTrace}
              onAnswer={answer}
              onUndo={undo}
              onTalk={() => {
                tick();
                onTalk(opened);
              }}
              onOpen={(thread) => openLink(thread.link!, placeOf(thread.app))}
              onOpenTask={openTask}
              messages={
                <Messages
                  thread={opened}
                  chat={said.chat}
                  onOpen={() => openThread()}
                  onWrite={() => openThread(true)}
                />
              }
              foot={footOf('task')}
            />,
          )
        ) : (
          <Spacer />
        )}
      </Column>
      <Column alignment="center" spacing={0} modifiers={page('thread')}>
        {opened ? (
          styled(
            'thread',
            <ThreadPage
              thread={opened}
              chat={said.chat}
              pending={said.pending}
              focus={writing}
              foot={footOf('thread')}
              {...backFor('thread')}
              onTyping={setTyping}
              onOpen={(thread) => openLink(thread.link!, placeOf(thread.app))}
              onSteps={() => openTrace(opened.id)}
              onSend={said.send}
              onRetry={said.retry}
              onStop={() => {
                tap();
                void said.stop();
              }}
              onTalk={() => {
                tick();
                onTalk(opened);
              }}
            />,
          )
        ) : (
          <Spacer />
        )}
      </Column>
      <Column alignment="center" spacing={0} modifiers={page('trace')}>
        {traced ? (
          styled(
            'trace',
            <Trace task={traced} {...backFor('trace')} onOpen={(link) => openLink(link, 't3')} />,
          )
        ) : (
          <Spacer />
        )}
      </Column>
      <Column alignment="center" spacing={0} modifiers={page('check')}>
        {styled('check', <LastCheck check={check} {...backFor('check')} />)}
      </Column>
    </>
  );

  const fill = [frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }), clipped()];
  if (fold)
    return (
      <ZStack
        alignment="topLeading"
        modifiers={[
          frame({ width, height, alignment: 'topLeading' }),
          background(theme.background),
          clipped(),
        ]}
      >
        <Column alignment="center" spacing={0} modifiers={page('list')}>
          {styled('list', list)}
        </Column>
        {pages}
      </ZStack>
    );
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
        {styled('list', list)}
      </Column>
      {pages}
    </ZStack>
  );
}
