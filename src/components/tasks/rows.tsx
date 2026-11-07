import { Column, Row, Spacer } from '@expo/ui';
import { Button, HStack, SwipeActions } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  clipShape,
  frame,
  layoutPriority,
  monospacedDigit,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';

import { InlineAnswers, Unreached } from '@/components/tasks/ask-card';
import { Mark, type MarkState } from '@/components/tasks/mark';
import { Failure, NotNeededButton, Pill, listRow, rowFrame } from '@/components/tasks/parts';
import { TileIcon, swipeLook } from '@/components/tasks/places';
import type { Ask, AskOption } from '@/live/asks';
import {
  PLACES,
  STUCK,
  fitsOneLine,
  headlineOf,
  opens,
  type Entry,
  type Stage,
  type Tile,
  type Topic,
  type PageId,
} from '@/live/inbox';
import { STATE_WORDS, atWork, clock, taskTime } from '@/live/tasks';
import { theme } from '@/theme';
import { Text } from '@/ui/text';
import { metrics, space } from '@/ui/tokens';

export type RowActions = {
  width: number;
  selected?: string | null;
  answered: Record<string, string | null>;
  onOpen: (task: PageId, entry: string) => void;
  onOpenTile: (tile: Tile) => void;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onUndo: (ask: Ask) => void;
  onDismiss: (ask: Ask) => void;
  onAgain: (ask: Ask) => void;
  onAct: (id: string) => void;
  onRead: (id: string) => void;
};

// The room an ask's choices have under its line.
const choicesWidth = (width: number) =>
  width - 2 * metrics.list.inset - metrics.list.mark - metrics.list.gap;

export function EntryRow({ entry, ...actions }: { entry: Entry } & RowActions) {
  const selected = actions.selected === entry.id;
  const swiped = {
    width: actions.width,
    trail: entry.tiles.filter(opens),
    onTile: actions.onOpenTile,
  };
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
            onUndo={() => actions.onUndo(ask)}
            onAgain={() => actions.onAgain(ask)}
          />
        );
      const pick = ask.options.find((option) => option.pick);
      const inline =
        ask.options.length > 0 && fitsOneLine(ask.options, choicesWidth(actions.width));
      return (
        <Swiped
          {...swiped}
          lead={pick && { label: pick.label, onPress: () => actions.onAnswer(ask, pick) }}
          onAway={() => actions.onDismiss(ask)}
        >
          <Shell
            selected={selected}
            mark="needs"
            line={ask.question}
            time={clock(new Date(entry.at))}
            tiles={entry.tiles}
            label={`${entry.topic} asks: ${ask.question}`}
            onPress={() => actions.onOpen(ask.task, entry.id)}
          >
            {inline ? (
              <InlineAnswers
                ask={ask}
                onAnswer={actions.onAnswer}
                modifiers={[padding({ top: space[1] })]}
              />
            ) : null}
            {ask.failed ? <Failure text={ask.failed} /> : null}
          </Shell>
        </Swiped>
      );
    }
    case 'task': {
      const { task } = entry;
      const agents = task.state === 'working' ? atWork(task.agents).length : 0;
      const mark: MarkState = task.state === 'done' ? 'read' : task.state;
      return (
        <Swiped {...swiped}>
          <Shell
            selected={selected}
            mark={mark}
            line={task.line || STATE_WORDS[task.state]}
            time={taskTime(task)}
            meta={agents ? `${agents} agent${agents === 1 ? '' : 's'}` : undefined}
            tiles={entry.tiles}
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
        <Swiped {...swiped} lead={act && { label: stuck.action, onPress: act }}>
          <Shell
            selected={selected}
            mark={stuck.mark}
            line={stuck.title}
            time={clock(new Date(entry.at))}
            tiles={entry.tiles}
            label={`${STUCK}: ${stuck.title}. ${stuck.why}`}
          >
            {stuck.why ? <Why text={stuck.why} /> : null}
            <Action label={stuck.sent ? 'Sent to hex' : stuck.action} onPress={act} />
            {stuck.failed ? <Failure text={stuck.failed} /> : null}
          </Shell>
        </Swiped>
      );
    }
    case 'fresh': {
      const { fresh } = entry;
      const read = fresh.read ? undefined : () => actions.onRead(fresh.id);
      return (
        <Swiped {...swiped} lead={read && { label: 'Read', onPress: read }}>
          <Shell
            selected={selected}
            mark={fresh.read ? 'read' : 'done'}
            line={`${fresh.title}: ${fresh.line}`}
            time={clock(new Date(entry.at))}
            tiles={entry.tiles}
            label={`${fresh.title}, finished: ${fresh.line}`}
          >
            {read ? <Action label="Mark read" onPress={read} /> : null}
            {fresh.failed ? <Failure text={fresh.failed} /> : null}
          </Shell>
        </Swiped>
      );
    }
  }
}

