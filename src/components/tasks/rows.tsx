import { Column, Icon, Row, ScrollView, Spacer, Text } from '@expo/ui';
import { Capsule, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityLabel,
  background,
  clipShape,
  contentShape,
  foregroundStyle,
  frame,
  padding,
  shapes,
  strokeBorder,
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';

import { INSET, Mark, ios } from '@/components/tasks/parts';
import { PlaceTag } from '@/components/tasks/places';
import type { Ask, AskOption } from '@/live/asks';
import { STUCK, waited, type Entry, type Place } from '@/live/inbox';
import { STATE_WORDS, clock, taskTime, type TaskState } from '@/live/tasks';
import { theme } from '@/theme';

export type RowActions = {
  selected?: string | null;
  answered: Record<string, string | null>;
  onOpen: (task: string, entry: string) => void;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onUndo: (ask: Ask) => void;
  onAct: (id: string) => void;
  onRead: (id: string) => void;
};

// One row of the stream, whatever it is: an ask answered right in it, a thread, something stuck
// with its one action, or something that just finished.
export function EntryRow({ entry, ...actions }: { entry: Entry } & RowActions) {
  const selected = actions.selected === entry.id;
  switch (entry.kind) {
    case 'ask': {
      const said = actions.answered[entry.ask.id];
      return said ? (
        <Folded ask={entry.ask} label={said} onUndo={() => actions.onUndo(entry.ask)} />
      ) : (
        <Shell
          mark="needs"
          title={entry.topic}
          place={entry.place}
          time={clock(new Date(entry.at))}
          trailing={<Waited at={entry.at} />}
          text={entry.ask.question}
          strong
          selected={selected}
          label={`${entry.topic} asks: ${entry.ask.question}`}
          onPress={() => actions.onOpen(entry.ask.task, entry.id)}
        >
          <Options ask={entry.ask} onAnswer={actions.onAnswer} />
        </Shell>
      );
    }
    case 'task': {
      const { task } = entry;
      const agents = task.state === 'working' ? task.agents.length : 0;
      return (
        <Shell
          mark={task.state}
          quiet={entry.stage === 'quiet' && task.state !== 'idle'}
          title={entry.topic}
          place={entry.place}
          time={taskTime(task)}
          trailing={agents ? <Agents count={agents} /> : null}
          text={task.line}
          strong={task.state === 'needs' || task.state === 'working'}
          selected={selected}
          label={`${task.name}, ${task.where}, ${STATE_WORDS[task.state]}: ${task.line}`}
          onPress={() => actions.onOpen(task.id, entry.id)}
        />
      );
    }
    case 'stuck': {
      const { stuck } = entry;
      return (
        <Shell
          mark={stuck.mark}
          title={stuck.title}
          place={entry.place}
          time={clock(new Date(entry.at))}
          text={stuck.why}
          label={`${STUCK}: ${stuck.title}. ${stuck.why}`}
        >
          <Action
            label={stuck.sent ? 'Sent to hex' : stuck.action}
            onPress={stuck.sent ? undefined : () => actions.onAct(stuck.id)}
          />
        </Shell>
      );
    }
    case 'fresh': {
      const { fresh } = entry;
      return (
        <Shell
          mark="done"
          title={fresh.title}
          place={entry.place}
          time={clock(new Date(entry.at))}
          text={fresh.line}
          strong={!fresh.read}
          label={`${fresh.title}, finished: ${fresh.line}`}
        >
          {fresh.read ? null : <Action label="Read" onPress={() => actions.onRead(fresh.id)} />}
        </Shell>
      );
    }
  }
}

// The row whose task is open lifts out as a rounded highlight, inset from the list's edges like
// Mail's.
const LIFT = 8;

// The frame every row shares: its mark, its name and where it lives, when, then a line or two in
// its own words, and whatever it lets you do right there.
function Shell({
  mark,
  quiet = false,
  title,
  place,
  time,
  trailing,
  text,
  strong = false,
  selected = false,
  label,
  onPress,
  children,
}: {
  mark: TaskState | 'paused';
  quiet?: boolean;
  title: string;
  place: Place;
  time: string;
  trailing?: ReactNode;
  text: string;
  strong?: boolean;
  selected?: boolean;
  label: string;
  onPress?: () => void;
  children?: ReactNode;
}) {
  return (
    <Row
      alignment="start"
      spacing={12}
      onPress={onPress}
      modifiers={[
        padding({ leading: INSET - LIFT, trailing: INSET - LIFT, top: 11, bottom: 11 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        ...(selected ? [background(theme.surfaceSelected), clipShape('roundedRectangle', 14)] : []),
        padding({ horizontal: LIFT }),
        contentShape(shapes.rectangle()),
        ...(ios
          ? [
              accessibilityLabel(label),
              ...(selected ? [accessibilityAddTraits(['isSelected'])] : []),
            ]
          : []),
      ]}
    >
      <Mark state={mark} quiet={quiet} />
      <Column
        alignment="start"
        spacing={3}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Row alignment="center" spacing={7} modifiers={[frame({ maxWidth: Infinity })]}>
          <Text
            numberOfLines={1}
            textStyle={{ fontSize: 15, fontWeight: '600' }}
            modifiers={[foregroundStyle(theme.text)]}
          >
            {title}
          </Text>
          <PlaceTag place={place} />
          <Spacer flexible />
          {trailing}
          <Text textStyle={{ fontSize: 13 }} modifiers={[foregroundStyle(theme.tertiary)]}>
            {time}
          </Text>
        </Row>
        {text ? (
          <Text
            numberOfLines={2}
            textStyle={{ fontSize: 15, lineHeight: 19 }}
            modifiers={[foregroundStyle(strong ? theme.text : theme.secondary)]}
          >
            {text}
          </Text>
        ) : null}
        {children}
      </Column>
    </Row>
  );
}

// An ask's choices as small pills under it, answered with one tap. hex's pick wears the ring and
// its check; a choice that opens a page says so with its arrow.
function Options({ ask, onAnswer }: { ask: Ask; onAnswer: (ask: Ask, option: AskOption) => void }) {
  return (
    <ScrollView direction="horizontal" showsIndicators={false} modifiers={[padding({ top: 5 })]}>
      <Row alignment="center" spacing={8}>
        {ask.options.map((option) => (
          <Row
            key={option.label}
            alignment="center"
            spacing={5}
            onPress={() => onAnswer(ask, option)}
            modifiers={[
              padding({ leading: 12, trailing: 12 }),
              frame({ height: 32 }),
              background(theme.surface),
              clipShape('capsule'),
              ...(option.pick
                ? [
                    strokeBorder({
                      content: theme.accent,
                      style: { lineWidth: 1.5 },
                      shape: 'capsule',
                    }),
                  ]
                : []),
              contentShape(shapes.capsule()),
              ...(ios
                ? [accessibilityLabel(option.pick ? `${option.label}, hex’s pick` : option.label)]
                : []),
            ]}
          >
            {option.pick ? <Icon name="checkmark" size={11} color={theme.accent} /> : null}
            <Text
              numberOfLines={1}
              textStyle={{ fontSize: 14, fontWeight: option.pick ? '600' : '500' }}
              modifiers={[foregroundStyle(theme.text)]}
            >
              {option.label}
            </Text>
            {option.url ? <Icon name="arrow.up.right" size={11} color={theme.secondary} /> : null}
          </Row>
        ))}
      </Row>
    </ScrollView>
  );
}

// An ask answered here, folded to what you said and where it went, with Undo, until Tasks closes.
function Folded({ ask, label, onUndo }: { ask: Ask; label: string; onUndo: () => void }) {
  return (
    <Row
      alignment="center"
      spacing={12}
      modifiers={[
        padding({ leading: INSET, trailing: INSET, top: 11, bottom: 11 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
      ]}
    >
      <Mark state="done" />
      <Column
        alignment="start"
        spacing={2}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 14 }}
          modifiers={[foregroundStyle(theme.secondary)]}
        >
          {ask.question}
        </Text>
        <Text
          numberOfLines={2}
          textStyle={{ fontSize: 15, fontWeight: '600' }}
          modifiers={[foregroundStyle(theme.text)]}
        >
          {`${label} → ${ask.topic}`}
        </Text>
      </Column>
      <Text
        textStyle={{ fontSize: 15, fontWeight: '600' }}
        onPress={onUndo}
        modifiers={[
          foregroundStyle(theme.accent),
          padding({ leading: 8, top: 6, bottom: 6 }),
          ...(ios ? [accessibilityLabel(`Undo ${label}`)] : []),
        ]}
      >
        Undo
      </Text>
    </Row>
  );
}

// How long it has waited, as a short bar: a day fills half of it, and past a day it turns red.
function Waited({ at }: { at: string }) {
  const { fill, late } = waited(at);
  const WIDTH = 18;
  return (
    <ZStack alignment="leading" modifiers={[frame({ width: WIDTH, height: 3 })]}>
      <Capsule
        modifiers={[frame({ width: WIDTH, height: 3 }), foregroundStyle(theme.surfaceSelected)]}
      />
      <Capsule
        modifiers={[
          frame({ width: Math.max(3, WIDTH * fill), height: 3 }),
          foregroundStyle(late ? theme.danger : theme.secondary),
        ]}
      />
    </ZStack>
  );
}

function Agents({ count }: { count: number }) {
  return (
    <Row alignment="center" spacing={3}>
      <Icon name="person.2" size={11} color={theme.tertiary} />
      <Text textStyle={{ fontSize: 13 }} modifiers={[foregroundStyle(theme.tertiary)]}>
        {String(count)}
      </Text>
    </Row>
  );
}

function Action({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Text
      onPress={onPress}
      textStyle={{ fontSize: 14, fontWeight: '600' }}
      modifiers={[
        foregroundStyle(onPress ? theme.text : theme.tertiary),
        padding({ leading: 12, trailing: 12, top: 7, bottom: 7 }),
        background(theme.surface),
        clipShape('capsule'),
        padding({ top: 5 }),
      ]}
    >
      {label}
    </Text>
  );
}
