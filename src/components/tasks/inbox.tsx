import { Column, Icon, Row, Spacer } from '@expo/ui';
import { Button, ConfirmationDialog, Text as NativeText } from '@expo/ui/swift-ui';
import {
  accessibilityElement,
  accessibilityLabel,
  background,
  clipShape,
  contentShape,
  frame,
  layoutPriority,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import { Mark } from '@/components/tasks/mark';
import { Pill, asks, listRow } from '@/components/tasks/parts';
import { checkLine, type Ask, type AskOption, type CheckSummary } from '@/live/asks';
import type { Topic } from '@/live/inbox';
import { theme } from '@/theme';
import { Text } from '@/ui/text';
import { metrics, radius, space } from '@/ui/tokens';

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
      spacing={space[2]}
      onPress={onPress}
      modifiers={[
        padding({
          leading: metrics.list.inset,
          trailing: metrics.list.inset,
          top: space[5],
          bottom: space[1],
        }),
        frame({ maxWidth: Infinity }),
        contentShape(shapes.rectangle()),
        ...listRow(width),
        ...(onPress ? [accessibilityLabel(`${topic.name}. Opens it`)] : []),
      ]}
    >
      <Text numberOfLines={1} variant="headline" modifiers={[layoutPriority(1)]}>
        {topic.name}
      </Text>
      <Spacer flexible />
      {onPress ? (
        <Icon name="chevron.right" size={metrics.symbol.small} color={theme.tertiary} />
      ) : null}
    </Row>
  );
}

// Something about the whole list, apart from its projects: a card on the ground with its one
// action as a pill.
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
      spacing={metrics.list.gap}
      onPress={onPress}
      modifiers={[
        padding({
          leading: space[3],
          trailing: action ? space[2] : space[4],
          top: space[2],
          bottom: space[2],
        }),
        frame({ minHeight: metrics.pill.regular + space[4] }),
        frame({ maxWidth: Infinity }),
        background(theme.card),
        clipShape('roundedRectangle', radius.group),
        contentShape(shapes.rectangle()),
        padding({
          leading: metrics.list.inset - space[3],
          trailing: metrics.list.inset - space[3],
          top: space[1],
          bottom: space[2],
        }),
        ...listRow(width),
        accessibilityElement('combine'),
        accessibilityLabel(label),
      ]}
    >
      <Mark state={mark} />
      <Column
        alignment="start"
        spacing={0}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text numberOfLines={2} variant="body">
          {title}
        </Text>
        {detail ? (
          <Text numberOfLines={2} variant="detail" tone="secondary">
            {detail}
          </Text>
        ) : null}
      </Column>
      {action ? (
        <Pill label={action} onPress={onPress} small />
      ) : (
        <Icon name="chevron.right" size={metrics.symbol.small} color={theme.tertiary} />
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
