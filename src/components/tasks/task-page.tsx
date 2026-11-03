import { Column, Icon, Row, ScrollView, Text } from '@expo/ui';
import {
  accessibilityLabel,
  contentShape,
  foregroundStyle,
  frame,
  monospacedDigit,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';

import { YourCall } from '@/components/tasks/ask-card';
import { Header, useChrome } from '@/components/tasks/bar';
import { laneWidth } from '@/components/tasks/lane';
import { Mark } from '@/components/tasks/mark';
import {
  Faded,
  GAP,
  INSET,
  MARK,
  Pill,
  SectionHead,
  Sections,
  ios,
} from '@/components/tasks/parts';
import { Pinned } from '@/components/tasks/pinned';
import { OpenIn, PlaceTile, Places, hasPlaces } from '@/components/tasks/places';
import { KIND, Steps, TraceLine } from '@/components/tasks/trace';
import type { Ask, AskOption } from '@/live/asks';
import { PLACES, placeOf, type Place } from '@/live/inbox';
import {
  STATE_WORDS,
  agentWords,
  clock,
  lastRun,
  taskTime,
  type Task,
  type TaskRow,
} from '@/live/tasks';
import { theme } from '@/theme';

const PREVIEW = 3;

export function Detail({
  task,
  asks,
  answered,
  threads,
  missing,
  width,
  onSteps,
  onAnswer,
  onUndo,
  onTalk,
  onOpen,
  onOpenTask,
  messages,
  foot = 0,
}: {
  task: TaskRow | Task;
  asks: Ask[];
  answered: Record<string, string | null>;
  threads: TaskRow[];
  missing: Set<Place>;
  width: number;
  onSteps: (id: string) => void;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onUndo: (ask: Ask) => void;
  onTalk: () => void;
  onOpen: (thread: TaskRow) => void;
  onOpenTask: (id: string) => void;
  messages?: ReactNode;
  foot?: number;
}) {
  const full = 'lately' in task ? task : undefined;
  const needs = task.state === 'needs' && !asks.length ? (full?.needs ?? task.line) : undefined;
  const lately = (full?.lately ?? []).filter((moment, i) => !(i === 0 && moment.text === needs));
  const working = [task, ...threads.filter((one) => one.id !== task.id)].filter(
    (one) => one.state === 'working',
  );
  const apps = [...new Set(threads.map((one) => PLACES[placeOf(one.app)]))];
  const door =
    useChrome().bar === 'center' ? undefined : [task, ...threads].find((one) => one.link);
  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
    >
      <Header
        title={task.name}
        subtitle={
          threads.length > 1
            ? `${threads.length} threads · ${apps.join(', ')}`
            : `${PLACES[placeOf(task.app)]} · ${STATE_WORDS[task.state]}`
        }
        door={door && { place: placeOf(door.app), onPress: () => onOpen(door) }}
      />
      <Faded>
        <ScrollView
          showsIndicators={false}
          modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
        >
          <Column alignment="start" spacing={0} modifiers={[padding({ bottom: 40 })]}>
            <Sections>
              {needs ? (
                <Column key="needs" alignment="start" spacing={0}>
                  <SectionHead title={`Waiting on you since ${clock(new Date(task.since))}`} />
                  <Text
                    textStyle={{ fontSize: 17, lineHeight: 22 }}
                    modifiers={[
                      foregroundStyle(theme.text),
                      padding({ leading: INSET, trailing: INSET, bottom: 6 }),
                      frame({ maxWidth: Infinity, alignment: 'leading' }),
                    ]}
                  >
                    {needs}
                  </Text>
                </Column>
              ) : null}
              {messages}
              {asks.length ? (
                <YourCall
                  key="call"
                  asks={asks}
                  answered={answered}
                  width={width}
                  onAnswer={onAnswer}
                  onUndo={onUndo}
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
              {full?.pin ? <Pinned key="pin" text={full.pin} /> : null}
              {hasPlaces(task, threads) ? (
                <Places
                  key="places"
                  task={task}
                  threads={threads}
                  missing={missing}
                  lane={laneWidth(width)}
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
                      color={i > 0 ? theme.secondary : undefined}
                      time={clock(new Date(moment.at))}
                    />
                  ))}
                </Column>
              ) : null}
            </Sections>
          </Column>
        </ScrollView>
      </Faded>
      <Row
        alignment="center"
        spacing={10}
        modifiers={[
          padding({ leading: 16, trailing: 16, top: 8, bottom: Math.max(14, foot) }),
          frame({ maxWidth: Infinity }),
        ]}
      >
        <Pill label="Talk it through" icon="waveform" prominent onPress={onTalk} />
        <OpenIn task={task} threads={threads} onOpen={onOpen} />
      </Row>
    </Column>
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
        ...(ios
          ? [
              accessibilityLabel(
                `${thread.place}, ${STATE_WORDS[thread.state]}: ${thread.line}. Shows its steps`,
              ),
            ]
          : []),
      ]}
    >
      <Row
        alignment="center"
        spacing={GAP}
        modifiers={[
          padding({ leading: INSET - 2, trailing: INSET - 2, top: 4, bottom: 2 }),
          frame({ maxWidth: Infinity }),
        ]}
      >
        <PlaceTile place={placeOf(thread.app)} size={MARK} />
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 15, fontWeight: '600' }}
          modifiers={[
            foregroundStyle(theme.text),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        >
          {thread.place}
        </Text>
        <Text
          textStyle={{ fontSize: 13 }}
          modifiers={[monospacedDigit(), foregroundStyle(theme.tertiary)]}
        >
          {taskTime(thread)}
        </Text>
        <Icon name="chevron.right" size={11} color={theme.tertiary} />
      </Row>
      {steps.length ? (
        <Steps steps={steps} agents={thread.agents} opens={false} />
      ) : working ? (
        <TraceLine lead={<Mark state="working" />} text={thread.line} />
      ) : null}
      {agents ? (
        <TraceLine
          lead={<Icon name={KIND.agent} size={13} color={theme.secondary} />}
          text={agents}
          color={theme.secondary}
        />
      ) : null}
    </Column>
  );
}
