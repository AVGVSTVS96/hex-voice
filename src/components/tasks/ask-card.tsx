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

import { ios } from '@/components/tasks/parts';
import { stacked, type Ask, type AskOption } from '@/live/asks';
import { theme } from '@/theme';

const OPTION = 52;

// An ask's choices: stacked one per row when there are several or they're too long for a pill,
// side by side when it's one way or the other, and always a way to write your own.
export function Choices({
  ask,
  onAnswer,
}: {
  ask: Ask;
  onAnswer: (ask: Ask, option: AskOption) => void;
}) {
  return (
    <Column alignment="start" spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
      {stacked(ask) ? (
        ask.options.map((option) => (
          <Choice key={option.label} option={option} onPress={() => onAnswer(ask, option)} />
        ))
      ) : (
        <Row alignment="center" spacing={10} modifiers={[frame({ maxWidth: Infinity })]}>
          {ask.options.map((option) => (
            <Choice key={option.label} side option={option} onPress={() => onAnswer(ask, option)} />
          ))}
        </Row>
      )}
      <WriteOwn topic={ask.topic} onSend={(label) => onAnswer(ask, { label })} />
    </Column>
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
        spacing={10}
        onPress={() => setOpen(true)}
        modifiers={[
          padding({ leading: 18, trailing: 18 }),
          frame({ height: OPTION }),
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
        padding({ leading: 18, trailing: 8, top: 8, bottom: 8 }),
        frame({ minHeight: OPTION }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        background(theme.surface),
        clipShape('roundedRectangle', 16),
        strokeBorder({
          content: theme.edge,
          style: { lineWidth: 1 },
          shape: 'roundedRectangle',
          cornerRadius: 16,
        }),
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

// A choice: a row with "hex's pick" at its end when they stack, a pill when they sit side by side.
// A choice that opens a page says so with its arrow.
function Choice({
  option,
  side = false,
  onPress,
}: {
  option: AskOption;
  side?: boolean;
  onPress: () => void;
}) {
  const bright = side && option.pick;
  return (
    <Row
      alignment="center"
      spacing={8}
      onPress={onPress}
      modifiers={[
        padding({ leading: side ? 14 : 18, trailing: side ? 14 : 18, top: 8, bottom: 8 }),
        frame({ minHeight: OPTION }),
        frame({ maxWidth: Infinity }),
        background(bright ? theme.prominent : theme.surface),
        clipShape(side ? 'capsule' : 'roundedRectangle', 16),
        ...(option.pick && !side
          ? [
              strokeBorder({
                content: theme.accent,
                style: { lineWidth: 1.5 },
                shape: 'roundedRectangle',
                cornerRadius: 16,
              }),
            ]
          : []),
        contentShape(side ? shapes.capsule() : shapes.rectangle()),
        ...(ios
          ? [accessibilityLabel(option.pick ? `${option.label}, hex’s pick` : option.label)]
          : []),
      ]}
    >
      {side ? <Spacer flexible /> : null}
      <Text
        numberOfLines={side ? 1 : 3}
        textStyle={{ fontSize: 17, lineHeight: 22, fontWeight: side ? '600' : '400' }}
        modifiers={[foregroundStyle(bright ? theme.onProminent : theme.text)]}
      >
        {option.label}
      </Text>
      {option.url ? (
        <Icon name="arrow.up.right" size={13} color={bright ? theme.onProminent : theme.text} />
      ) : null}
      <Spacer flexible />
      {option.pick && !side ? (
        <Text
          textStyle={{ fontSize: 14, fontWeight: '500' }}
          modifiers={[foregroundStyle(theme.accent)]}
        >
          hex’s pick
        </Text>
      ) : null}
    </Row>
  );
}
