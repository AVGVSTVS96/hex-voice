import { Column, Row, Spacer, Text } from '@expo/ui';
import { ProgressView, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  animation,
  background,
  clipped,
  foregroundStyle,
  frame,
  offset,
  opacity,
  scrollDismissesKeyboard,
} from '@expo/ui/swift-ui/modifiers';
import { useMemo, useState, type ReactNode } from 'react';
import { Linking } from 'react-native';

import { PageChrome, type Chrome } from '@/components/tasks/bar';
import { LastCheck } from '@/components/tasks/last-check';
import { ListPage } from '@/components/tasks/list';
import {
  shapeOf,
  spotOf,
  usePages,
  type Level,
  type Pages,
  type Room,
  type Spot,
  Showing,
  Typing,
} from '@/components/tasks/pages';
import { feel } from '@/components/tasks/parts';
import { EntryRow } from '@/components/tasks/rows';
import { Selectable } from '@/components/tasks/said';
import { Asked, Detail } from '@/components/tasks/task-page';
import { Messages, ThreadPage } from '@/components/tasks/thread';
import { StepsLoading, Trace } from '@/components/tasks/trace';
import { useAsks, useCheck } from '@/hooks/use-asks';
import { useChat } from '@/hooks/use-chat';
import { useTask, useTasks } from '@/hooks/use-tasks';
import type { Ask, AskOption } from '@/live/asks';
import {
  inboxEntries,
  placeOf,
  taskIn,
  topicIn,
  type Place,
  type Stage,
  type Tile,
} from '@/live/inbox';
import type { TaskId, TaskRow } from '@/live/tasks';
import { motion, rowsKey } from '@/motion';
import { theme } from '@/theme';

const NAMED_BACK = 420;

// Every opening passes a new one, which restarts the pages and the list's tab.
export type TasksAt = { task?: TaskId; stage?: Stage };

export type TasksProps = {
  open: boolean;
  at: TasksAt;
  haptics: boolean;
  onTalk: (task: TaskRow) => void;
  onGoThrough: () => void;
  onOpenCall: (id: string) => void;
};

export function TasksView({
  width,
  foot = 0,
  ...view
}: TasksProps & { width: number; foot?: number }) {
  const pages = usePages({ open: view.open, at: view.at, shape: shapeOf(width, undefined) });
  return <Tasks {...view} pages={pages} room={{ width, foot, paged: false }} />;
}

