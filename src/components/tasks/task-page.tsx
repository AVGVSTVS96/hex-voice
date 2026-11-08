import { Column, Icon, Row } from '@expo/ui';
import { List } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  animation,
  contentShape,
  frame,
  listStyle,
  monospacedDigit,
  padding,
  scrollClipDisabled,
  scrollContentBackground,
  scrollIndicators,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';

import { YourCall } from '@/components/tasks/ask-card';
import { Header, Talk, type Door } from '@/components/tasks/bar';
import { Mark } from '@/components/tasks/mark';
import { Faded, SectionHead, Sections, StageHead, listRow } from '@/components/tasks/parts';
import { Pinned } from '@/components/tasks/pinned';
import { PlaceTile, Places, TileIcon, hasPlaces } from '@/components/tasks/places';
import { Foot, WriteField } from '@/components/tasks/thread';
import { KIND, Steps, TraceLine } from '@/components/tasks/trace';
import { useNow } from '@/hooks/use-now';
import type { Ask, AskOption } from '@/live/asks';
import { Lane } from '@/components/tasks/lane';
import {
  placeOf,
  proofLinks,
  proofSays,
  proofWords,
  tracksOf,
  type Place,
  type Tile,
} from '@/live/inbox';
import {
  STATE_WORDS,
  agentWords,
  clock,
  lastRun,
  taskTime,
  type Finished,
  type Task,
  type TaskRow,
  type TaskId,
} from '@/live/tasks';
import { motion, rowsKey } from '@/motion';
import { theme } from '@/theme';
import { Text } from '@/ui/text';
import { metrics, space } from '@/ui/tokens';

const PREVIEW = 3;

