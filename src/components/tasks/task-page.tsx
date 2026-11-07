import { Column, Icon, Row, ScrollView } from '@expo/ui';
import {
  accessibilityLabel,
  contentShape,
  frame,
  monospacedDigit,
  padding,
  scrollClipDisabled,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';

import { YourCall } from '@/components/tasks/ask-card';
import { Header, Talk, type Door } from '@/components/tasks/bar';
import { Mark } from '@/components/tasks/mark';
import { Faded, SectionHead, Sections } from '@/components/tasks/parts';
import { Pinned } from '@/components/tasks/pinned';
import { PlaceTile, Places, hasPlaces } from '@/components/tasks/places';
import { Foot, WriteField } from '@/components/tasks/thread';
import { KIND, Steps, TraceLine } from '@/components/tasks/trace';
import type { Ask, AskOption } from '@/live/asks';
import {
  placeOf,
  proofWords,
  type FinishedEntry,
  type HexPick,
  type Place,
  type Tile,
} from '@/live/inbox';
import {
  STATE_WORDS,
  agentWords,
  clock,
  doneAt,
  lastRun,
  taskTime,
  type Task,
  type TaskRow,
  type TaskId,
} from '@/live/tasks';
import { theme } from '@/theme';
import { Text } from '@/ui/text';
import { metrics, space } from '@/ui/tokens';

const PREVIEW = 3;

export function Detail({
  task,
  asks,
  answered,
  threads,
  finished,
  row,
  missing,
  width,
  onSteps,
  onAnswer,
  onTakePicks,
  onUndo,
  onAgain,
  onDismiss,
  onTalk,
  onOpen,
  onOpenTask,
  onOpenTile,
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
  // What hex finished in this project in the last day, newest first.
  finished: FinishedEntry[];
  // The row the page was opened from: one of what was finished brings them to the top.
  row?: string | null;
  missing: Set<Place>;
  width: number;
  onSteps: (id: TaskId) => void;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onTakePicks: (picks: HexPick[]) => void;
  onUndo: (ask: Ask) => void;
  onAgain: (ask: Ask) => void;
  onDismiss: (ask: Ask) => void;
  onTalk: () => void;
  onOpen: (thread: TaskRow) => void;
  onOpenTask: (id: TaskId) => void;
  onOpenTile: (tile: Tile) => void;
  messages?: ReactNode;
  beside?: boolean;
  // Writing your own answer to an ask, so its field is the one on the page.
  answering?: boolean;
  onWrite?: () => void;
  foot?: number;
}) {
  const full = 'lately' in task ? task : undefined;
  const needs = task.state === 'needs' && !asks.length ? (full?.needs ?? task.line) : undefined;
  const lately = (full?.lately ?? []).filter((moment, i) => !(i === 0 && moment.text === needs));
  const working = [task, ...threads.filter((one) => one.id !== task.id)].filter(
    (one) => one.state === 'working',
  );
  const open = asks.filter((ask) => !answered[ask.id]).length;
  const door = [task, ...threads].find((one) => one.link);
  const done = finished.length ? (
    <Column key="finished" alignment="start" spacing={0}>
      <SectionHead title="Finished" count={finished.length} />
      {finished.map((entry) => (
        <Finished key={entry.id} entry={entry} onOpen={onOpenTile} />
      ))}
    </Column>
  ) : null;
  const doneFirst = finished.some((entry) => entry.id === row);
  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
    >
      <Header
        title={task.name}
        subtitle={`${open ? `${open} need${open === 1 ? 's' : ''} you` : STATE_WORDS[task.state]} · ${taskTime(task)}`}
        door={door && { place: placeOf(door.app), onPress: () => onOpen(door) }}
      />
      <Faded>
        <ScrollView
          key={beside ? 'beside' : 'alone'}
          showsIndicators={false}
          modifiers={[
            scrollClipDisabled(),
            frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
          ]}
        >
          <Column alignment="start" spacing={0} modifiers={[padding({ bottom: space[12] })]}>
            <Sections>
              {doneFirst ? done : null}
              {needs ? (
                <Column key="needs" alignment="start" spacing={0}>
                  <SectionHead title={`Waiting on you since ${clock(new Date(task.since))}`} />
                  <Text
                    paragraph
                    modifiers={[
                      padding({
                        leading: metrics.list.inset,
                        trailing: metrics.list.inset,
                        bottom: space[2],
                      }),
                      frame({ maxWidth: Infinity, alignment: 'leading' }),
                    ]}
                  >
                    {needs}
                  </Text>
                </Column>
              ) : null}
              {asks.length ? (
                <YourCall
                  key="call"
                  asks={asks}
                  answered={answered}
                  width={width}
                  onAnswer={onAnswer}
                  onTakePicks={onTakePicks}
                  onUndo={onUndo}
                  onAgain={onAgain}
                  onDismiss={onDismiss}
                />
              ) : null}
              {working.length ? (
                <Column key="working" alignment="start" spacing={0}>
                  <SectionHead title="Working" />
                  {working.map((thread) => (
                    <Run
                      key={thread.id}
                      thread={thread.id === task.id && full ? full : thread}
                      onPress={() => onSteps(thread.id)}
                    />
                  ))}
                </Column>
              ) : null}
              {full && lastRun(full) ? (
                <Column key="run" alignment="start" spacing={0}>
                  <SectionHead title="Last run" />
                  <Run thread={full} onPress={() => onSteps(full.id)} />
                </Column>
              ) : null}
              {doneFirst ? null : done}
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
        </ScrollView>
      </Faded>
      {beside || answering ? null : (
        <Foot foot={foot}>
          {onWrite ? <WriteField title={task.place || task.name} onPress={onWrite} /> : null}
          <Talk about={task.name} alone={!onWrite} onPress={onTalk} />
        </Foot>
      )}
    </Column>
  );
}