export function Tasks({
  open,
  haptics,
  onTalk,
  onGoThrough,
  onOpenCall,
  at,
  pages,
  room,
}: TasksProps & { pages: Pages; room: Room }) {
  const { tasks, version, offline, current } = useTasks(open);
  const yours = useAsks(open);
  const [missing, setMissing] = useState<Set<Place>>(new Set());
  const [typing, setTyping] = useState<Level | null>(null);
  // A project with no thread to show has a page of its own, with nothing to fetch.
  const { task } = useTask(taskIn(pages.task), version);
  const traced = useTask(pages.stepsOf, version);
  const checked = useCheck(pages.path.includes('check') ? yours.list?.check?.at : undefined);
  const touch = feel(haptics);
  const { tick, tap } = touch;
  const entries = useMemo(
    () => inboxEntries(tasks ?? [], yours.list, yours.shown),
    [tasks, yours.list, yours.shown],
  );
  // An ask whose thread has left the board opens its topic's newest thread still on it, or else
  // the topic's asks alone.
  const asked = yours.shown.find((ask) => ask.task === pages.task);
  const opened =
    task ??
    tasks?.find((row) => row.id === pages.task) ??
    (asked ? newestOf((tasks ?? []).filter((row) => row.name === asked.topic)) : undefined);
  const alone = opened || asked ? undefined : topicIn(pages.task);
  const topic = opened?.name ?? asked?.topic ?? alone;
  const threads = opened ? (tasks ?? []).filter((row) => row.name === opened.name) : [];
  // The ask you tapped leads its topic's.
  const topicAsks = topic
    ? yours.shown
        .filter((ask) => ask.topic === topic)
        .sort((a, b) => Number(b.id === pages.row) - Number(a.id === pages.row))
    : [];
  const said = useChat(
    open && opened && (pages.shape !== 'one' || pages.path.includes('topic')) ? opened.id : null,
  );

  const answer = (ask: Ask, option: AskOption) => {
    tap();
    yours.answer(ask, option);
  };
  const undo = (ask: Ask) => {
    tick();
    yours.undo(ask.id);
  };
  const again = (ask: Ask) => {
    tap();
    yours.again(ask);
  };
  const dismiss = (ask: Ask) => {
    tap();
    yours.dismiss(ask);
  };
  // A link to an app that isn't installed fails without a word from iOS, so its place says so.
  const openLink = (link: string, place: Place) => {
    tap();
    Linking.openURL(link).then(
      () => missing.has(place) && setMissing(new Set([...missing].filter((one) => one !== place))),
      () => setMissing(new Set([...missing, place])),
    );
  };
  const openThread = (thread: TaskRow) => openLink(thread.link!, placeOf(thread.app));
  // Where an ask was asked, as its topic's way there when no thread of it is left to open.
  const doorOf = (ask: Ask) => {
    const where = ask.places.find((one) => one.link);
    if (!where?.link) return undefined;
    const place = placeOf(where.app);
    return { place, onPress: () => openLink(where.link!, place) };
  };
  const openTile = (tile: Tile) => {
    if (tile.kind === 'app') {
      if (tile.link) openLink(tile.link, tile.place);
      return;
    }
    tap();
    if (tile.kind === 'call') onOpenCall(tile.call);
    // A page's link is the web's, which the browser always opens.
    else void Linking.openURL(tile.url).catch(() => undefined);
  };
  const openSteps = (id: TaskId) => {
    tick();
    pages.go({ to: 'steps', id });
  };
  const write = (write: boolean) => {
    tick();
    pages.go({ to: 'thread', write });
  };
  const talk = (thread: TaskRow) => {
    tick();
    onTalk(thread);
  };

  const spot = (level: Level) => spotOf(level, pages, room);
  const names: Record<Level | 'call', string> = {
    call: 'Call',
    list: 'Tasks',
    topic: opened?.name ?? 'Topic',
    thread: (opened?.place || opened?.name) ?? 'Thread',
    steps: 'Steps',
    check: 'Last check',
  };
  // A narrow page's back is its chevron alone, as iOS shortens a back button with no room for its
  // title.
  const chromeOf = ({ back, width }: Spot): Chrome => ({
    back: back && {
      to: names[back],
      short: width < NAMED_BACK,
      onPress:
        back === 'call'
          ? pages.back
          : () => {
              tick();
              pages.back();
            },
    },
  });
  const typingOn = (level: Level) => (on: boolean) => {
    setTyping((was) => (on ? level : was === level ? null : was));
    if (on) pages.go({ to: 'composerFocused' });
  };
  // The list glides only as you move through the pages; what the page beside it shows changing
  // doesn't move it, so a stage tab's new list isn't faded in with that page.
  const moved = (level: Level) =>
    rowsKey([...pages.path, level === 'list' ? '' : (pages.task ?? ''), pages.stepsOf ?? '']);
  const page = (level: Level, children: ReactNode) => {
    const at = spot(level);
    return (
      <PageAt key={level} spot={at} paged={room.paged} moved={moved(level)}>
        <PageChrome.Provider value={chromeOf(at)}>
          <Showing.Provider value={open && at.shown}>
            <Typing.Provider value={typingOn(level)}>
              <Selectable.Provider value={typing !== level}>{children}</Selectable.Provider>
            </Typing.Provider>
          </Showing.Provider>
        </PageChrome.Provider>
      </PageAt>
    );
  };

  const list = (
    <ListPage
      open={open}
      at={at}
      pages={pages}
      spot={spot('list')}
      paged={room.paged}
      tasks={tasks}
      offline={offline}
      current={current}
      yours={yours}
      feel={touch}
      onAnswer={answer}
      onUndo={undo}
      onOpenTile={openTile}
      onGoThrough={onGoThrough}
    />
  );
  // The topic and its conversation side by side are one view: the conversation's page shows only
  // the messages and their composer, and the topic's shows everything else.
  const paired = spot('topic').shown && spot('thread').shown;
  const levels = [
    page(
      'topic',
      opened ? (
        <Detail
          task={opened}
          asks={topicAsks}
          answered={yours.answered}
          threads={threads}
          missing={missing}
          width={spot('topic').width}
          onSteps={openSteps}
          onAnswer={answer}
          onUndo={undo}
          onAgain={again}
          onDismiss={dismiss}
          onTalk={() => talk(opened)}
          onOpen={openThread}
          onOpenTask={(id) => {
            tick();
            pages.go({ to: 'topic', id });
          }}
          messages={
            !paired && said.chat && (said.chat.total || said.chat.sends) ? (
              <Messages
                key="messages"
                thread={opened}
                chat={said.chat}
                onOpen={() => write(false)}
              />
            ) : undefined
          }
          beside={paired}
          answering={typing === 'topic'}
          onWrite={!paired && said.chat?.sends ? () => write(true) : undefined}
          foot={spot('topic').foot}
        />
      ) : topic ? (
        <Asked
          topic={topic}
          asks={topicAsks}
          answered={yours.answered}
          width={spot('topic').width}
          door={asked && doorOf(asked)}
          rows={entries
            .filter((entry) => entry.topic === topic && entry.kind !== 'ask')
            .map((entry, i) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                first={i === 0}
                width={spot('topic').width}
                answered={yours.answered}
                onOpen={(id) => pages.go({ to: 'topic', id })}
                onOpenTile={openTile}
                onAnswer={answer}
                onUndo={undo}
                onDismiss={dismiss}
                onAgain={again}
                onAct={(id) => {
                  tap();
                  void yours.act(id);
                }}
                onRead={(id) => {
                  tick();
                  void yours.read(id);
                }}
              />
            ))}
          onAnswer={answer}
          onUndo={undo}
          onAgain={again}
          onDismiss={dismiss}
        />
      ) : (
        <Nothing loaded={!!tasks} />
      ),
    ),
    page(
      'thread',
      opened ? (
        <ThreadPage
          thread={opened}
          beside={paired}
          chat={said.chat}
          pending={said.pending}
          failed={said.failed}
          focus={pages.focusComposer}
          foot={spot('thread').foot}
          onOpen={openThread}
          onSteps={() => openSteps(opened.id)}
          onSend={said.send}
          onRetry={said.retry}
          onStop={() => {
            tap();
            void said.stop();
          }}
          onTalk={() => talk(opened)}
        />
      ) : (
        <Spacer />
      ),
    ),
    page(
      'steps',
      traced.task ? (
        <Trace task={traced.task} onOpen={(link) => openLink(link, 't3')} />
      ) : (
        <StepsLoading {...traced} />
      ),
    ),
    page('check', <LastCheck {...checked} />),
  ];

  // A drag down any of Tasks' scrolling content pulls the keyboard down with it, as iOS apps do.
  const fill = [
    frame({ maxWidth: Infinity, alignment: 'top' }),
    upTo(),
    clipped(),
    scrollDismissesKeyboard('interactively'),
  ];
  if (pages.shape === 'columns')
    return (
      <Row alignment="start" spacing={0} modifiers={fill}>
        <Column
          alignment="start"
          spacing={0}
          modifiers={[frame({ width: spot('list').width, alignment: 'top' }), upTo()]}
        >
          {list}
        </Column>
        <Column
          alignment="start"
          spacing={0}
          modifiers={[frame({ width: 1 }), upTo(), background(theme.edge)]}
        >
          <Spacer />
        </Column>
        <ZStack alignment="top" modifiers={fill}>
          {levels}
        </ZStack>
      </Row>
    );
  const inPanes = room.paged && room.panes !== undefined;
  return (
    <ZStack
      alignment={inPanes ? 'topLeading' : 'top'}
      modifiers={
        inPanes
          ? [
              frame({ maxWidth: Infinity, alignment: 'topLeading' }),
              upTo(Infinity, 'topLeading'),
              clipped(),
              scrollDismissesKeyboard('interactively'),
            ]
          : fill
      }
    >
      {page('list', list)}
      {levels}
    </ZStack>
  );
}

