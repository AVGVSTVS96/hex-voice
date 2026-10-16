import { Column, Icon, Row, Spacer, Text, TextInput } from '@expo/ui';
import {
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
import { useState } from 'react';

import { Hairline, INSET, ios } from '@/components/tasks/parts';
import type { Ask, AskOption } from '@/live/asks';
import { theme } from '@/theme';

const ROW = 50;

// An ask's choices, one row each with a hairline between: hex's pick says so in mint, one that
// opens a page has its arrow, and the last row writes your own.
export function Choices({
  ask,
  onAnswer,
}: {
  ask: Ask;
  onAnswer: (ask: Ask, option: AskOption) => void;
}) {
  return (
    <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      <Hairline />
      {ask.options.map((option) => (
        <Column
          key={option.label}
          alignment="start"
          spacing={0}
          modifiers={[frame({ maxWidth: Infinity })]}
        >
          <Choice option={option} onPress={() => onAnswer(ask, option)} />
          <Hairline />
        </Column>
      ))}
      <WriteOwn topic={ask.topic} onSend={(label) => onAnswer(ask, { label })} />
      <Hairline />
    </Column>
  );
}

function Choice({ option, onPress }: { option: AskOption; onPress: () => void }) {
  return (
    <Row
      alignment="center"
      spacing={12}
      onPress={onPress}
      modifiers={[
        padding({ leading: INSET, trailing: INSET, top: 8, bottom: 8 }),
        frame({ minHeight: ROW }),
        frame({ maxWidth: Infinity }),
        contentShape(shapes.rectangle()),
        ...(ios
          ? [accessibilityLabel(option.pick ? `${option.label}, hex’s pick` : option.label)]
          : []),
      ]}
    >
      {option.pick ? (
        <Icon name="checkmark" size={15} color={theme.accent} />
      ) : (
        <Spacer style={{ width: 15 }} />
      )}
      <Text
        numberOfLines={3}
        textStyle={{ fontSize: 17, lineHeight: 22, fontWeight: option.pick ? '500' : '400' }}
        modifiers={[
          foregroundStyle(option.pick ? theme.accent : theme.text),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        {option.label}
      </Text>
      {option.pick ? (
        <Text
          textStyle={{ fontSize: 13, fontWeight: '500' }}
          modifiers={[foregroundStyle(theme.accent)]}
        >
          hex’s pick
        </Text>
      ) : null}
      {option.url ? <Icon name="arrow.up.right" size={13} color={theme.secondary} /> : null}
    </Row>
  );
}

// Your own answer or a note, when none of the choices says it: it goes to the topic like a tap.
function WriteOwn({ topic, onSend }: { topic: string; onSend: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const note = text.trim();
  if (!open)
    return (
      <Row
        alignment="center"
        spacing={12}
        onPress={() => setOpen(true)}
        modifiers={[
          padding({ leading: INSET, trailing: INSET }),
          frame({ height: ROW }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          contentShape(shapes.rectangle()),
          ...(ios ? [accessibilityLabel('Write your own answer')] : []),
        ]}
      >
        <Icon name="square.and.pencil" size={15} color={theme.secondary} />
        <Text textStyle={{ fontSize: 17 }} modifiers={[foregroundStyle(theme.secondary)]}>
          Write your own
        </Text>
      </Row>
    );
  return (
    <Row
      alignment="end"
      spacing={10}
      modifiers={[
        padding({ leading: 14, trailing: 6, top: 6, bottom: 6 }),
        frame({ minHeight: ROW - 8 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        background(theme.surface),
        clipShape('roundedRectangle', 14),
        strokeBorder({
          content: theme.edge,
          style: { lineWidth: 1 },
          shape: 'roundedRectangle',
          cornerRadius: 14,
        }),
        padding({ leading: INSET - 6, trailing: INSET - 6, top: 6, bottom: 6 }),
      ]}
    >
      <TextInput
        autoFocus
        multiline
        placeholder={`Your answer or a note for ${topic}`}
        placeholderTextColor={theme.tertiary}
        cursorColor={theme.accent}
        onChangeText={setText}
        textStyle={{ fontSize: 17 }}
        modifiers={[
          foregroundStyle(theme.text),
          padding({ top: 6, bottom: 6 }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      />
      <Icon
        name="arrow.up.circle.fill"
        size={30}
        color={note ? theme.accent : theme.tertiary}
        onPress={note ? () => onSend(note) : undefined}
        modifiers={ios ? [accessibilityLabel(`Send to ${topic}`)] : []}
      />
    </Row>
  );
}
