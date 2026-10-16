import { Column, Icon, Row, Text } from '@expo/ui';
import { Button, Rectangle, SwipeActions } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  contentShape,
  foregroundStyle,
  frame,
  layoutPriority,
  listRowBackground,
  padding,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';

import { GAP, INSET, MARK, Mark, ios, listRow, type MarkState } from '@/components/tasks/parts';
import { PLACE_COLOR, PlaceTile } from '@/components/tasks/places';
import type { Ask, AskOption } from '@/live/asks';
import { PLACES, STUCK, fitsOneLine, type Entry, type Place, type Topic } from '@/live/inbox';
import { STATE_WORDS, clock, taskTime } from '@/live/tasks';
import { theme } from '@/theme';

export type RowActions = {
  width: number;
  selected?: string | null;
  answered: Record<string, string | null>;
  onOpen: (task: string, entry: string) => void;
  onOpenLink: (link: string, place: Place) => void;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onUndo: (ask: Ask) => void;
  onAct: (id: string) => void;
  onRead: (id: string) => void;
};

// The room an ask's choices have under its line.
const LEADING = INSET - 2;
const TRAILING = INSET - 4;
const choicesWidth = (width: number) => width - LEADING - MARK - GAP - TRAILING;

// One thing in a topic, whatever it is: an ask, answered in its row when its choices fit one line,
// a thread, something stuck with its one action, or something that just finished. Swipe right to
// do the obvious thing (take hex's pick, read it, act on it) and left to open it where it lives.
export function EntryRow({
  entry,
  first,
  ...actions
}: { entry: Entry; first: boolean } & RowActions) {
  const selected = actions.selected === entry.id;
  const open = (link?: string) =>
    link
      ? { label: 'Open', place: entry.place, onPress: () => actions.onOpenLink(link, entry.place) }
      : undefined;
  switch (entry.kind) {
    case 'ask': {
      const { ask } = entry;
      const said = actions.answered[ask.id];
      if (said)
        return (
          <Folded
            ask={ask}
            label={said}
            width={actions.width}
            first={first}
            onUndo={() => actions.onUndo(ask)}
          />
        );
      const pick = ask.options.find((option) => option.pick && !option.url);
      const inline = fitsOneLine(ask.options, choicesWidth(actions.width));
      return (
        <Swiped
          width={actions.width}
          first={first}
          selected={selected}
          lead={pick && { label: pick.label, onPress: () => actions.onAnswer(ask, pick) }}
          trail={open(ask.link)}
        >
          <Shell
            mark="needs"
            line={ask.question}
            time={clock(new Date(entry.at))}
            place={entry.place}
            label={`${entry.topic} asks: ${ask.question}`}
            onPress={() => actions.onOpen(ask.task, entry.id)}
          >
            {inline ? <Choices ask={ask} onAnswer={actions.onAnswer} /> : null}
          </Shell>
        </Swiped>
      );
    }
    case 'task': {
      const { task } = entry;
      const agents = task.state === 'working' ? task.agents.length : 0;
      const mark: MarkState = task.state === 'done' ? 'read' : task.state;
      return (
        <Swiped width={actions.width} first={first} selected={selected} trail={open(task.link)}>
          <Shell
            mark={mark}
            line={task.line || STATE_WORDS[task.state]}
            time={taskTime(task)}
            meta={agents ? `${agents} agent${agents === 1 ? '' : 's'}` : undefined}
            place={entry.place}
            label={`${task.name}, ${PLACES[entry.place]}, ${STATE_WORDS[task.state]}: ${task.line}`}
            onPress={() => actions.onOpen(task.id, entry.id)}
          />
        </Swiped>
      );
    }
    case 'stuck': {
      const { stuck } = entry;
      const act = stuck.sent ? undefined : () => actions.onAct(stuck.id);
      return (
        <Swiped
          width={actions.width}
          first={first}
          lead={act && { label: stuck.action, onPress: act }}
        >
          <Shell
            mark={stuck.mark}
            line={stuck.title}
            time={clock(new Date(entry.at))}
            place={entry.place}
            label={`${STUCK}: ${stuck.title}. ${stuck.why}`}
          >
            <Action label={stuck.sent ? 'Sent to hex' : stuck.action} onPress={act} />
          </Shell>
        </Swiped>
      );
    }
    case 'fresh': {
      const { fresh } = entry;
      const read = fresh.read ? undefined : () => actions.onRead(fresh.id);
      return (
        <Swiped width={actions.width} first={first} lead={read && { label: 'Read', onPress: read }}>
          <Shell
            mark={fresh.read ? 'read' : 'done'}
            line={`${fresh.title}: ${fresh.line}`}
            time={clock(new Date(entry.at))}
            place={entry.place}
            label={`${fresh.title}, finished: ${fresh.line}`}
          >
            {read ? <Action label="Mark read" onPress={read} /> : null}
          </Shell>
        </Swiped>
      );
    }
  }
}

