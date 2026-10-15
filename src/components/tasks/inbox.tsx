import { Column, Icon, Row, ScrollView, Spacer, Text, TextInput } from '@expo/ui';
import { Button, Circle, ConfirmationDialog, Picker, Text as NativeText } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  animation,
  background,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  contentShape,
  controlSize,
  foregroundStyle,
  frame,
  id,
  labelStyle,
  layoutPriority,
  padding,
  pickerStyle,
  shapes,
  strokeBorder,
  tag,
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import { INSET, Mark, ios } from '@/components/tasks/parts';
import { PlaceTile } from '@/components/tasks/places';
import { EntryRow, type RowActions } from '@/components/tasks/rows';
import { checkLine, type Ask, type AskOption, type CheckSummary } from '@/live/asks';
import {
  GROUPINGS,
  quietLine,
  type Group,
  type Grouping,
  type Stage,
  type Topic,
} from '@/live/inbox';
import { motion, rowsKey } from '@/motion';
import { theme } from '@/theme';

// How many rows a group shows before "Show more", and how many more each tap brings.
const PAGE = 8;
const MORE = 25;
const MARKS = 6;

// The list's head: the big title with what it holds under it, and search. The title sits on the
// toolbar's line where there is one beside it (`line`), and under the grabber in a sheet.
export function ListHead({
  title,
  subtitle,
  marks,
  line,
  onSearch,
}: {
  title: string;
  subtitle: string;
  marks?: Stage[];
  line?: number;
  onSearch: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={12}
      modifiers={[
        padding({
          leading: INSET,
          trailing: 14,
          top: line === undefined ? 22 : Math.max(8, line - 24),
        }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Column
        alignment="start"
        spacing={2}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 30, fontWeight: '700' }}
          modifiers={[foregroundStyle(theme.text)]}
        >
          {title}
        </Text>
        <Row alignment="center" spacing={6}>
          {marks?.length ? <Marks marks={marks} /> : null}
          <Subtitle text={subtitle} />
        </Row>
      </Column>
      <Button
        label="Search"
        systemImage="magnifyingglass"
        onPress={onSearch}
        testID="tasks-search"
        modifiers={[
          labelStyle('iconOnly'),
          buttonStyle('glass'),
          buttonBorderShape('circle'),
          controlSize('large'),
        ]}
      />
    </Row>
  );
}

// "7 need you · 4 working": what needs you reads in the accent, the rest quietly.
function Subtitle({ text }: { text: string }) {
  const [first, ...rest] = text.split(' · ');
  const needs = first.includes('need');
  return (
    <Row alignment="center" spacing={0}>
      <Text
        numberOfLines={1}
        textStyle={{ fontSize: 14, fontWeight: needs ? '600' : '400' }}
        modifiers={[foregroundStyle(needs ? theme.accent : theme.secondary), layoutPriority(1)]}
      >
        {first}
      </Text>
      {rest.length ? (
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 14 }}
          modifiers={[foregroundStyle(theme.secondary)]}
        >
          {` · ${rest.join(' · ')}`}
        </Text>
      ) : null}
    </Row>
  );
}

