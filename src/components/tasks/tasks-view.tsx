import { Column, Row, Spacer } from '@expo/ui';
import { ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  animation,
  background,
  clipped,
  frame,
  offset,
  opacity,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { useState, type ReactNode } from 'react';
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
} from '@/components/tasks/pages';
import { feel } from '@/components/tasks/parts';
import { Detail } from '@/components/tasks/task-page';
import { Messages, ThreadPage } from '@/components/tasks/thread';
import { Trace } from '@/components/tasks/trace';
import { useAsks, useCheck } from '@/hooks/use-asks';
import { useChat } from '@/hooks/use-chat';
import { useTask, useTasks } from '@/hooks/use-tasks';
import type { Ask, AskOption } from '@/live/asks';
import { placeOf, type Place, type Stage, type Tile } from '@/live/inbox';
import type { TaskRow } from '@/live/tasks';
import { motion } from '@/motion';
import type { Fold } from '@/screens/layout';
import { theme } from '@/theme';

// Every opening passes a new one, which restarts the pages and the list's tab.
export type TasksAt = { task?: string; stage?: Stage };

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
  toolbarLine,
  foot = 0,
  ...view
}: TasksProps & { width: number; toolbarLine?: number; foot?: number }) {
  const pages = usePages({ open: view.open, at: view.at, shape: shapeOf(width, undefined) });
  return (
    <Tasks {...view} pages={pages} toolbarLine={toolbarLine} room={{ width, foot, paged: false }} />
  );
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
  toolbarLine,
}: TasksProps & { pages: Pages; room: Room; toolbarLine?: number }) {
  const { tasks, version, offline } = useTasks(open);
  const yours = useAsks(open);
  const [missing, setMissing] = useState<Set<Place>>(new Set());
  const [typing, setTyping] = useState(false);
  const task = useTask(pages.task, version);
  const traced = useTask(pages.stepsOf, version);
  const check = useCheck(pages.path.includes('check') ? yours.list?.check?.at : undefined);
  const touch = feel(haptics);
  const { tick, tap } = touch;
  const opened = task ?? tasks?.find((row) => row.id === pages.task);
  const threads = opened ? (tasks ?? []).filter((row) => row.name === opened.name) : [];
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
  // A link to an app that isn't installed fails without a word from iOS, so its place says so.
  const openLink = (link: string, place: Place) => {
    tap();
    Linking.openURL(link).then(
      () => missing.has(place) && setMissing(new Set([...missing].filter((one) => one !== place))),
      () => setMissing(new Set([...missing, place])),
    );
  };
  const openThread = (thread: TaskRow) => openLink(thread.link!, placeOf(thread.app));
  const openTile = (tile: Tile) => {
    if (tile.kind === 'app') {
      if (tile.link) openLink(tile.link, tile.place);
      return;
    }
    tap();
    if (tile.kind === 'call') onOpenCall(tile.call);
    else void Linking.openURL(tile.url);
  };
  const openSteps = (id: string) => {
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

  const spot = (level: Level) => spotOf(level, pages, room, typing);
  const names: Record<Level | 'call', string> = {
    call: 'Call',
    list: 'Tasks',
    topic: opened?.name ?? 'Topic',
    thread: (opened?.place || opened?.name) ?? 'Thread',
    steps: 'Steps',
    check: 'Last check',
  };
  const chromeOf = ({ bar, back }: Spot): Chrome => ({
    bar,
    back: back && {
      to: room.paged ? names[back] : undefined,
      onPress:
        back === 'call'
          ? pages.back
          : () => {
              tick();
              pages.back();
            },
    },
  });
  const page = (level: Level, children: ReactNode) => {
    const at = spot(level);
    return (
      <PageAt key={level} spot={at} paged={room.paged}>
        <PageChrome.Provider value={chromeOf(at)}>{children}</PageChrome.Provider>
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
      toolbarLine={toolbarLine}
      tasks={tasks}
      offline={offline}
      yours={yours}
      feel={touch}
      onAnswer={answer}
      onUndo={undo}
      onOpenTile={openTile}
      onGoThrough={onGoThrough}
    />
  );
  const levels = [
    page(
      'topic',
      opened ? (
        <Detail
          task={opened}
          asks={yours.shown.filter((ask) => ask.topic === opened.name)}
          answered={yours.answered}
          threads={threads}
          missing={missing}
          width={spot('topic').width}
          onSteps={openSteps}
          onAnswer={answer}
          onUndo={undo}
          onTalk={() => talk(opened)}
          onOpen={openThread}
          onOpenTask={(id) => {
            tick();
            pages.go({ to: 'topic', id });
          }}
          messages={
            said.chat && (said.chat.total || said.chat.sends) ? (
              <Messages
                key="messages"
                thread={opened}
                chat={said.chat}
                onOpen={() => write(false)}
                onWrite={() => write(true)}
              />
            ) : undefined
          }
          foot={spot('topic').foot}
        />
      ) : (
        <Spacer />
      ),
    ),
    page(
      'thread',
      opened ? (
        <ThreadPage
          thread={opened}
          chat={said.chat}
          pending={said.pending}
          focus={pages.focusComposer}
          foot={spot('thread').foot}
          onTyping={(on) => {
            setTyping(on);
            if (on) pages.go({ to: 'composerFocused' });
          }}
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
      traced ? <Trace task={traced} onOpen={(link) => openLink(link, 't3')} /> : <Spacer />,
    ),
    page('check', <LastCheck check={check} />),
  ];

  const fill = [frame({ maxWidth: Infinity, alignment: 'top' }), upTo(), clipped()];
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
  const atFold = room.paged && room.fold ? { ...room, fold: room.fold } : undefined;
  return (
    <ZStack
      alignment={atFold ? 'topLeading' : 'top'}
      modifiers={
        atFold
          ? [
              frame({ maxWidth: Infinity, alignment: 'topLeading' }),
              upTo(Infinity, 'topLeading'),
              clipped(),
            ]
          : fill
      }
    >
      {page('list', list)}
      {levels}
      {atFold?.fold.band === 0 && <Seam fold={atFold.fold} />}
    </ZStack>
  );
}

// Open flat, the pages meet at the fold with a hairline between them, as a split view's columns do.
function Seam({ fold }: { fold: Fold }) {
  const row = fold.axis === 'row';
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[
        ...(row
          ? [frame({ width: 1 }), upTo()]
          : [frame({ height: 1 }), frame({ maxWidth: Infinity })]),
        background(theme.edge),
        offset(row ? { x: fold.at, y: 0 } : { x: 0, y: fold.at }),
        accessibilityHidden(true),
      ]}
    >
      <Spacer />
    </Column>
  );
}

// On iPhone Duo a page is clear, so it clips to its frame and fades as it leaves instead of
// covering the page below it.
function PageAt({ spot, paged, children }: { spot: Spot; paged: boolean; children: ReactNode }) {
  const { frame: size, offset: at, pad } = spot;
  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[
        padding({ top: pad.top, leading: pad.leading, trailing: pad.trailing }),
        ...(size
          ? [frame({ width: size.width, alignment: 'top' }), upTo(size.maxHeight)]
          : [frame({ maxWidth: Infinity, alignment: 'top' }), upTo()]),
        ...(paged ? [clipped(), opacity(spot.shown ? 1 : 0)] : [background(theme.sheet)]),
        offset(at),
        animation(motion.page, (at.x + at.y) * 4096 + (size ? size.width + size.maxHeight : 0)),
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