type Swipe = { label: string; onPress: () => void };

function Swiped({
  width,
  lead,
  onAway,
  trail,
  onTile,
  children,
}: {
  width: number;
  lead?: Swipe;
  onAway?: () => void;
  trail: Tile[];
  onTile: (tile: Tile) => void;
  children: ReactNode;
}) {
  return (
    <SwipeActions modifiers={listRow(width)}>
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
      {onAway || trail.length ? (
        <SwipeActions.Actions edge="trailing" allowsFullSwipe={!!onAway}>
          {onAway ? <NotNeededButton onPress={onAway} /> : null}
          {/* SwiftUI lays trailing actions out from the edge in, so the first place goes last. */}
          {[...trail].reverse().map((tile, i) => {
            const { color, glyph } = swipeLook(tile);
            return (
              <Button
                key={i}
                label={tile.label}
                systemImage={glyph}
                onPress={() => onTile(tile)}
                modifiers={[tint(color)]}
              />
            );
          })}
        </SwipeActions.Actions>
      ) : null}
    </SwipeActions>
  );
}

function Shell({
  selected,
  mark,
  line,
  time,
  meta,
  tiles,
  label,
  onPress,
  children,
}: {
  selected: boolean;
  mark: MarkState;
  line: string;
  time: string;
  meta?: string;
  tiles: Tile[];
  label: string;
  onPress?: () => void;
  children?: ReactNode;
}) {
  return (
    <Row
      alignment="start"
      spacing={metrics.list.gap}
      onPress={onPress}
      modifiers={[...rowFrame(selected), accessibilityLabel(label)]}
    >
      <Mark state={mark} />
      <Column
        alignment="start"
        spacing={space[1]}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <HStack
          alignment="firstTextBaseline"
          spacing={space[3]}
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          <Text
            numberOfLines={3}
            variant="body"
            paragraph
            modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
          >
            {line}
          </Text>
          <Row alignment="center" spacing={metrics.list.meta}>
            {meta ? <Meta text={meta} /> : null}
            <Meta text={time} />
            <Tiles tiles={tiles} />
          </Row>
        </HStack>
        {children}
      </Column>
    </Row>
  );
}

// Where a row lives, one tile per look: two Telegram threads show as one Telegram tile, and the
// row's swipe still opens each.
function Tiles({ tiles }: { tiles: Tile[] }) {
  const looks = new Map(tiles.map((tile) => [lookOf(tile), tile]));
  return (
    <Row alignment="center" spacing={space[1]}>
      {[...looks].map(([look, tile]) => (
        <TileIcon key={look} tile={tile} size={metrics.symbol.small} />
      ))}
    </Row>
  );
}

const lookOf = (tile: Tile) => (tile.kind === 'app' ? `${tile.place}:${opens(tile)}` : tile.kind);

function Meta({ text }: { text: string }) {
  return (
    <Text numberOfLines={1} variant="caption" tone="tertiary">
      {text}
    </Text>
  );
}

