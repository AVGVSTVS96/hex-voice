import { Icon, Row, Spacer } from '@expo/ui';
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
import { asks, listRow } from '@/components/tasks/parts';
import { checkLine, type Ask, type AskOption, type CheckSummary } from '@/live/asks';
import type { Stage } from '@/live/inbox';
import { theme } from '@/theme';
import { Text } from '@/ui/text';
import { metrics, space } from '@/ui/tokens';

const MARKS = 6;

export function Dots({ marks }: { marks: Stage[] }) {
  return (
    <Row alignment="center" spacing={metrics.dots.gap}>
      {marks.slice(0, MARKS).map((stage, i) => (
        <Circle
          key={i}
          modifiers={[
            frame({ width: metrics.dots.size, height: metrics.dots.size }),
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
      spacing={metrics.list.gap}
      onPress={onPress}
      modifiers={[
        padding({
          leading: metrics.list.inset - space[0.5],
          trailing: metrics.list.inset,
          top: space[3],
          bottom: space[3],
        }),
        frame({ maxWidth: Infinity }),
        contentShape(shapes.rectangle()),
        ...listRow(width),
        accessibilityLabel(label),
      ]}
    >
      <Mark state={mark} />
      <Text numberOfLines={1} variant="subheadline" weight="medium" modifiers={[layoutPriority(1)]}>
        {title}
      </Text>
      {detail ? (
        <Text numberOfLines={1} variant="subheadline" tone="secondary">
          {detail}
        </Text>
      ) : null}
      <Spacer flexible />
      {action ? (
        <Text variant="subheadline" weight="semibold" tone="accent">
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