// One small mark per thread: filled needs you, ringed working, grey done, hollow quiet.
function Marks({ marks }: { marks: Stage[] }) {
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
        padding({ leading: 16, trailing: INSET, top: 18, bottom: 4 }),
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
          clipShape('capsule'),
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

// Group by state, topic or app, as one segmented control.
export function GroupBy({ by, onChange }: { by: Grouping; onChange: (by: Grouping) => void }) {
  return (
    <Row
      alignment="center"
      spacing={12}
      modifiers={[
        padding({ leading: INSET, trailing: INSET, top: 12 }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Text textStyle={{ fontSize: 14 }} modifiers={[foregroundStyle(theme.secondary)]}>
        Group
      </Text>
      <Picker
        selection={by}
        onSelectionChange={onChange}
        testID="tasks-group"
        modifiers={[pickerStyle('segmented'), frame({ maxWidth: Infinity })]}
      >
        {GROUPINGS.map(({ key, title }) => (
          <NativeText key={key} modifiers={[tag(key)]}>
            {title}
          </NativeText>
        ))}
      </Picker>
    </Row>
  );
}

// All, then every topic, the ones that need you first with how many. One taps the stream down to it.
export function Chips({
  total,
  topics,
  topic,
  onChange,
}: {
  total: number;
  topics: Topic[];
  topic: string | null;
  onChange: (topic: string | null) => void;
}) {
  const chip = (key: string | null, title: string, count: number, needs = 0) => {
    const on = key === topic;
    return (
      <Row
        key={key ?? '*'}
        alignment="center"
        spacing={6}
        onPress={() => onChange(on && key !== null ? null : key)}
        modifiers={[
          padding({ leading: 13, trailing: needs ? 8 : 13 }),
          frame({ height: 34 }),
          background(on ? theme.prominent : theme.surface),
          clipShape('capsule'),
          contentShape(shapes.capsule()),
          ...(ios
            ? [
                accessibilityLabel(
                  `${title}${needs ? `, ${needs} need you` : ''}${on ? ', shown' : ''}`,
                ),
              ]
            : []),
        ]}
      >
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 15, fontWeight: '600' }}
          modifiers={[foregroundStyle(on ? theme.onProminent : theme.text)]}
        >
          {title}
        </Text>
        {count ? (
          <Text
            textStyle={{ fontSize: 15 }}
            modifiers={[foregroundStyle(on ? theme.onProminent : theme.secondary)]}
          >
            {String(count)}
          </Text>
        ) : null}
        {needs ? (
          <Text
            textStyle={{ fontSize: 12, fontWeight: '700' }}
            modifiers={[
              foregroundStyle(theme.onProminent),
              frame({ minWidth: 20, minHeight: 20 }),
              background(theme.accent),
              clipShape('capsule'),
            ]}
          >
            {String(needs)}
          </Text>
        ) : null}
      </Row>
    );
  };
  return (
    <ScrollView
      direction="horizontal"
      showsIndicators={false}
      modifiers={[frame({ maxWidth: Infinity })]}
    >
      <Row
        alignment="center"
        spacing={8}
        modifiers={[padding({ leading: INSET, trailing: INSET, top: 12, bottom: 4 })]}
      >
        {chip(null, 'All', total)}
        {topics.map((one) => chip(one.name, one.name, 0, one.needs))}
      </Row>
    </ScrollView>
  );
}

// One group of the stream: its head, its rows a page at a time, and its quiet threads folded into
// one line of names that opens into rows.
export function GroupBlock({
  group,
  by,
  open = false,
  onTopic,
  ...actions
}: {
  group: Group;
  by: Grouping;
  open?: boolean;
  onTopic: (topic: string) => void;
} & RowActions) {
  const [shown, setShown] = useState(PAGE);
  const [unfolded, setUnfolded] = useState(open);
  const quiet = unfolded || open ? group.quiet : [];
  const rows = [...group.live, ...quiet];
  const page = rows.slice(0, shown);
  const more = rows.length - page.length;
  const needs = group.place ? group.live.filter((entry) => entry.stage === 'needs').length : 0;
  const head = by === 'topic' && group.topic ? () => onTopic(group.topic!) : undefined;
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[
        id(group.key),
        frame({ maxWidth: Infinity }),
        animation(
          motion.list,
          rowsKey(
            page.map((entry) => `${entry.id}:${entry.stage}:${actions.answered[entry.id] ?? ''}`),
          ),
        ),
      ]}
    >
      <Head
        group={group}
        count={group.live.length + group.quiet.length}
        needs={needs}
        onPress={head}
      />
      {page.map((entry) => (
        <EntryRow key={entry.id} entry={entry} {...actions} />
      ))}
      {more > 0 ? (
        <More text={`Show ${Math.min(more, MORE)} more`} onPress={() => setShown(shown + MORE)} />
      ) : null}
      {group.quiet.length && !unfolded && !open ? (
        <Fold
          text={`${group.quiet.length} quiet · ${quietLine(group.quiet, by === 'topic' ? 'place' : 'topic')}`}
          onPress={() => {
            setUnfolded(true);
            setShown(group.live.length + PAGE);
          }}
        />
      ) : null}
    </Column>
  );
}

function Head({
  group,
  count,
  needs,
  onPress,
}: {
  group: Group;
  count: number;
  needs?: number;
  onPress?: () => void;
}) {
  const stage = !group.topic && !group.place;
  return (
    <Row
      alignment="center"
      spacing={8}
      onPress={onPress}
      modifiers={[
        padding({ leading: INSET, trailing: INSET, top: 18, bottom: 4 }),
        frame({ maxWidth: Infinity }),
        contentShape(shapes.rectangle()),
        ...(ios && onPress
          ? [accessibilityLabel(`${group.title}, ${count}. Shows only ${group.title}`)]
          : []),
      ]}
    >
      {group.place ? <PlaceTile place={group.place} size={22} /> : null}
      <Text
        numberOfLines={1}
        textStyle={{ fontSize: stage ? 14 : 16, fontWeight: '600' }}
        modifiers={[foregroundStyle(stage ? theme.secondary : theme.text)]}
      >
        {group.title}
      </Text>
      {group.topic ? (
        <Marks marks={[...group.live, ...group.quiet].map((entry) => entry.stage)} />
      ) : null}
      {!group.topic ? (
        <Text textStyle={{ fontSize: 14 }} modifiers={[foregroundStyle(theme.tertiary)]}>
          {String(count)}
        </Text>
      ) : null}
      <Spacer flexible />
      {needs ? (
        <Text
          textStyle={{ fontSize: 13, fontWeight: '600' }}
          modifiers={[foregroundStyle(theme.accent)]}
        >
          {`${needs} need${needs === 1 ? 's' : ''} you`}
        </Text>
      ) : null}
      {onPress ? <Icon name="chevron.right" size={12} color={theme.tertiary} /> : null}
    </Row>
  );
}