function newestOf(rows: TaskRow[]) {
  return rows.reduce<TaskRow | undefined>(
    (newest, row) => (!newest || Date.parse(row.at) > Date.parse(newest.at) ? row : newest),
    undefined,
  );
}

// The page beside the list before a project is open: hex still loading, or nothing picked yet.
function Nothing({ loaded }: { loaded: boolean }) {
  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}
    >
      {loaded ? (
        <Text textStyle={{ fontSize: 15 }} modifiers={[foregroundStyle(theme.tertiary)]}>
          Pick a project
        </Text>
      ) : (
        <ProgressView />
      )}
    </Column>
  );
}

// On iPhone Duo a page is clear, so it clips to its frame and fades as it leaves instead of
// covering the page below it.
// A page glides when you move through Tasks (`moved` changes) and lands at once when only the room
// changes, as the Duo turns, folds or opens.
function PageAt({
  spot,
  paged,
  moved,
  children,
}: {
  spot: Spot;
  paged: boolean;
  moved: number;
  children: ReactNode;
}) {
  const { frame: size, offset: at } = spot;
  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[
        size
          ? frame({ width: size.width, alignment: 'top' })
          : frame({ maxWidth: Infinity, alignment: 'top' }),
        upTo(),
        ...(paged ? [clipped(), opacity(spot.shown ? 1 : 0)] : [background(theme.sheet)]),
        offset(at),
        animation(motion.page, moved),
        accessibilityHidden(!spot.shown),
      ]}
    >
      {children}
    </Column>
  );
}

// A height is the most a page may take, never a fixed size. The keyboard shortens the Host it
// covers, and a page taller than its Host is centered in it: pushed half the keyboard up off the
// top, with its foot, where you type and send, still under the keyboard.
function upTo(height = Infinity, alignment: 'top' | 'topLeading' = 'top') {
  return frame({ minHeight: 0, maxHeight: height, alignment });
}