export const Detail = ({
  task,
  asks,
  answered,
  threads,
  missing,
  onSteps,
  onAnswer,
  onUndo,
  onAgain,
  onDismiss,
  onTalk,
  onOpen,
  onOpenTask,
  messages,
  beside = false,
  answering = false,
  onWrite,
  foot = 0,
}: {
  task: TaskRow | Task;
  asks: Ask[];
  answered: Record<string, string | null>;
  threads: TaskRow[];
  missing: Set<Place>;
  onSteps: (id: TaskId) => void;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onUndo: (ask: Ask) => void;
  onAgain: (ask: Ask) => void;
  onDismiss: (ask: Ask) => void;
  onTalk: () => void;
  onOpen: (thread: TaskRow) => void;
  onOpenTask: (id: TaskId) => void;
  messages?: ReactNode;
  beside?: boolean;
  // Writing your own answer to an ask, so its field is the one on the page.
  answering?: boolean;
  onWrite?: () => void;
  foot?: number;
}) => {
  const full = 'lately' in task ? task : undefined;
  const needs = task.state === 'needs' && !asks.length ? (full?.needs ?? task.line) : undefined;
  const lately = (full?.lately ?? []).filter((moment, i) => !(i === 0 && moment.text === needs));
  const working = [task, ...threads.filter((one) => one.id !== task.id)].filter(
    (one) => one.state === 'working',
  );
  const open = asks.filter((ask) => !answered[ask.id]).length;
  const door = [task, ...threads].find((one) => one.link);
  const tracks = tracksOf(task.name, threads.length ? threads : [task]);
  // The lane ends at now, as of when the page opened.
  const now = useNow(false).getTime();
  return (
    <Column alignment="center" spacing={0} modifiers={readable}>
      <Header
        title={task.name}
        subtitle={subtitleOf(task, open)}
        door={door && { place: placeOf(door.app), onPress: () => onOpen(door) }}
      />
      <Faded>
        <List key={task.id} modifiers={pageList(asks, answered)}>
          {asks.length ? (
            <YourCall
              asks={asks}
              answered={answered}
              onAnswer={onAnswer}
              onUndo={onUndo}
              onAgain={onAgain}
              onDismiss={onDismiss}
            />
          ) : null}
          <Column alignment="start" spacing={0} modifiers={rest()}>
            <Sections follows={asks.length > 0}>
              {needs ? (
                <Column key="needs" alignment="start" spacing={0}>
                  <StageHead tint="needs" title="Needs you" />
                  <Text
                    paragraph
                    modifiers={[
                      padding({ leading: metrics.list.inset, trailing: metrics.list.inset }),
                      frame({ maxWidth: Infinity, alignment: 'leading' }),
                    ]}
                  >
                    {needs}
                  </Text>
                  <Text
                    variant="detail"
                    tone="secondary"
                    modifiers={[
                      padding({
                        leading: metrics.list.inset,
                        trailing: metrics.list.inset,
                        top: space[1],
                      }),
                    ]}
                  >
                    {`Waiting on you since ${clock(new Date(task.since))}`}
                  </Text>
                </Column>
              ) : null}
              {working.length ? (
                <Column key="working" alignment="start" spacing={0}>
                  <StageHead tint="working" title="Working" count={working.length} />
                  {working.map((thread) => (
                    <Run
                      key={thread.id}
                      thread={thread.id === task.id && full ? full : thread}
                      named={working.length > 1 || thread.id !== task.id}
                      onPress={() => onSteps(thread.id)}
                    />
                  ))}
                </Column>
              ) : null}
              {full && lastRun(full) ? (
                <Column key="run" alignment="start" spacing={0}>
                  <SectionHead title="Last run" opens />
                  <Run thread={full} named={false} onPress={() => onSteps(full.id)} />
                </Column>
              ) : null}
              {full?.pin ? <Pinned key="pin" text={full.pin} /> : null}
              {messages}
              {hasPlaces(task, threads) ? (
                <Places
                  key={`places:${task.id}`}
                  task={task}
                  threads={threads}
                  missing={missing}
                  onOpen={onOpen}
                  onOpenTask={onOpenTask}
                />
              ) : null}
              {tracks.length ? (
                <Column key="week" alignment="start" spacing={0}>
                  <SectionHead title="This week" />
                  <Row
                    alignment="center"
                    spacing={0}
                    modifiers={[
                      padding({ leading: metrics.list.inset, trailing: metrics.list.inset }),
                    ]}
                  >
                    <Lane tracks={tracks} now={now} />
                  </Row>
                </Column>
              ) : null}
              {lately.length ? (
                <Column key="lately" alignment="start" spacing={0}>
                  <SectionHead title="Lately" />
                  {lately.map((moment, i) => (
                    <TraceLine
                      key={`${moment.at} ${i}`}
                      lead={
                        <Mark
                          state={
                            i === 0 ? moment.state : moment.state === 'failed' ? 'failed' : 'read'
                          }
                        />
                      }
                      text={moment.text}
                      tone={i > 0 ? 'secondary' : undefined}
                      time={clock(new Date(moment.at))}
                    />
                  ))}
                </Column>
              ) : null}
            </Sections>
          </Column>
        </List>
      </Faded>
      {beside || answering ? null : (
        <Foot foot={foot}>
          {onWrite ? <WriteField title={task.place || task.name} onPress={onWrite} /> : null}
          <Talk about={task.name} alone={!onWrite} onPress={onTalk} />
        </Foot>
      )}
    </Column>
  );
};

// A project with no thread to show (its threads left the board, or it's what's stuck or what
// finished) still opens on what it has: its asks, then its other rows, with its way back and a
// door to where they were asked.
export const Asked = ({
  topic,
  asks,
  answered,
  door,
  rows,
  onAnswer,
  onUndo,
  onAgain,
  onDismiss,
}: {
  topic: string;
  asks: Ask[];
  answered: Record<string, string | null>;
  door?: Door;
  rows?: ReactNode[];
  onAnswer: (ask: Ask, option: AskOption) => void;
  onUndo: (ask: Ask) => void;
  onAgain: (ask: Ask) => void;
  onDismiss: (ask: Ask) => void;
}) => {
  const open = asks.filter((ask) => !answered[ask.id]).length;
  const others = rows?.length ?? 0;
  return (
    <Column alignment="center" spacing={0} modifiers={readable}>
      <Header
        title={topic}
        subtitle={open ? `${open} need${open === 1 ? 's' : ''} you` : `${others} here`}
        door={door}
      />
      <Faded>
        <List key={topic} modifiers={pageList(asks, answered)}>
          {asks.length ? (
            <YourCall
              asks={asks}
              answered={answered}
              onAnswer={onAnswer}
              onUndo={onUndo}
              onAgain={onAgain}
              onDismiss={onDismiss}
            />
          ) : null}
          {rows}
          <Column alignment="start" spacing={0} modifiers={rest()} />
        </List>
      </Faded>
    </Column>
  );
};