function More({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Text
      onPress={onPress}
      textStyle={{ fontSize: 15, fontWeight: '600' }}
      modifiers={[
        foregroundStyle(theme.accent),
        padding({ leading: INSET + 34, top: 8, bottom: 10 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
      ]}
    >
      {text}
    </Text>
  );
}

function Fold({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Row
      alignment="start"
      spacing={12}
      onPress={onPress}
      modifiers={[
        padding({ leading: INSET, trailing: INSET, top: 9, bottom: 12 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
        ...(ios ? [accessibilityLabel(`${text}. Shows them`)] : []),
      ]}
    >
      <Mark state="idle" />
      <Text
        numberOfLines={2}
        textStyle={{ fontSize: 15, lineHeight: 20 }}
        modifiers={[
          foregroundStyle(theme.tertiary),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        {text}
      </Text>
      <Icon name="chevron.down" size={12} color={theme.tertiary} />
    </Row>
  );
}

// "Checked 6:31pm · fixed 4 · flagged 3", opening what the check read, fixed and flagged.
export function CheckStrip({ check, onPress }: { check: CheckSummary; onPress: () => void }) {
  const { title, did } = checkLine(check);
  return (
    <Row
      alignment="center"
      spacing={12}
      onPress={onPress}
      modifiers={[
        padding({ leading: 14, trailing: 16 }),
        frame({ height: 48 }),
        frame({ maxWidth: Infinity }),
        background(theme.group),
        clipShape('roundedRectangle', 16),
        contentShape(shapes.rectangle()),
        ...(ios
          ? [accessibilityLabel(`${title}${did ? `, ${did}` : ''}. Opens the last check`)]
          : []),
      ]}
    >
      <Mark state="done" />
      <Text
        numberOfLines={1}
        textStyle={{ fontSize: 15, fontWeight: '500' }}
        modifiers={[foregroundStyle(theme.text), layoutPriority(1)]}
      >
        {title}
      </Text>
      <Text
        numberOfLines={1}
        textStyle={{ fontSize: 14 }}
        modifiers={[foregroundStyle(theme.secondary)]}
      >
        {did}
      </Text>
      <Spacer flexible />
      <Icon name="chevron.right" size={12} color={theme.tertiary} />
    </Row>
  );
}

// hex has a pick for several asks: take them all at once, each folding where it sits with Undo.
// It asks once more first, since it answers for you many times over.
export function PicksStrip({
  picks,
  onTake,
}: {
  picks: { ask: Ask; option: AskOption }[];
  onTake: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const n = picks.length;
  return (
    <Row
      alignment="center"
      spacing={12}
      modifiers={[
        padding({ leading: 14, trailing: 10, top: 10, bottom: 10 }),
        frame({ maxWidth: Infinity }),
        background(theme.accentMuted),
        clipShape('roundedRectangle', 16),
      ]}
    >
      <Icon name="checkmark.circle" size={18} color={theme.accent} />
      <Column
        alignment="start"
        spacing={1}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text
          textStyle={{ fontSize: 15, fontWeight: '600' }}
          modifiers={[foregroundStyle(theme.text)]}
        >
          {`hex has a pick for ${n} of them`}
        </Text>
        <Text textStyle={{ fontSize: 13 }} modifiers={[foregroundStyle(theme.secondary)]}>
          Take them all, then undo any one
        </Text>
      </Column>
      <ConfirmationDialog
        title={`Take hex’s ${n} pick${n === 1 ? '' : 's'}?`}
        isPresented={asking}
        onIsPresentedChange={setAsking}
        titleVisibility="visible"
      >
        <ConfirmationDialog.Trigger>
          <Text
            onPress={() => setAsking(true)}
            textStyle={{ fontSize: 15, fontWeight: '600' }}
            modifiers={[
              foregroundStyle(theme.onProminent),
              padding({ leading: 14, trailing: 14, top: 8, bottom: 8 }),
              background(theme.prominent),
              clipShape('capsule'),
              ...(ios ? [accessibilityLabel(`Take ${n} picks`)] : []),
            ]}
          >
            {`Take ${n}`}
          </Text>
        </ConfirmationDialog.Trigger>
        <ConfirmationDialog.Actions>
          <Button label={`Take ${n} pick${n === 1 ? '' : 's'}`} onPress={onTake} />
          <Button label="Cancel" role="cancel" />
        </ConfirmationDialog.Actions>
        <ConfirmationDialog.Message>
          <NativeText>
            {picks.map(({ ask, option }) => `${ask.topic}: ${option.label}`).join('\n')}
          </NativeText>
        </ConfirmationDialog.Message>
      </ConfirmationDialog>
    </Row>
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
      spacing={10}
      onPress={onPress}
      modifiers={[
        frame({ height: 54 }),
        frame({ maxWidth: Infinity }),
        background(theme.prominent),
        clipShape('capsule'),
        contentShape(shapes.capsule()),
        padding({ leading: 16, trailing: 16, bottom: Math.max(12, foot) }),
        ...(ios ? [accessibilityLabel(`Go through ${count} with hex, on a call`)] : []),
      ]}
    >
      <Spacer flexible />
      <Icon name="waveform" size={17} color={theme.onProminent} />
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
