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
  scrollDismissesKeyboard,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Linking } from 'react-native';

import { TASKS } from '@/call/stage';
import { PageChrome, type Back, type Chrome } from '@/components/tasks/bar';
import { LastCheck } from '@/components/tasks/last-check';
import { ListPage } from '@/components/tasks/list';
import {
  levelsOf,
  shapeOf,
  spotOf,
  usePages,
  type Level,
  type Move,
  type Pages,
  type Room,
  type Spot,
  type Stack,
  Showing,
  Typing,
} from '@/components/tasks/pages';
import { feel } from '@/components/tasks/parts';
import { useToolbarBack } from '@/components/toolbar-back';
import { EntryRow } from '@/components/tasks/rows';
import { Selectable } from '@/components/tasks/said';
import { Asked, Detail, DonePage } from '@/components/tasks/task-page';
import { Messages, ThreadPage } from '@/components/tasks/thread';
import { StepsLoading, Trace } from '@/components/tasks/trace';
import { useAsks, useCheck } from '@/hooks/use-asks';
import { useChat } from '@/hooks/use-chat';
import { useTask, useTasks, type Counts } from '@/hooks/use-tasks';
import type { Ask, AskOption } from '@/live/asks';
import {
  inboxEntries,
  openingStage,
  pageOf,
  placeOf,
  doneIn,
  stageCounts,
  stageTopics,
  taskIn,
  topicIn,
  type Place,
  type Tile,
} from '@/live/inbox';
import type { TaskId, TaskRow } from '@/live/tasks';
import { motion, rowsKey } from '@/motion';
import { theme } from '@/theme';

import { PagesView } from '../../../modules/pages';

export type TasksProps = {
  open: boolean;
  // Where you are in Tasks, which the call screen keeps whichever container shows it.
  stack: Stack;
  onMove: (move: Move) => void;
  haptics: boolean;
  onTalk: (task: TaskRow) => void;
  onGoThrough: () => void;
  onOpenCall: (id: string) => void;
  // What the list's tabs count, while it shows them up to date.
  onCounts: (counts: Counts | undefined) => void;
};

export function TasksView({
  width,
  foot = 0,
  ...view
}: TasksProps & { width: number; foot?: number }) {
  const room = { width, foot, paged: false };
  const pages = usePages({ stack: view.stack, onMove: view.onMove, shape: shapeOf(room) });
  return <Tasks {...view} pages={pages} room={room} />;
}

