import { Column, Row, Spacer } from "@expo/ui";
import { Button, HStack, SwipeActions, Text as NativeText } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  background,
  clipShape,
  frame,
  layoutPriority,
  lineLimit,
  monospacedDigit,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";

import { InlineAnswers, Unreached } from "@/components/tasks/ask-card";
import { Mark } from "@/components/tasks/mark";
import type { MarkState } from "@/components/tasks/mark";
import { Failure, NotNeededButton, Pill, listRow, rowFrame } from "@/components/tasks/parts";
import { TileIcon, swipeLook } from "@/components/tasks/places";
import type { Ask, AskOption } from "@/live/asks";
import { PLACES, STUCK, headlineOf, problemOf, opens, pageOf, proofWords } from "@/live/inbox";
import type { Entry, Part, Stage, Tile, Topic, PageId } from "@/live/inbox";
import { STATE_WORDS, atWork, clock, taskTime } from "@/live/tasks";
import type { TaskRow } from "@/live/tasks";
import { theme } from "@/theme";
import { Text, textLook } from "@/ui/text";
import { metrics, space } from "@/ui/tokens";

import { Fits } from "../../../modules/rows";

export interface RowActions {
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
}

export const EntryRow = ({
  entry,
  why,
  ...actions
}: { entry: Entry; why?: Part[] | undefined } & RowActions) => {
  const selected = actions.selected === entry.id;

  const swiped = {
    trail: entry.tiles.filter(opens),
    onTile: actions.onOpenTile,
  };

  switch (entry.kind) {
    case "ask": {
      return (
        <AskRow
          entry={entry}
          ask={entry.ask}
          why={why}
          selected={selected}
          swiped={swiped}
          actions={actions}
        />
      );
    }

    case "task": {
      const { task } = entry;
      const mark: MarkState = task.state === "done" ? "read" : task.state;

      return (
        <Swiped {...swiped}>
          <Shell
            selected={selected}
            why={why}
            mark={mark}
            line={task.line || STATE_WORDS[task.state]}
            time={taskTime(task)}
            meta={agentsAtWork(task)}
            tiles={entry.tiles}
            label={`${task.name}, ${PLACES[entry.place]}, ${STATE_WORDS[task.state]}: ${task.line}`}
            onPress={() => {
              actions.onOpen(task.id, entry.id);
            }}
          />
        </Swiped>
      );
    }

    case "stuck": {
      const { stuck } = entry;

      const sent = stuck.sent !== undefined && stuck.sent !== "";

      const act = sent
        ? undefined
        : () => {
            actions.onAct(stuck.id);
          };

      return (
        <Swiped {...swiped} lead={act && { label: stuck.action, onPress: act }}>
          <Shell
            selected={selected}
            why={why}
            mark={stuck.mark}
            line={stuck.title}
            time={clock(new Date(entry.at))}
            tiles={entry.tiles}
            label={`${STUCK}: ${stuck.title}. ${stuck.why}`}
          >
            {stuck.why ? <Why text={stuck.why} /> : null}
            <Action label={sent ? "Sent to hex" : stuck.action} onPress={act} />
            <Failure text={stuck.failed} />
          </Shell>
        </Swiped>
      );
    }

    case "fresh": {
      const { fresh } = entry;

      const read = fresh.read
        ? undefined
        : () => {
            actions.onRead(fresh.id);
          };

      return (
        <Swiped {...swiped} lead={read && { label: "Read", onPress: read }}>
          <Shell
            selected={selected}
            why={why}
            mark={fresh.read ? "read" : "done"}
            line={`${fresh.title}: ${fresh.line}`}
            time={clock(new Date(entry.at))}
            tiles={entry.tiles}
            label={`${fresh.title}, finished: ${fresh.line}`}
          >
            {read ? <Action label="Mark read" onPress={read} /> : null}
            <Failure text={fresh.failed} />
          </Shell>
        </Swiped>
      );
    }

    case "finished": {
      const { finished } = entry;
      const proof = proofWords(finished.proof);

      return (
        <Swiped {...swiped}>
          <Shell
            selected={selected}
            why={why}
            mark="done"
            line={finished.title}
            time={clock(new Date(entry.at))}
            tiles={entry.tiles}
            label={`${finished.title}, done${proof ? `: ${proof}` : ""}. Opens it`}
            onPress={() => {
              actions.onOpen(pageOf({ name: entry.topic, entries: [entry], marks: [] }), entry.id);
            }}
          >
            {proof ? <Why text={proof} /> : null}
          </Shell>
        </Swiped>
      );
    }

    default: {
      return entry satisfies never;
    }
  }
};