// Why something is stuck, under what it is.
function Why({ text }: { text: string }) {
  return (
    <Text numberOfLines={3} variant="detail" tone="secondary" paragraph>
      {text}
    </Text>
  );
}

function Action({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Row alignment="center" spacing={0} modifiers={[padding({ top: space[2] })]}>
      <Pill label={label} onPress={onPress} small />
    </Row>
  );
}

function Folded({
  ask,
  label,
  width,
  onUndo,
  onAgain,
}: {
  ask: Ask;
  label: string;
  width: number;
  onUndo: () => void;
  onAgain: () => void;
}) {
  return (
    <Row
      alignment="start"
      spacing={metrics.list.gap}
      modifiers={[...rowFrame(false), ...listRow(width)]}
    >
      <Mark state="done" />
      <Column
        alignment="start"
        spacing={space[1]}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text numberOfLines={2} variant="detail" tone="secondary">
          {ask.question}
        </Text>
        <Text numberOfLines={2} variant="body">
          {`${label} → ${ask.topic}`}
        </Text>
        {ask.missed ? <Unreached missed={ask.missed} onAgain={onAgain} /> : null}
        {ask.failed ? <Failure text={ask.failed} /> : null}
      </Column>
      <Pill label="Undo" accessibility={`Undo ${label}`} onPress={onUndo} small />
    </Row>
  );
}

const STAGE_WORDS: Record<Exclude<Stage, 'needs'>, string> = {
  working: 'working',
  done: 'done',
  quiet: 'quiet',
};

const STAGE_MARK: Record<Stage, MarkState> = {
  needs: 'needs',
  working: 'working',
  done: 'done',
  quiet: 'idle',
};

// A project as one row in the list, as Muse lists goals: its mark, its name, and the newest thing
// in it in gray, as many lines as it needs to be read; how many it has here and when, quietly to
// the side. Opens its page.
export function ProjectRow({
  topic,
  stage,
  width,
  selected,
  onOpen,
}: {
  topic: Topic;
  stage: Stage;
  width: number;
  selected: boolean;
  onOpen: () => void;
}) {
  const [newest] = [...topic.entries].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (!newest) return null;
  const count = topic.entries.length;
  const headline = headlineOf(newest);
  const needs = stage === 'needs';
  const counted = `${count} ${needs ? 'waiting' : STAGE_WORDS[stage]}`;
  const mark = newest.kind === 'stuck' ? newest.stuck.mark : STAGE_MARK[stage];
  return (
    <Row
      alignment="start"
      spacing={metrics.list.gap}
      onPress={onOpen}
      testID="project-row"
      modifiers={[
        ...rowFrame(selected),
        ...listRow(width),
        accessibilityLabel(`${topic.name}, ${counted}: ${headline}. Opens it`),
      ]}
    >
      <Mark state={mark} />
      <Column
        alignment="start"
        spacing={space[1]}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <HStack
          alignment="firstTextBaseline"
          spacing={space[2]}
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          <Text numberOfLines={1} variant="headline" modifiers={[layoutPriority(1)]}>
            {topic.name}
          </Text>
          {count > 1 ? <Count count={count} needs={needs} /> : null}
          <Spacer flexible />
          <Meta text={clock(new Date(newest.at))} />
        </HStack>
        {headline === topic.name ? null : (
          <Text
            numberOfLines={3}
            variant="detail"
            tone="secondary"
            paragraph
            modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
          >
            {headline}
          </Text>
        )}
      </Column>
    </Row>
  );
}

// How many a project has here: in mint while they wait on you, in gray otherwise.
function Count({ count, needs }: { count: number; needs: boolean }) {
  return (
    <Text
      variant="caption"
      weight="medium"
      tone={needs ? 'accent' : 'tertiary'}
      modifiers={[
        monospacedDigit(),
        padding({ leading: space[2], trailing: space[2], top: space[0.5], bottom: space[0.5] }),
        ...(needs ? [background(theme.accentMuted)] : []),
        clipShape('capsule'),
      ]}
    >
      {String(count)}
    </Text>
  );
}
