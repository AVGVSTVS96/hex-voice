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

import { GAP, Header, INSET, MARK, Mark, Pill, SectionHead, ios } from '@/components/tasks/parts';
import { Pinned, YourCall } from '@/components/tasks/pinned';
import { OpenIn, PlaceTile, Places } from '@/components/tasks/places';
import { Steps, TraceLine } from '@/components/tasks/trace';
import type { Ask, AskOption } from '@/live/asks';
import { PLACES, placeOf, type Place } from '@/live/inbox';
import { STATE_WORDS, clock, taskTime, type Task, type TaskRow } from '@/live/tasks';
import { theme } from '@/theme';

const PREVIEW = 3;

// A topic's page, opened from any of its threads: what waits on you there (its asks, answered as
// rows), what's working (each thread's newest steps, opening into all of them), its pinned post,
// every place it lives on its own lane, and what it did lately. Talk it through and Open in share
// the foot.
export function Detail({
  task,
  asks,
  answered,
  threads,
  missing,
  lane,
  onBack,
  onTrace,
  onAnswer,
  onUndo,
  onTalk,
  onOpen,
  onOpenTask,
  foot = 0,
}: {
  task: TaskRow | Task;
  asks: Ask[];
  answered: Record<string, string | null>;
  threads: TaskRow[];
  missing: Set<Place>;
  lane: number;
  onBack?: () => void;
  onTrace: (id: string) => void;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onUndo: (ask: Ask) => void;
  onTalk: () => void;
  onOpen: (thread: TaskRow) => void;
  onOpenTask: (id: string) => void;
  foot?: number;
}) {
  const full = 'lately' in task ? task : undefined;
  const needs = task.state === 'needs' && !asks.length ? (full?.needs ?? task.line) : undefined;
  const lately = (full?.lately ?? []).filter((moment, i) => !(i === 0 && moment.text === needs));
  const working = [task, ...threads.filter((one) => one.id !== task.id)].filter(
    (one) => one.state === 'working',
  );
  const apps = [...new Set(threads.map((one) => PLACES[placeOf(one.app)]))];
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
        onBack={onBack}
      />
      <ScrollView
        showsIndicators={false}
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
      >
        <Column alignment="start" spacing={0} modifiers={[padding({ bottom: 40 })]}>
          {needs ? (
            <Column alignment="start" spacing={0}>
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
          <YourCall asks={asks} answered={answered} onAnswer={onAnswer} onUndo={onUndo} />
          {working.length ? (
            <Column alignment="start" spacing={0}>
              <SectionHead title="Working" />
              {working.map((thread) => (
                <Working
                  key={thread.id}
                  thread={thread.id === task.id && full ? full : thread}
                  onPress={() => onTrace(thread.id)}
                />
              ))}
            </Column>
          ) : null}
          {full?.pin ? <Pinned text={full.pin} /> : null}
          <Places
            task={task}
            threads={threads}
            missing={missing}
            lane={lane}
            onOpen={onOpen}
            onOpenTask={onOpenTask}
          />
          {lately.length ? (
            <Column alignment="start" spacing={0}>
              <SectionHead title="Lately" />
              {lately.map((moment, i) => (
                <TraceLine
                  key={`${moment.at} ${i}`}
                  lead={
                    <Mark
                      state={i === 0 ? moment.state : moment.state === 'failed' ? 'failed' : 'read'}
                    />
                  }
                  text={moment.text}
                  quiet={i > 0}
                  time={clock(new Date(moment.at))}
                />
              ))}
            </Column>
          ) : null}
        </Column>
      </ScrollView>
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

// A thread at work in the topic: where it is and for how long, then its newest steps, the first
// turning. It opens into everything it's doing.
function Working({ thread, onPress }: { thread: TaskRow | Task; onPress: () => void }) {
  const steps = 'steps' in thread ? thread.steps.slice(0, PREVIEW) : [];
  return (
    <Column
      alignment="start"
      spacing={0}
      onPress={onPress}
      modifiers={[
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
        ...(ios
          ? [accessibilityLabel(`${thread.place}, working: ${thread.line}. Shows its steps`)]
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
        <Steps steps={steps} working opens={false} />
      ) : (
        <TraceLine lead={<Mark state="working" />} text={thread.line} />
      )}
    </Column>
  );
}