// A project with no thread to show (its threads left the board, or it's what's stuck or what
// finished) still opens on what it has: its asks, then its other rows, with its way back and a
// door to where they were asked.
export function Asked({
  topic,
  asks,
  answered,
  width,
  door,
  rows,
  onAnswer,
  onTakePicks,
  onUndo,
  onAgain,
  onDismiss,
}: {
  topic: string;
  asks: Ask[];
  answered: Record<string, string | null>;
  width: number;
  door?: Door;
  rows?: ReactNode[];
  onAnswer: (ask: Ask, option: AskOption) => void;
  onTakePicks: (picks: HexPick[]) => void;
  onUndo: (ask: Ask) => void;
  onAgain: (ask: Ask) => void;
  onDismiss: (ask: Ask) => void;
}) {
  const open = asks.filter((ask) => !answered[ask.id]).length;
  const others = rows?.length ?? 0;
  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
    >
      <Header
        title={topic}
        subtitle={open ? `${open} need${open === 1 ? 's' : ''} you` : `${others} here`}
        door={door}
      />
      <Faded>
        <ScrollView
          showsIndicators={false}
          modifiers={[
            scrollClipDisabled(),
            frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
          ]}
        >
          <Column alignment="start" spacing={0} modifiers={[padding({ bottom: space[12] })]}>
            {asks.length ? (
              <YourCall
                asks={asks}
                answered={answered}
                width={width}
                onAnswer={onAnswer}
                onTakePicks={onTakePicks}
                onUndo={onUndo}
                onAgain={onAgain}
                onDismiss={onDismiss}
              />
            ) : null}
            {rows}
          </Column>
        </ScrollView>
      </Faded>
    </Column>
  );
}

// A task finished here, with what showed it done; its proof's link opens from it.
function Finished({
  entry: { finished, tiles },
  onOpen,
}: {
  entry: FinishedEntry;
  onOpen: (tile: Tile) => void;
}) {
  const proof = proofWords(finished.proof);
  const page = tiles.find((tile) => tile.kind === 'link');
  return (
    <TraceLine
      lead={<Mark state="done" />}
      text={finished.title}
      lines={2}
      time={doneAt(finished.at)}
      after={
        page ? (
          <Icon name="arrow.up.right" size={metrics.symbol.small} color={theme.tertiary} />
        ) : undefined
      }
      onPress={page && (() => onOpen(page))}
      label={`${finished.title}, done${proof ? `: ${proof}` : ''}${page ? `. Opens ${page.label}` : ''}`}
    >
      {proof ? (
        <Text numberOfLines={2} variant="caption" tone="secondary" paragraph>
          {proof}
        </Text>
      ) : null}
    </TraceLine>
  );
}

function Run({ thread, onPress }: { thread: TaskRow | Task; onPress: () => void }) {
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
          weight="semibold"
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          {thread.place}
        </Text>
        <Text variant="caption" tone="tertiary" modifiers={[monospacedDigit()]}>
          {taskTime(thread)}
        </Text>
        <Icon name="chevron.right" size={metrics.symbol.small} color={theme.tertiary} />
      </Row>
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
}
