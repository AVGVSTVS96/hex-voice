import { Column, Row, Spacer } from '@expo/ui';
import { Button, HStack, SwipeActions } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  contentShape,
  frame,
  layoutPriority,
  monospacedDigit,
  padding,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';

import { InlineAnswers, Unreached } from '@/components/tasks/ask-card';
import { Lane, laneWidth } from '@/components/tasks/lane';
import { Mark, type MarkState } from '@/components/tasks/mark';
import { Failure, listRow } from '@/components/tasks/parts';
import { TileIcon, swipeLook } from '@/components/tasks/places';
import { NOT_NEEDED, type Ask, type AskOption } from '@/live/asks';
import {
  PLACES,
  STUCK,
  fitsOneLine,
  headlineOf,
  opens,
  proofWords,
  type Entry,
  type Stage,
  type Tile,
  type Topic,
  type PageId,
} from '@/live/inbox';
import { STATE_WORDS, atWork, clock, doneAt, taskTime, type Turn } from '@/live/tasks';
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
const LEADING = metrics.list.inset - space[0.5];
const TRAILING = metrics.list.inset - space[1];
const choicesWidth = (width: number) =>
  width - LEADING - metrics.list.mark - metrics.list.gap - TRAILING;

export function EntryRow({
  entry,
  first,
  ...actions
}: { entry: Entry; first: boolean } & RowActions) {
  const selected = actions.selected === entry.id;
  const swiped = {
    width: actions.width,
    first,
    selected,
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
            first={first}
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
          away={{ label: NOT_NEEDED, onPress: () => actions.onDismiss(ask) }}
        >
          <Shell
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
    case 'finished': {
      const { finished } = entry;
      const proof = proofWords(finished.proof);
      const page = entry.tiles.find((tile) => tile.kind === 'link');
      return (
        <Swiped {...swiped}>
          <Shell
            mark="done"
            line={finished.title}
            time={doneAt(entry.at)}
            tiles={entry.tiles}
            label={`${finished.title}, done${proof ? `: ${proof}` : ''}${page ? `. Opens ${page.label}` : ''}`}
            onPress={page && (() => actions.onOpenTile(page))}
          >
            {proof ? <Why text={proof} /> : null}
          </Shell>
        </Swiped>
      );
    }
  }
}

type Swipe = { label: string; onPress: () => void };