type Swipe = { label: string; place?: Place; onPress: () => void };

// A row in the list, with what a swipe from either edge does: right in mint, the full swipe doing
// it, and left in the color of the app it opens.
function Swiped({
  width,
  first,
  selected = false,
  lead,
  trail,
  children,
}: {
  width: number;
  first: boolean;
  selected?: boolean;
  lead?: Swipe;
  trail?: Swipe;
  children: ReactNode;
}) {
  return (
    <SwipeActions
      modifiers={[
        ...listRow(width, { top: !first }),
        ...(selected ? [listRowBackground(theme.surfaceSelected)] : []),
      ]}
    >
      {children}
      {lead ? (
        <SwipeActions.Actions edge="leading">
          <Button
            label={lead.label}
            systemImage="checkmark"
            onPress={lead.onPress}
            modifiers={[tint(theme.accentSolid)]}
          />
        </SwipeActions.Actions>
      ) : null}
      {trail ? (
        <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
          <Button
            label={trail.label}
            systemImage="arrow.up.right"
            onPress={trail.onPress}
            modifiers={[tint(PLACE_COLOR[trail.place ?? 'server'])]}
          />
        </SwipeActions.Actions>
      ) : null}
    </SwipeActions>
  );
}

// The frame every row shares: its mark, its line in its own words, when and where, and whatever it
// lets you do right there under it. One size; the line in text and the rest quieter.
function Shell({
  mark,
  line,
  time,
  meta,
  place,
  label,
  onPress,
  children,
}: {
  mark: MarkState;
  line: string;
  time: string;
  meta?: string;
  place: Place;
  label: string;
  onPress?: () => void;
  children?: ReactNode;
}) {
  return (
    <Row
      alignment="start"
      spacing={GAP}
      onPress={onPress}
      modifiers={[
        padding({ leading: LEADING, trailing: TRAILING, top: 11, bottom: 12 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
        ...(ios ? [accessibilityLabel(label)] : []),
      ]}
    >
      <Column alignment="center" spacing={0} modifiers={[padding({ top: 2 })]}>
        <Mark state={mark} />
      </Column>
      <Column
        alignment="start"
        spacing={0}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Row alignment="start" spacing={10} modifiers={[frame({ maxWidth: Infinity })]}>
          <Text
            numberOfLines={2}
            textStyle={{ fontSize: 15, lineHeight: 20 }}
            modifiers={[
              foregroundStyle(theme.text),
              frame({ maxWidth: Infinity, alignment: 'leading' }),
            ]}
          >
            {line}
          </Text>
          <Row alignment="center" spacing={7} modifiers={[padding({ top: 1 })]}>
            {meta ? <Meta text={meta} /> : null}
            <Meta text={time} />
            <PlaceTile place={place} size={14} />
          </Row>
        </Row>
        {children}
      </Column>
    </Row>
  );
}

function Meta({ text }: { text: string }) {
  return (
    <Text
      numberOfLines={1}
      textStyle={{ fontSize: 13 }}
      modifiers={[foregroundStyle(theme.tertiary)]}
    >
      {text}
    </Text>
  );
}

// An ask's choices in its row: words you tap, hex's pick in mint with its check, a hairline rule
// between each, and an arrow on one that opens a page.
function Choices({ ask, onAnswer }: { ask: Ask; onAnswer: (ask: Ask, option: AskOption) => void }) {
  return (
    <Row alignment="center" spacing={14} modifiers={[padding({ top: 4 })]}>
      {ask.options.map((option, i) => (
        <Row key={option.label} alignment="center" spacing={14}>
          {i ? (
            <Rectangle modifiers={[frame({ width: 1, height: 14 }), foregroundStyle(theme.edge)]} />
          ) : null}
          <Row
            alignment="center"
            spacing={5}
            onPress={() => onAnswer(ask, option)}
            modifiers={[
              padding({ top: 6, bottom: 4 }),
              contentShape(shapes.rectangle()),
              ...(ios
                ? [accessibilityLabel(option.pick ? `${option.label}, hex’s pick` : option.label)]
                : []),
            ]}
          >
            {option.pick ? <Icon name="checkmark" size={12} color={theme.accent} /> : null}
            <Text
              numberOfLines={1}
              textStyle={{ fontSize: 15, fontWeight: option.pick ? '600' : '500' }}
              modifiers={[foregroundStyle(option.pick ? theme.accent : theme.text)]}
            >
              {option.label}
            </Text>
            {option.url ? <Icon name="arrow.up.right" size={11} color={theme.secondary} /> : null}
          </Row>
        </Row>
      ))}
    </Row>
  );
}

function Action({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Text
      onPress={onPress}
      textStyle={{ fontSize: 15, fontWeight: '600' }}
      modifiers={[
        foregroundStyle(onPress ? theme.accent : theme.tertiary),
        padding({ top: 8, bottom: 2 }),
      ]}
    >
      {label}
    </Text>
  );
}

// An ask answered here, folded to what you said and where it went, with Undo, until Tasks closes.
function Folded({
  ask,
  label,
  width,
  first,
  onUndo,
}: {
  ask: Ask;
  label: string;
  width: number;
  first: boolean;
  onUndo: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={GAP}
      modifiers={[
        padding({ leading: LEADING, trailing: INSET, top: 11, bottom: 12 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        ...listRow(width, { top: !first }),
      ]}
    >
      <Mark state="done" />
      <Column
        alignment="start"
        spacing={1}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 15 }}
          modifiers={[foregroundStyle(theme.secondary)]}
        >
          {ask.question}
        </Text>
        <Text
          numberOfLines={2}
          textStyle={{ fontSize: 15 }}
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

// A topic with nothing going, in Quiet: its name and its last line, one size, the line a step
// quieter. It opens the topic.
export function QuietRow({
  topic,
  width,
  onOpen,
}: {
  topic: Topic;
  width: number;
  onOpen: (task: string, entry: string) => void;
}) {
  const [entry] = topic.entries;
  if (entry?.kind !== 'task') return null;
  return (
    <Row
      alignment="start"
      spacing={GAP}
      onPress={() => onOpen(entry.task.id, entry.id)}
      modifiers={[
        padding({ leading: LEADING, trailing: TRAILING, top: 11, bottom: 12 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
        ...listRow(width),
        ...(ios ? [accessibilityLabel(`${topic.name}, quiet: ${entry.task.line}`)] : []),
      ]}
    >
      <Column alignment="center" spacing={0} modifiers={[padding({ top: 2 })]}>
        <Mark state="idle" />
      </Column>
      <Column
        alignment="start"
        spacing={1}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 15, fontWeight: '500' }}
          modifiers={[foregroundStyle(theme.text), layoutPriority(1)]}
        >
          {topic.name}
        </Text>
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 15 }}
          modifiers={[foregroundStyle(theme.secondary)]}
        >
          {entry.task.line || STATE_WORDS[entry.task.state]}
        </Text>
      </Column>
      <Row alignment="center" spacing={7} modifiers={[padding({ top: 1 })]}>
        <Meta text={taskTime(entry.task)} />
        <PlaceTile place={entry.place} size={14} />
      </Row>
    </Row>
  );
}