export function Tasks({
  open,
  haptics,
  onTalk,
  onGoThrough,
  onOpenCall,
  onCounts,
  pages,
  room,
}: TasksProps & { pages: Pages; room: Room }) {
  const { tasks, finished, version, offline, current } = useTasks(open);
  const yours = useAsks(open);
  const [missing, setMissing] = useState<Set<Place>>(new Set());
  const [typing, setTyping] = useState<Level | null>(null);
  const traced = useTask(pages.stepsOf, version);
  const checked = useCheck(pages.path.includes('check') ? yours.list?.check?.at : undefined);
  const touch = feel(haptics);
  const { tick, tap } = touch;
  const entries = useMemo(
    () => inboxEntries(tasks ?? [], finished, yours.list, yours.shown),
    [tasks, finished, yours.list, yours.shown],
  );
  // Opening starts on the tab it's sent to, else Needs you while anything waits, kept once the list
  // has loaded so it stays put as the counts change.
  const loaded = !!(yours.list && tasks);
  const stage =
    pages.stage ?? (loaded ? openingStage(stageCounts(entries, yours.answered)) : 'needs');
  useEffect(() => {
    if (open && loaded && !pages.stage) pages.go({ to: 'stage', stage });
  }, [open, loaded, pages.stage, stage]);
  // Beside the list, before the list has picked, the page is the first project of its tab, so the
  // pane is never blank while it picks.
  const [leading] = pages.shape !== 'one' && !pages.task ? stageTopics(entries, stage) : [];
  const showing = pages.task ?? (leading ? pageOf(leading) : null);
  // A project with no thread to show has a page of its own, with nothing to fetch.
  const { task } = useTask(taskIn(showing), version);
  // An ask whose thread has left the board opens its topic's newest thread still on it, or else
  // the topic's asks alone.
  const asked = yours.shown.find((ask) => ask.task === showing);
  const opened =
    task ??
    tasks?.find((row) => row.id === showing) ??
    (asked ? newestOf((tasks ?? []).filter((row) => row.name === asked.topic)) : undefined);
  const alone = opened || asked ? undefined : topicIn(showing);
  const did = finished.find((one) => one.id === doneIn(showing));
  const topic = opened?.name ?? asked?.topic ?? alone;
  const threads = opened ? (tasks ?? []).filter((row) => row.name === opened.name) : [];
  // The ask you tapped leads its topic's.
  const topicAsks = topic
    ? yours.shown
        .filter((ask) => ask.topic === topic)
        .sort((a, b) => Number(b.id === pages.row) - Number(a.id === pages.row))
    : [];
  const said = useChat(opened ? opened.id : null, open);

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
  const backTo = (back: Level | 'call'): Back => ({
    to: names[back],
    onPress:
      back === 'call'
        ? pages.back
        : () => {
            tick();
            pages.back();
          },
  });
  // On iPhone Duo the shown page's way back goes to the toolbar, and no page heads itself with one.
  const shownBack = pages.levels.map(spot).find((at) => at.shown && at.back)?.back;
  const inToolbar = useToolbarBack(
    'tasks',
    open && shownBack ? backTo(shownBack) : undefined,
    room.paged,
  );
  const chromeOf = ({ back }: Spot): Chrome => ({
    back: back && !inToolbar ? backTo(back) : undefined,
  });
  const typingOn = (level: Level) => (on: boolean) => {
    setTyping((was) => (on ? level : was === level ? null : was));
    if (on) pages.go({ to: 'composerFocused' });
  };
  // Pages glide only when you move through Tasks. Another project or tab beside the list moves
  // nothing, so it lands at once: an animation there would fade each changed word through the last.
  // Nor does one page or two: the project beside the list comes and goes with the width, and lands
  // with the turn that changed it.
  const moved = rowsKey([...pages.path, pages.stepsOf ?? '']);
  const page = (level: Level, children: ReactNode) => {
    const at = spot(level);
    return (
      <PageAt key={level} spot={at} paged={room.paged} moved={moved}>
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
      stage={stage}
      pages={pages}
      spot={spot('list')}
      tasks={tasks}
      entries={entries}
      offline={offline}
      current={current}
      yours={yours}
      feel={touch}
      onAnswer={answer}
      onUndo={undo}
      onOpenTile={openTile}
      onGoThrough={onGoThrough}
      onCounts={onCounts}
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
          onWrite={!paired && said.sends ? () => write(true) : undefined}
          foot={spot('topic').foot}
        />
      ) : did ? (
        <DonePage
          finished={did}
          door={
            did.link
              ? { place: placeOf(did.app), onPress: () => openLink(did.link!, placeOf(did.app)) }
              : undefined
          }
          onOpenLink={openTile}
          onOpenProject={
            did.run && tasks?.some((row) => row.id === did.run)
              ? () => {
                  tick();
                  pages.go({ to: 'topic', id: did.run! });
                }
              : undefined
          }
        />
      ) : topic ? (
        <Asked
          topic={topic}
          asks={topicAsks}
          answered={yours.answered}
          door={asked && doorOf(asked)}
          rows={entries
            .filter((entry) => entry.topic === topic && entry.kind !== 'ask')
            .map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
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

  // Any drag of Tasks' scrolling content lets the keyboard go, as the call's words do: interactive
  // dismissal would wait for the finger to reach the keyboard.
  const fill = [
    frame({ maxWidth: Infinity, alignment: 'top' }),
    upTo(),
    clipped(),
    scrollDismissesKeyboard('immediately'),
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
  // On iPhone Duo SwiftUI picks one page or two from the width it has, places them, and says which
  // it picked. Each page is keyed by its level, which is how SwiftUI knows which child is which.
  if (room.paged) {
    const children = [page('list', list), ...levels];
    return (
      <PagesView
        pages={children.map((child) => child.key as Level)}
        one={levelsOf(pages, 'one')}
        two={levelsOf(pages, 'panes')}
        page={TASKS}
        meet={room.meet ?? 0}
        onPaired={pages.placed}
        modifiers={[...fill, animation(motion.page, moved)]}
      >
        {children}
      </PagesView>
    );
  }
  return (
    <ZStack alignment="top" modifiers={fill}>
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

// A page glides when you move through Tasks (`moved` changes) and lands at once when only the room
// changes. On iPhone Duo `PagesView` places it, and here it only fills the spot it's given.
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
  const fills = [frame({ maxWidth: Infinity, alignment: 'top' }), upTo()];
  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={
        paged
          ? fills
          : [
              ...fills,
              background(theme.sheet),
              offset(spot.offset),
              animation(motion.page, moved),
              accessibilityHidden(!spot.shown),
            ]
      }
    >
      {children}
    </Column>
  );
}

// A height is the most a page may take, never a fixed size. The keyboard shortens the Host it
// covers, and a page taller than its Host is centered in it: pushed half the keyboard up off the
// top, with its foot, where you type and send, still under the keyboard.
function upTo() {
  return frame({ minHeight: 0, maxHeight: Infinity, alignment: 'top' });
}