// One thing hex did, as Done's row opens it: what it was, when, the proof it was closed with and
// the pages that proof links to, and the way to the rest of its project.
export const DonePage = ({
  finished,
  door,
  onOpenLink,
  onOpenProject,
}: {
  finished: Finished;
  door?: Door;
  onOpenLink: (tile: Tile) => void;
  onOpenProject?: () => void;
}) => {
  const says = proofSays(finished.proof);
  const links = proofLinks(finished.proof);
  const at = clock(new Date(finished.at));
  return (
    <Column alignment="center" spacing={0} modifiers={readable}>
      <Header title={finished.topic} subtitle={`Done · ${at}`} door={door} />
      <Faded>
        <List modifiers={pageList([], {})}>
          <Column alignment="start" spacing={0} modifiers={rest()}>
            <Row
              alignment="start"
              spacing={metrics.list.gap}
              modifiers={[
                padding({
                  leading: metrics.list.inset,
                  trailing: metrics.list.inset,
                  top: space[4],
                }),
                frame({ maxWidth: Infinity, alignment: 'leading' }),
                accessibilityLabel(`Done at ${at}: ${finished.title}`),
              ]}
            >
              <Mark state="done" />
              <Text
                paragraph
                variant="body"
                modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
              >
                {finished.title}
              </Text>
            </Row>
            {says || links.length ? (
              <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
                <SectionHead title="Proof" />
                {says ? (
                  <Text
                    paragraph
                    variant="detail"
                    tone="secondary"
                    modifiers={[
                      padding({
                        leading: metrics.list.inset,
                        trailing: metrics.list.inset,
                        bottom: space[2],
                      }),
                      frame({ maxWidth: Infinity, alignment: 'leading' }),
                    ]}
                  >
                    {proofWords(finished.proof)}
                  </Text>
                ) : null}
                {links.map((link) => {
                  const url =
                    link.kind === 'link' ? link.url : link.kind === 'app' ? link.link : '';
                  return (
                    <Way
                      key={url}
                      lead={<TileIcon tile={link} size={metrics.list.tile} />}
                      title={link.label}
                      note={url?.replace(/^https?:\/\//, '') ?? ''}
                      out
                      onPress={() => onOpenLink(link)}
                    />
                  );
                })}
              </Column>
            ) : null}
            {onOpenProject ? (
              <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
                <SectionHead title="Project" />
                <Way
                  title={finished.topic}
                  note="Everything else it has going"
                  onPress={onOpenProject}
                />
              </Column>
            ) : null}
          </Column>
        </List>
      </Faded>
    </Column>
  );
};

// A row on a page that leads somewhere: out of the app, behind the tile of where it goes, or to
// another page.
const Way = ({
  lead,
  title,
  note,
  out = false,
  onPress,
}: {
  lead?: ReactNode;
  title: string;
  note: string;
  out?: boolean;
  onPress: () => void;
}) => (
  <Row
    alignment="center"
    spacing={space[3]}
    onPress={onPress}
    modifiers={[
      padding({
        leading: metrics.list.inset,
        trailing: metrics.list.inset - space[1],
        top: metrics.list.place,
        bottom: metrics.list.place,
      }),
      frame({ maxWidth: Infinity, alignment: 'leading' }),
      contentShape(shapes.rectangle()),
      accessibilityLabel(`${title}, ${note}`),
    ]}
  >
    {lead}
    <Column
      alignment="start"
      spacing={space[0.5]}
      modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
    >
      <Text numberOfLines={1} variant="detail" weight="medium">
        {title}
      </Text>
      <Text numberOfLines={1} variant="caption" tone="secondary">
        {note}
      </Text>
    </Column>
    <Icon
      name={out ? 'arrow.up.right' : 'chevron.right'}
      size={metrics.symbol.small}
      color={theme.tertiary}
    />
  </Row>
);

// A project's page is a list, so each ask on it is a row a swipe left puts away; an answer folds
// its row where it sits. Each page has a list of its own, so another project's page replaces it
// whole instead of fading its cards through the last one's.
const pageList = (asks: Ask[], answered: Record<string, string | null>) => [
  listStyle('plain'),
  scrollContentBackground('hidden'),
  scrollIndicators('hidden'),
  scrollClipDisabled(),
  frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
  animation(motion.list, rowsKey(asks.map((ask) => `${ask.id}=${answered[ask.id] ?? ''}`))),
];

// A run's steps. It's `named` by its thread, its app and when, only where that tells it apart from
// the page it's on; on its own it's the page's, whose name and door the bar already shows.
const Run = ({
  thread,
  named,
  onPress,
}: {
  thread: TaskRow | Task;
  named: boolean;
  onPress: () => void;
}) => {
  const working = thread.state === 'working';
  const steps = 'steps' in thread ? thread.steps.slice(0, PREVIEW) : [];
  const agents = agentWords(thread.agents, working);
  return (
    <Column
      alignment="start"
      spacing={0}
      onPress={onPress}
      modifiers={[
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
        accessibilityLabel(
          `${thread.place}, ${STATE_WORDS[thread.state]}: ${thread.line}. Shows its steps`,
        ),
      ]}
    >
      {named ? (
        <Row
          alignment="center"
          spacing={metrics.list.gap}
          modifiers={[
            padding({
              leading: metrics.list.inset - space[0.5],
              trailing: metrics.list.inset - space[0.5],
              top: space[1],
              bottom: space[0.5],
            }),
            frame({ maxWidth: Infinity }),
          ]}
        >
          <PlaceTile place={placeOf(thread.app)} size={metrics.list.mark} />
          <Text
            numberOfLines={1}
            variant="detail"
            weight="medium"
            modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
          >
            {thread.place}
          </Text>
          <Text variant="caption" tone="tertiary" modifiers={[monospacedDigit()]}>
            {taskTime(thread)}
          </Text>
          <Icon name="chevron.right" size={metrics.symbol.small} color={theme.tertiary} />
        </Row>
      ) : null}
      {steps.length ? (
        <Steps steps={steps} agents={thread.agents} opens={false} />
      ) : working ? (
        <TraceLine lead={<Mark state="working" />} text={thread.line} />
      ) : null}
      {agents ? (
        <TraceLine
          lead={<Icon name={KIND.agent} size={metrics.symbol.small} color={theme.secondary} />}
          text={agents}
          tone="secondary"
        />
      ) : null}
    </Column>
  );
};

// What needs you and since when, or what it's doing and for how long: a bare time never says which.
const subtitleOf = (task: TaskRow | Task, open: number) => {
  const time = taskTime(task);
  const asks = open ? `${open} need${open === 1 ? 's' : ''} you` : '';
  if (task.state === 'working') return [asks, `working for ${time}`].filter(Boolean).join(' · ');
  if (task.state === 'needs') return `${asks || STATE_WORDS.needs} since ${time}`;
  return [asks, `${STATE_WORDS[task.state]} ${time}`].filter(Boolean).join(' · ');
};

// A page's words keep a readable measure, centered, however wide its room.
const readable = [
  frame({ maxWidth: metrics.readable, maxHeight: Infinity, alignment: 'top' }),
  frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
];

// The page's last row, which holds the rest of it and ends clear of the fade.
const rest = () => [padding({ bottom: space[10] }), frame({ maxWidth: Infinity }), ...listRow()];