const agentsAtWork = (task: TaskRow) => {
  const n = task.state === "working" ? atWork(task.agents).length : 0;

  return n ? `${n} agent${n === 1 ? "" : "s"}` : undefined;
};

const AskRow = ({
  entry,
  ask,
  why,
  selected,
  swiped,
  actions,
}: {
  entry: Entry;
  ask: Ask;
  why?: Part[] | undefined;
  selected: boolean;
  swiped: { trail: Tile[]; onTile: (tile: Tile) => void };
  actions: RowActions;
}) => {
  const said = actions.answered[ask.id] ?? "";

  if (said !== "") {
    return (
      <Folded
        ask={ask}
        label={said}
        onUndo={() => {
          actions.onUndo(ask);
        }}
        onAgain={() => {
          actions.onAgain(ask);
        }}
      />
    );
  }

  const pick = ask.options.find((option) => option.pick === true);

  return (
    <Swiped
      {...swiped}
      lead={
        pick && {
          label: pick.label,
          onPress: () => {
            actions.onAnswer(ask, pick);
          },
        }
      }
      onAway={() => {
        actions.onDismiss(ask);
      }}
    >
      <Shell
        selected={selected}
        why={why}
        mark={pick ? "pick" : "asks"}
        line={ask.question}
        time={clock(new Date(entry.at))}
        tiles={entry.tiles}
        label={`${entry.topic} asks: ${ask.question}`}
        onPress={() => {
          actions.onOpen(ask.task, entry.id);
        }}
      >
        {ask.options.length > 0 ? (
          <Fits>
            <InlineAnswers
              ask={ask}
              onAnswer={actions.onAnswer}
              modifiers={[padding({ top: space[1] })]}
            />
          </Fits>
        ) : null}
        <Failure text={ask.failed} />
      </Shell>
    </Swiped>
  );
};

interface Swipe {
  label: string;
  onPress: () => void;
}

const Swiped = ({
  lead,
  onAway,
  trail,
  onTile,
  children,
}: {
  lead?: Swipe | undefined;
  onAway?: () => void;
  trail: Tile[];
  onTile: (tile: Tile) => void;
  children: ReactNode;
}) => (
  <SwipeActions modifiers={listRow()}>
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
        {/* SwiftUI lays actions out in the order listed from the swipe's edge in: https://developer.apple.com/documentation/swiftui/view/swipeactions(edge:allowsfullswipe:content:) */}
        {[...trail].reverse().map((tile, i) => {
          const { color, glyph } = swipeLook(tile);

          return (
            <Button
              key={i}
              label={tile.label}
              systemImage={glyph}
              onPress={() => {
                onTile(tile);
              }}
              modifiers={[tint(color)]}
            />
          );
        })}
      </SwipeActions.Actions>
    ) : null}
  </SwipeActions>
);

const Shell = ({
  selected,
  mark,
  line,
  time,
  meta,
  tiles,
  label,
  why,
  onPress,
  children,
}: {
  selected: boolean;
  mark: MarkState;
  line: string;
  time: string;
  meta?: string | undefined;
  tiles: Tile[];
  label: string;
  why?: Part[] | undefined;
  onPress?: () => void;
  children?: ReactNode;
}) => (
  <Row
    alignment="start"
    spacing={metrics.list.gap}
    {...(onPress && { onPress })}
    modifiers={[...rowFrame(selected), accessibilityLabel(label)]}
  >
    <Mark state={mark} />
    <Column
      alignment="start"
      spacing={space[1]}
      modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
    >
      <HStack
        alignment="firstTextBaseline"
        spacing={space[3]}
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        <Text
          numberOfLines={2}
          variant="body"
          paragraph
          modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
        >
          {line}
        </Text>
        <Row alignment="center" spacing={metrics.list.meta}>
          {meta === undefined ? null : <Meta text={meta} />}
          <Meta text={time} />
          <Tiles tiles={tiles} />
        </Row>
      </HStack>
      {why ? <Found parts={why} /> : null}
      {children}
    </Column>
  </Row>
);

const Tiles = ({ tiles }: { tiles: Tile[] }) => {
  const looks = new Map(tiles.map((tile) => [lookOf(tile), tile]));

  return (
    <Row alignment="center" spacing={space[1]}>
      {[...looks].map(([look, tile]) => (
        <TileIcon key={look} tile={tile} size={metrics.symbol.small} />
      ))}
    </Row>
  );
};

const lookOf = (tile: Tile) => (tile.kind === "app" ? `${tile.place}:${opens(tile)}` : tile.kind);

const Meta = ({ text }: { text: string }) => (
  <Text numberOfLines={1} variant="caption" tone="tertiary">
    {text}
  </Text>
);

