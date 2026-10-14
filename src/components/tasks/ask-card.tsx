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
import { Linking } from 'react-native';

import { Mark, ios } from '@/components/tasks/parts';
import { foldNote, placesLine, stacked, type Ask, type AskOption } from '@/live/asks';
import { clock } from '@/live/tasks';
import { theme } from '@/theme';

const RADIUS = 26;
const OPTION = 52;

// One thing waiting on you, answered in place: where it came from and since when, the question,
// what it unblocks or costs, and its choices. hex's pick wears the mint ring, or the bright pill
// when the choices sit side by side. Its topic opens the task it belongs to, and the paper plane
// opens the question itself in Telegram.
export function AskCard({
  ask,
  onAnswer,
  onOpenTask,
}: {
  ask: Ask;
  onAnswer: (ask: Ask, option: AskOption) => void;
  onOpenTask: (task: string) => void;
}) {
  const link = ask.link;
  const places = placesLine(ask.places);
  return (
    <Column
      alignment="start"
      spacing={12}
      modifiers={[
        padding({ leading: 18, trailing: 18, top: 16, bottom: 18 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        background(theme.group),
        clipShape('roundedRectangle', RADIUS),
      ]}
    >
      <Row alignment="center" spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
        <Row
          alignment="center"
          spacing={6}
          onPress={() => onOpenTask(ask.task)}
          modifiers={[
            frame({ minHeight: 32 }),
            contentShape(shapes.rectangle()),
            ...(ios ? [accessibilityLabel(`Open ${ask.topic}`)] : []),
          ]}
        >
          <Text
            numberOfLines={1}
            textStyle={{ fontSize: 14, fontWeight: '600' }}
            modifiers={[foregroundStyle(theme.secondary)]}
          >
            {ask.topic}
          </Text>
          <Icon name="chevron.right" size={11} color={theme.tertiary} />
          <Text textStyle={{ fontSize: 14 }} modifiers={[foregroundStyle(theme.tertiary)]}>
            {since(ask.at)}
          </Text>
        </Row>
        <Spacer flexible />
        {ask.tag ? <Tag text={ask.tag} /> : null}
        {link ? (
          <Icon
            name="paperplane"
            size={15}
            color={theme.secondary}
            onPress={() => void Linking.openURL(link)}
            modifiers={[
              frame({ width: 32, height: 32 }),
              contentShape(shapes.rectangle()),
              ...(ios ? [accessibilityLabel('Open in Telegram')] : []),
            ]}
          />
        ) : null}
      </Row>
      <Column
        alignment="start"
        spacing={6}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text
          textStyle={{ fontSize: 19, fontWeight: '600', lineHeight: 24 }}
          modifiers={[foregroundStyle(theme.text)]}
        >
          {ask.question}
        </Text>
        {ask.context ? (
          <Text
            textStyle={{ fontSize: 16, lineHeight: 21 }}
            modifiers={[foregroundStyle(theme.secondary)]}
          >
            {ask.context}
          </Text>
        ) : null}
      </Column>
      <Choices ask={ask} onAnswer={onAnswer} />
      {places ? (
        <Row alignment="center" spacing={6}>
          <Icon name="link" size={12} color={theme.tertiary} />
          <Text textStyle={{ fontSize: 13 }} modifiers={[foregroundStyle(theme.tertiary)]}>
            {places}
          </Text>
        </Row>
      ) : null}
    </Column>
  );
}

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

function Tag({ text }: { text: string }) {
  const money = text === 'money';
  return (
    <Text
      textStyle={{ fontSize: 13, fontWeight: '600' }}
      modifiers={[
        foregroundStyle(money ? theme.text : theme.accent),
        padding({ leading: 10, trailing: 10, top: 5, bottom: 5 }),
        background(money ? theme.surfaceSelected : theme.accentMuted),
        clipShape('capsule'),
      ]}
    >
      {text}
    </Text>
  );
}

// An ask answered here, folded to one line: what you said, where it went, what its Telegram
// message says now, and Undo.
export function FoldedAsk({ ask, label, onUndo }: { ask: Ask; label: string; onUndo: () => void }) {
  return (
    <Row
      alignment="start"
      spacing={12}
      modifiers={[
        padding({ leading: 16, trailing: 18, top: 16, bottom: 16 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        background(theme.group),
        clipShape('roundedRectangle', RADIUS),
      ]}
    >
      <Mark state="done" />
      <Column
        alignment="start"
        spacing={3}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Text
          numberOfLines={2}
          textStyle={{ fontSize: 16, lineHeight: 20 }}
          modifiers={[foregroundStyle(theme.secondary)]}
        >
          {ask.question}
        </Text>
        <Row alignment="center" spacing={6}>
          <Text
            numberOfLines={3}
            textStyle={{ fontSize: 17, fontWeight: '600' }}
            modifiers={[foregroundStyle(theme.text)]}
          >
            {label}
          </Text>
          <Text textStyle={{ fontSize: 16 }} modifiers={[foregroundStyle(theme.secondary)]}>
            {`→ ${ask.topic}`}
          </Text>
        </Row>
        <Text
          textStyle={{ fontSize: 13, lineHeight: 17 }}
          modifiers={[foregroundStyle(theme.tertiary)]}
        >
          {foldNote(ask, label)}
        </Text>
      </Column>
      <Text
        textStyle={{ fontSize: 17, fontWeight: '600' }}
        onPress={onUndo}
        modifiers={[
          foregroundStyle(theme.accent),
          ...(ios ? [accessibilityLabel(`Undo ${label}`)] : []),
        ]}
      >
        Undo
      </Text>
    </Row>
  );
}

// "7:32am" today, "since Oct 11" before.
function since(at: string) {
  const when = clock(new Date(at));
  return /\d:\d\d/.test(when) ? when : `since ${when}`;
}
