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

// Tasks in the phone's sheet or iPad's pane, holding its own pages. Its title sits on the
// toolbar's line where there is one beside it (`line`), and its foot keeps clear of the home
// indicator (`foot`).
export function TasksView({
  width,
  line,
  foot = 0,
  ...view
}: TasksProps & { width: number; line?: number; foot?: number }) {
  const pages = usePages({ open: view.open, at: view.at, shape: shapeOf(width, undefined) });
  return (
    <Tasks
      {...view}
      pages={pages}
      line={line}
      room={{ width, height: 0, top: 0, foot, inset: { left: 0, right: 0 }, paged: false }}
    />
  );
}

// Everything hex has going: the list, and a topic's page a level down from it, a thread's
// messages below that and its steps below those. Each level's page sits where its spot puts it
// (`spotOf`) and takes its Back from there; whoever holds `pages` can take Tasks back a level.
export function Tasks({
  open,
  haptics,
  onTalk,
  onGoThrough,
  onOpenCall,
  at,
  pages,
  room,
  line,
}: TasksProps & { pages: Pages; room: Room; line?: number }) {
  const { tasks, version, offline } = useTasks(open);
  const yours = useAsks(open);
  const [missing, setMissing] = useState<Set<Place>>(new Set());
  const [typing, setTyping] = useState(false);
  const task = useTask(pages.task, version);
  const traced = useTask(pages.trace, version);
  const check = useCheck(pages.path.includes('check') ? yours.list?.check?.at : undefined);
  const touch = feel(haptics);
  const { tick, tap } = touch;
  const opened = task ?? tasks?.find((row) => row.id === pages.task);
  const threads = opened ? (tasks ?? []).filter((row) => row.name === opened.name) : [];
  const said = useChat(
    open && opened && (pages.shape !== 'one' || pages.path.includes('task')) ? opened.id : null,
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
  const openTrace = (id: string) => {
    tick();
    pages.go({ to: 'trace', id });
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
  // Back is named on iPhone Duo for the page it goes to, and leaving Tasks for the call.
  const nameOf = (to: Level | 'call') =>
    to === 'call'
      ? 'Call'
      : to === 'list'
        ? 'Tasks'
        : to === 'task'
          ? (opened?.name ?? '')
          : to === 'thread'
            ? ((opened?.place || opened?.name) ?? '')
            : '';
  const chromeOf = ({ bar, back }: Spot): Chrome => ({
    bar,
    back: back && {
      to: room.paged ? nameOf(back) : '',
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
      line={line}
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
      'task',
      opened ? (
        <Detail
          task={opened}
          asks={yours.shown.filter((ask) => ask.topic === opened.name)}
          answered={yours.answered}
          threads={threads}
          missing={missing}
          width={spot('task').width}
          onTrace={openTrace}
          onAnswer={answer}
          onUndo={undo}
          onTalk={() => talk(opened)}
          onOpen={openThread}
          onOpenTask={(id) => {
            tick();
            pages.go({ to: 'task', id });
          }}
          messages={
            <Messages
              thread={opened}
              chat={said.chat}
              onOpen={() => write(false)}
              onWrite={() => write(true)}
            />
          }
          foot={spot('task').foot}
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
          focus={pages.writes}
          foot={spot('thread').foot}
          onTyping={setTyping}
          onOpen={openThread}
          onSteps={() => openTrace(opened.id)}
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
      'trace',
      traced ? <Trace task={traced} onOpen={(link) => openLink(link, 't3')} /> : <Spacer />,
    ),
    page('check', <LastCheck check={check} />),
  ];

  const fill = [frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }), clipped()];
  if (pages.shape === 'columns')
    return (
      <Row alignment="start" spacing={0} modifiers={fill}>
        <Column
          alignment="start"
          spacing={0}
          modifiers={[
            frame({ width: spot('list').width }),
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
          {levels}
        </ZStack>
      </Row>
    );
  return (
    <ZStack
      alignment={room.fold ? 'topLeading' : 'top'}
      modifiers={
        room.fold
          ? [frame({ width: room.width, height: room.height, alignment: 'topLeading' }), clipped()]
          : fill
      }
    >
      {page('list', list)}
      {levels}
    </ZStack>
  );
}

// A level's page where its spot puts it, sliding there when it moves. In a sheet or iPad's pane
// it's drawn on the sheet's color over the page below it; on iPhone Duo it draws nothing behind
// its content, which stays inside its page, clear of the hinge and the column's buttons, and fades
// as it leaves.
function PageAt({ spot, paged, children }: { spot: Spot; paged: boolean; children: ReactNode }) {
  const { frame: size, offset: at, pad } = spot;
  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[
        padding({ top: pad.top, leading: pad.leading, trailing: pad.trailing }),
        frame(
          size
            ? { ...size, alignment: 'top' }
            : { maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' },
        ),
        ...(paged ? [clipped(), opacity(spot.shown ? 1 : 0)] : [background(theme.sheet)]),
        offset(at),
        animation(motion.page, (at.x + at.y) * 4096 + (size ? size.width + size.height : 0)),
        accessibilityHidden(!spot.shown),
      ]}
    >
      {children}
    </Column>
  );
}