function Swiped({
  width,
  first,
  selected,
  lead,
  away,
  trail,
  onTile,
  children,
}: {
  width: number;
  first: boolean;
  selected: boolean;
  lead?: Swipe;
  // Puts it away without an answer, at the trailing edge, where iOS puts the one that clears a row.
  away?: Swipe;
  trail: Tile[];
  onTile: (tile: Tile) => void;
  children: ReactNode;
}) {
  return (
    <SwipeActions modifiers={[...listRow(width, { top: !first, selected })]}>
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
      {away || trail.length ? (
        <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
          {away ? (
            <Button
              label={away.label}
              systemImage="xmark"
              onPress={away.onPress}
              modifiers={[tint(theme.secondary)]}
            />
          ) : null}
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
  mark,
  line,
  time,
  meta,
  tiles,
  label,
  onPress,
  children,
}: {
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
      modifiers={[
        padding({
          leading: LEADING,
          trailing: TRAILING,
          top: metrics.list.row.top,
          bottom: metrics.list.row.bottom,
        }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
        accessibilityLabel(label),
      ]}
    >
      <Column alignment="center" spacing={0} modifiers={[padding({ top: space[0.5] })]}>
        <Mark state={mark} />
      </Column>
      <Column
        alignment="start"
        spacing={0}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <HStack
          alignment="firstTextBaseline"
          spacing={space[3]}
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          <Text
            numberOfLines={2}
            variant="detail"
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

// Why something is stuck, or what showed a task done, under what it is.
function Why({ text }: { text: string }) {
  return (
    <Text
      numberOfLines={3}
      variant="detail"
      tone="secondary"
      paragraph
      modifiers={[padding({ top: space[0.5] })]}
    >
      {text}
    </Text>
  );
}

function Action({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Text
      onPress={onPress}
      variant="detail"
      weight="semibold"
      tone={onPress ? 'accent' : 'tertiary'}
      modifiers={[padding({ top: space[2], bottom: space[0.5] })]}
    >
      {label}
    </Text>
  );
}

function Folded({
  ask,
  label,
  width,
  first,
  onUndo,
  onAgain,
}: {
  ask: Ask;
  label: string;
  width: number;
  first: boolean;
  onUndo: () => void;
  onAgain: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={metrics.list.gap}
      modifiers={[
        padding({
          leading: LEADING,
          trailing: metrics.list.inset,
          top: metrics.list.row.top,
          bottom: metrics.list.row.bottom,
        }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        ...listRow(width, { top: !first }),
      ]}
    >
      <Mark state="done" />
      <Column
        alignment="start"
        spacing={space[0.5]}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text numberOfLines={1} variant="detail" tone="secondary">
          {ask.question}
        </Text>
        <Text numberOfLines={2} variant="detail">
          {`${label} → ${ask.topic}`}
        </Text>
        {ask.missed ? <Unreached missed={ask.missed} onAgain={onAgain} /> : null}
        {ask.failed ? <Failure text={ask.failed} /> : null}
      </Column>
      <Text
        variant="detail"
        weight="semibold"
        tone="accent"
        onPress={onUndo}
        modifiers={[
          padding({ leading: space[2], top: space[2], bottom: space[2] }),
          accessibilityLabel(`Undo ${label}`),
        ]}
      >
        Undo
      </Text>
    </Row>
  );
}

const STAGE_WORDS: Record<Exclude<Stage, 'needs'>, string> = {
  working: 'working',
  done: 'done',
  quiet: 'quiet',
};

// A project as one row in the list: its name, its week on a lane, how many it has in the stage
// shown or that a search found, then the newest of them. Opens its page.
export function ProjectRow({
  topic,
  stage,
  tracks,
  now,
  width,
  selected,
  onOpen,
}: {
  topic: Topic;
  // Searching, it counts what was found, in every stage.
  stage?: Stage;
  tracks: Turn[][];
  now: number;
  width: number;
  selected: boolean;
  onOpen: () => void;
}) {
  const [newest] = [...topic.entries].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (!newest) return null;
  const { count } = topic;
  const headline = headlineOf(newest);
  const counted = `${count} ${!stage ? 'found' : stage === 'needs' ? 'waiting' : STAGE_WORDS[stage]}`;
  return (
    <Column
      alignment="start"
      spacing={space[0.5]}
      onPress={onOpen}
      testID="project-row"
      modifiers={[
        padding({
          leading: metrics.list.inset,
          trailing: TRAILING,
          top: metrics.list.row.top,
          bottom: metrics.list.row.bottom,
        }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
        ...listRow(width, { top: false, bottom: false, selected }),
        accessibilityLabel(`${topic.name}, ${counted}: ${headline}. Opens it`),
      ]}
    >
      <Row alignment="center" spacing={space[3]} modifiers={[frame({ maxWidth: Infinity })]}>
        <Text numberOfLines={1} variant="headline" modifiers={[layoutPriority(1)]}>
          {topic.name}
        </Text>
        <Spacer flexible />
        {tracks.length ? <Lane tracks={tracks} width={laneWidth(width)} now={now} /> : null}
        <Text
          variant="detail"
          tone="secondary"
          modifiers={[monospacedDigit(), frame({ minWidth: 22, alignment: 'trailing' })]}
        >
          {String(count)}
        </Text>
      </Row>
      {headline === topic.name ? null : (
        <Text
          numberOfLines={1}
          variant="detail"
          tone="secondary"
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          {headline}
        </Text>
      )}
    </Column>
  );
}

// Something done in the last day, as its own row in Done whatever its project is doing elsewhere:
// what was done, then the project, or the app when the project is only its name, and when. Opens
// the project's page.
export function DoneRow({
  entry,
  width,
  selected,
  onOpen,
}: {
  entry: Entry;
  width: number;
  selected: boolean;
  onOpen: () => void;
}) {
  const line = headlineOf(entry);
  const when = doneAt(entry.at);
  const where = entry.topic === line ? PLACES[entry.place] : entry.topic;
  return (
    <Column
      alignment="start"
      spacing={space[0.5]}
      onPress={onOpen}
      testID="done-row"
      modifiers={[
        padding({
          leading: metrics.list.inset,
          trailing: TRAILING,
          top: metrics.list.row.top,
          bottom: metrics.list.row.bottom,
        }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
        ...listRow(width, { top: false, bottom: false, selected }),
        accessibilityLabel(`${line}. Done in ${where}, ${when}. Opens it`),
      ]}
    >
      <Text
        numberOfLines={2}
        variant="headline"
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        {line}
      </Text>
      <Text
        numberOfLines={1}
        variant="detail"
        tone="secondary"
        modifiers={[monospacedDigit(), frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        {`${where} · ${when}`}
      </Text>
    </Column>
  );
}
