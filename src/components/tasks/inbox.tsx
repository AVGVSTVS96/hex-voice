import { Icon, Row, Spacer, Text } from '@expo/ui';
import { Button, Circle, ConfirmationDialog, Text as NativeText } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  contentShape,
  foregroundStyle,
  frame,
  layoutPriority,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import { Mark } from '@/components/tasks/mark';
import { INSET, asks, ios, listRow } from '@/components/tasks/parts';
import { checkLine, type Ask, type AskOption, type CheckSummary } from '@/live/asks';
import type { Stage, Topic } from '@/live/inbox';
import { theme } from '@/theme';

const MARKS = 6;

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
      {onPress ? <Icon name="chevron.right" size={11} color={theme.tertiary} /> : null}
    </Row>
  );
}

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

// It asks once more first, since it answers for you many times over, naming each question and the
// answer it would give.
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
          title={`hex has a pick for ${asks(n)}`}
          action={`Take ${n}`}
          label={`hex has a pick for ${asks(n)}. Take them`}
          onPress={() => setAsking(true)}
        />
      </ConfirmationDialog.Trigger>
      <ConfirmationDialog.Actions>
        <Button label={`Take ${n} picks`} onPress={onTake} />
        <Button label="Cancel" role="cancel" />
      </ConfirmationDialog.Actions>
      <ConfirmationDialog.Message>
        <NativeText>
          {picks.map(({ ask, option }) => `${clip(ask.question)} → ${option.label}`).join('\n\n')}
        </NativeText>
      </ConfirmationDialog.Message>
    </ConfirmationDialog>
  );
}

const CLIP = 70;

function clip(text: string) {
  return text.length > CLIP ? `${text.slice(0, CLIP - 1).trimEnd()}…` : text;
}
