import { Column, Icon, Row, ScrollView, Spacer, Text, TextInput } from '@expo/ui';
import {
  Button,
  Capsule,
  Circle,
  ConfirmationDialog,
  Overlay,
  Rectangle,
  Text as NativeText,
} from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityLabel,
  background,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  contentShape,
  controlSize,
  foregroundStyle,
  frame,
  labelStyle,
  layoutPriority,
  monospacedDigit,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import { INSET, Lane, Mark, ios, laneWidth, listRow } from '@/components/tasks/parts';
import { checkLine, type Ask, type AskOption, type CheckSummary } from '@/live/asks';
import { STAGES, type Stage, type Topic } from '@/live/inbox';
import { theme } from '@/theme';

const MARKS = 6;

// The list's head: its title and search. The title sits on the toolbar's line where there is one
// beside it (`line`), and under the grabber in a sheet.
export function ListHead({ line, onSearch }: { line?: number; onSearch: () => void }) {
  return (
    <Row
      alignment="center"
      spacing={12}
      modifiers={[
        padding({
          leading: INSET,
          trailing: INSET - 4,
          top: line === undefined ? 22 : Math.max(8, line - 20),
          bottom: 12,
        }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Text
        numberOfLines={1}
        textStyle={{ fontSize: 28, fontWeight: '700' }}
        modifiers={[
          foregroundStyle(theme.text),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        Tasks
      </Text>
      <Button
        label="Search"
        systemImage="magnifyingglass"
        onPress={onSearch}
        testID="tasks-search"
        modifiers={[
          labelStyle('iconOnly'),
          buttonStyle('glass'),
          buttonBorderShape('circle'),
          controlSize('regular'),
        ]}
      />
    </Row>
  );
}

// The stages as tabs, each with its count: words, the chosen one in text with a mint rule under it
// that sits on the line across the list. What needs you counts in mint whichever tab is open.
export function Tabs({
  counts,
  stage,
  offline,
  onChange,
}: {
  counts: Record<Stage, number>;
  stage: Stage;
  offline: boolean;
  onChange: (stage: Stage) => void;
}) {
  return (
    <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      <ScrollView
        direction="horizontal"
        showsIndicators={false}
        modifiers={[frame({ maxWidth: Infinity })]}
      >
        <Row
          alignment="end"
          spacing={20}
          modifiers={[padding({ leading: INSET, trailing: INSET })]}
        >
          {STAGES.map(({ key, title }) => {
            const on = key === stage;
            const count = counts[key];
            const needs = key === 'needs' && count > 0;
            return (
              <Overlay key={key} alignment="bottom">
                <Row
                  alignment="center"
                  spacing={5}
                  onPress={() => onChange(key)}
                  modifiers={[
                    padding({ bottom: 11 }),
                    contentShape(shapes.rectangle()),
                    ...(ios
                      ? [
                          accessibilityLabel(`${title}, ${count}`),
                          ...(on ? [accessibilityAddTraits(['isSelected'])] : []),
                        ]
                      : []),
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    textStyle={{ fontSize: 15, fontWeight: on ? '600' : '500' }}
                    modifiers={[foregroundStyle(on ? theme.text : theme.secondary)]}
                  >
                    {title}
                  </Text>
                  <Text
                    textStyle={{ fontSize: 15, fontWeight: on || needs ? '600' : '500' }}
                    modifiers={[
                      monospacedDigit(),
                      foregroundStyle(needs ? theme.accent : on ? theme.text : theme.tertiary),
                    ]}
                  >
                    {offline ? '–' : String(count)}
                  </Text>
                </Row>
                {on ? (
                  <Overlay.Content>
                    <Capsule modifiers={[frame({ height: 2 }), foregroundStyle(theme.accent)]} />
                  </Overlay.Content>
                ) : null}
              </Overlay>
            );
          })}
        </Row>
      </ScrollView>
      <Rectangle
        modifiers={[
          frame({ height: 1 }),
          frame({ maxWidth: Infinity }),
          foregroundStyle(theme.edge),
        ]}
      />
    </Column>
  );
}

export function Search({
  query,
  onChange,
  onCancel,
}: {
  query: string;
  onChange: (query: string) => void;
  onCancel: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={12}
      modifiers={[
        padding({ leading: 16, trailing: INSET, top: 18, bottom: 10 }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Row
        alignment="center"
        spacing={8}
        modifiers={[
          padding({ leading: 12, trailing: 12 }),
          frame({ height: 40 }),
          frame({ maxWidth: Infinity }),
          background(theme.surface),
          clipShape('roundedRectangle', 12),
        ]}
      >
        <Icon name="magnifyingglass" size={14} color={theme.secondary} />
        <TextInput
          autoFocus
          defaultValue={query}
          placeholder="Tasks, topics, asks"
          placeholderTextColor={theme.tertiary}
          cursorColor={theme.accent}
          onChangeText={onChange}
          textStyle={{ fontSize: 16 }}
          modifiers={[
            foregroundStyle(theme.text),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        />
      </Row>
      <Text
        onPress={onCancel}
        textStyle={{ fontSize: 16, fontWeight: '500' }}
        modifiers={[foregroundStyle(theme.accent)]}
      >
        Cancel
      </Text>
    </Row>
  );
}

// A topic's head: its name, B's dots (one per thread, the most pressing first), and C's lane of its
// last 12 hours. It opens the topic's first thread.
export function TopicHead({
  topic,
  width,
  onPress,
}: {
  topic: Topic;
  width: number;
  onPress?: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={8}
      onPress={onPress}
      modifiers={[
        padding({ leading: INSET, trailing: INSET - 4, top: 14, bottom: 2 }),
        frame({ maxWidth: Infinity }),
        contentShape(shapes.rectangle()),
        ...listRow(width, { bottom: false }),
        ...(ios && onPress ? [accessibilityLabel(`${topic.name}. Opens it`)] : []),
      ]}
    >
      <Text
        numberOfLines={1}
        textStyle={{ fontSize: 15, fontWeight: '600' }}
        modifiers={[foregroundStyle(theme.text), layoutPriority(1)]}
      >
        {topic.name}
      </Text>
      {topic.marks.length ? <Dots marks={topic.marks} /> : null}
      <Spacer flexible />
      {topic.tracks.length ? <Lane tracks={topic.tracks} width={laneWidth(width)} /> : null}
      {onPress ? <Icon name="chevron.right" size={11} color={theme.tertiary} /> : null}
    </Row>
  );
}

// One small dot per thread: mint needs you, deep mint works, grey finished, faint quiet.
function Dots({ marks }: { marks: Stage[] }) {
  return (
    <Row alignment="center" spacing={3}>
      {marks.slice(0, MARKS).map((stage, i) => (
        <Circle
          key={i}
          modifiers={[
            frame({ width: 6, height: 6 }),
            foregroundStyle(
              stage === 'needs'
                ? theme.accent
                : stage === 'working'
                  ? theme.accentTrack
                  : stage === 'done'
                    ? theme.secondary
                    : theme.surfaceSelected,
            ),
          ]}
        />
      ))}
    </Row>
  );
}

// A plain row over the topics: its mark, what it says, and what it does on the right.
function Strip({
  width,
  mark,
  title,
  detail,
  action,
  label,
  onPress,
}: {
  width: number;
  mark: 'done' | 'read';
  title: string;
  detail?: string;
  action?: string;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={10}
      onPress={onPress}
      modifiers={[
        padding({ leading: INSET - 2, trailing: INSET, top: 12, bottom: 12 }),
        frame({ maxWidth: Infinity }),
        contentShape(shapes.rectangle()),
        ...listRow(width),
        ...(ios ? [accessibilityLabel(label)] : []),
      ]}
    >
      <Mark state={mark} />
      <Text
        numberOfLines={1}
        textStyle={{ fontSize: 15, fontWeight: '500' }}
        modifiers={[foregroundStyle(theme.text), layoutPriority(1)]}
      >
        {title}
      </Text>
      {detail ? (
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 15 }}
          modifiers={[foregroundStyle(theme.secondary)]}
        >
          {detail}
        </Text>
      ) : null}
      <Spacer flexible />
      {action ? (
        <Text
          textStyle={{ fontSize: 15, fontWeight: '600' }}
          modifiers={[foregroundStyle(theme.accent)]}
        >
          {action}
        </Text>
      ) : (
        <Icon name="chevron.right" size={11} color={theme.tertiary} />
      )}
    </Row>
  );
}

// "Checked 6:31pm · fixed 4 · flagged 3", opening what the check read, fixed and flagged.
export function CheckRow({
  check,
  width,
  onPress,
}: {
  check: CheckSummary;
  width: number;
  onPress: () => void;
}) {
  const { title, did } = checkLine(check);
  return (
    <Strip
      width={width}
      mark="read"
      title={title}
      detail={did}
      label={`${title}${did ? `, ${did}` : ''}. Opens the last check`}
      onPress={onPress}
    />
  );
}

// hex has a pick for several asks: take them all at once, each folding where it sits with Undo.
// It asks once more first, since it answers for you many times over.
export function PicksRow({
  picks,
  width,
  onTake,
}: {
  picks: { ask: Ask; option: AskOption }[];
  width: number;
  onTake: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const n = picks.length;
  return (
    <ConfirmationDialog
      title={`Take hex’s ${n} picks?`}
      isPresented={asking}
      onIsPresentedChange={setAsking}
      titleVisibility="visible"
    >
      <ConfirmationDialog.Trigger>
        <Strip
          width={width}
          mark="done"
          title={`hex has a pick for ${n} of these`}
          action={`Take ${n}`}
          label={`hex has a pick for ${n}. Take them`}
          onPress={() => setAsking(true)}
        />
      </ConfirmationDialog.Trigger>
      <ConfirmationDialog.Actions>
        <Button label={`Take ${n} picks`} onPress={onTake} />
        <Button label="Cancel" role="cancel" />
      </ConfirmationDialog.Actions>
      <ConfirmationDialog.Message>
        <NativeText>
          {picks.map(({ ask, option }) => `${ask.topic}: ${option.label}`).join('\n')}
        </NativeText>
      </ConfirmationDialog.Message>
    </ConfirmationDialog>
  );
}

// Starts a call that walks the asks with hex, one at a time; it floats over the foot of the list.
export function GoThrough({
  count,
  foot = 0,
  onPress,
}: {
  count: number;
  foot?: number;
  onPress: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={9}
      onPress={onPress}
      modifiers={[
        frame({ height: 52 }),
        frame({ maxWidth: Infinity }),
        background(theme.prominent),
        clipShape('capsule'),
        contentShape(shapes.capsule()),
        padding({ leading: 16, trailing: 16, bottom: Math.max(12, foot) }),
        ...(ios ? [accessibilityLabel(`Go through ${count} with hex, on a call`)] : []),
      ]}
    >
      <Spacer flexible />
      <Icon name="waveform" size={16} color={theme.onProminent} />
      <Text
        textStyle={{ fontSize: 17, fontWeight: '600' }}
        modifiers={[foregroundStyle(theme.onProminent)]}
      >
        {`Go through ${count} with hex`}
      </Text>
      <Spacer flexible />
    </Row>
  );
}