const Why = ({ text }: { text: string }) => (
  <Text numberOfLines={2} variant="detail" tone="secondary" paragraph>
    {text}
  </Text>
);

const Action = ({ label, onPress }: { label: string; onPress?: (() => void) | undefined }) => (
  <Row alignment="center" spacing={0} modifiers={[padding({ top: space[2] })]}>
    <Pill label={label} onPress={onPress} small />
  </Row>
);

const Folded = ({
  ask,
  label,
  onUndo,
  onAgain,
}: {
  ask: Ask;
  label: string;
  onUndo: () => void;
  onAgain: () => void;
}) => (
  <Row alignment="start" spacing={metrics.list.gap} modifiers={[...rowFrame(false), ...listRow()]}>
    <Mark state="done" />
    <Column
      alignment="start"
      spacing={space[1]}
      modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
    >
      <Text numberOfLines={2} variant="detail" tone="secondary">
        {ask.question}
      </Text>
      <Text numberOfLines={2} variant="body">
        {`${label} → ${ask.topic}`}
      </Text>
      {ask.missed === undefined ? null : <Unreached missed={ask.missed} onAgain={onAgain} />}
      <Failure text={ask.failed} />
    </Column>
    <Pill label="Undo" accessibility={`Undo ${label}`} onPress={onUndo} small />
  </Row>
);

const STAGE_WORDS: Record<Exclude<Stage, "needs">, string> = {
  working: "working",
  done: "done",
  quiet: "quiet",
};

const STAGE_MARK: Record<Stage, MarkState> = {
  needs: "needs",
  working: "working",
  done: "done",
  quiet: "idle",
};

export const ProjectRow = ({
  topic,
  selected,
  onOpen,
}: {
  topic: Topic;
  selected: boolean;
  onOpen: () => void;
}) => {
  const newest = [...topic.entries].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).at(0);

  if (newest === undefined) {
    return null;
  }

  const { stage } = newest;
  const count = topic.entries.length;
  const said = headlineOf(newest);
  const problem = problemOf(said);
  const headline = problem ?? said;
  const needs = stage === "needs";
  const counted = `${count} ${needs ? "waiting" : STAGE_WORDS[stage]}`;
  const settled = problem === undefined ? STAGE_MARK[stage] : "failed";
  const mark = needs ? waiting(newest) : settled;

  return (
    <Row
      alignment="start"
      spacing={metrics.list.gap}
      onPress={onOpen}
      testID="project-row"
      modifiers={[
        ...rowFrame(selected),
        ...listRow(),
        accessibilityLabel(`${topic.name}, ${counted}: ${headline}. Opens it`),
      ]}
    >
      <Mark state={mark} />
      <Column
        alignment="start"
        spacing={space[1]}
        modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
      >
        <HStack
          alignment="firstTextBaseline"
          spacing={space[2]}
          modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
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
            numberOfLines={2}
            variant="detail"
            tone={problem === undefined ? "secondary" : "danger"}
            paragraph
            modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
          >
            {headline}
          </Text>
        )}
      </Column>
    </Row>
  );
};

const waiting = (entry: Entry): MarkState => {
  switch (entry.kind) {
    case "ask": {
      return entry.ask.options.some((option) => option.pick === true) ? "pick" : "asks";
    }

    case "stuck": {
      return entry.stuck.mark;
    }

    case "task":
    case "fresh": {
      return "needs";
    }

    case "finished": {
      return "done";
    }

    default: {
      return entry satisfies never;
    }
  }
};

const Count = ({ count, needs }: { count: number; needs: boolean }) => (
  <Text
    variant="caption"
    weight="medium"
    tone={needs ? "accent" : "tertiary"}
    modifiers={[
      monospacedDigit(),
      padding({ leading: space[2], trailing: space[2], top: space[0.5], bottom: space[0.5] }),
      ...(needs ? [background(theme.accentMuted)] : []),
      clipShape("capsule"),
    ]}
  >
    {String(count)}
  </Text>
);

const newTextForNewPieces = (parts: Part[]) => parts.map((part) => part.text).join("\u0000");

const Found = ({ parts }: { parts: Part[] }) => (
  <NativeText
    key={newTextForNewPieces(parts)}
    modifiers={[...textLook({ variant: "detail", tone: "secondary" }), lineLimit(2)]}
  >
    {parts.map((part, at) =>
      part.hit ? (
        <NativeText key={at} modifiers={textLook({ variant: "detail", weight: "medium" })}>
          {part.text}
        </NativeText>
      ) : (
        part.text
      ),
    )}
  </NativeText>
);
