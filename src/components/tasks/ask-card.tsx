import { Column, Icon, Row, Spacer, Text } from '@expo/ui';
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

import { Mark, ios } from '@/components/tasks/parts';
import { foldNote, placesLine, stacked, type Ask, type AskOption } from '@/live/asks';
import { clock } from '@/live/tasks';
import { theme } from '@/theme';

const RADIUS = 26;
const OPTION = 52;

// One thing waiting on you, answered in place: where it came from and since when, the question,
// what it unblocks or costs, and its choices. hex's pick wears the mint ring, or the bright pill
// when the choices sit side by side.
export function AskCard({
  ask,
  onAnswer,
}: {
  ask: Ask;
  onAnswer: (ask: Ask, option: AskOption) => void;
}) {
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
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 14, fontWeight: '600' }}
          modifiers={[foregroundStyle(theme.secondary)]}
        >
          {ask.topic}
        </Text>
        <Text textStyle={{ fontSize: 14 }} modifiers={[foregroundStyle(theme.tertiary)]}>
          {since(ask.at)}
        </Text>
        <Spacer flexible />
        {ask.tag ? <Tag text={ask.tag} /> : null}
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

// An ask's choices: stacked one per row when there are several to pick from, side by side when
// it's one way or the other.
export function Choices({
  ask,
  onAnswer,
}: {
  ask: Ask;
  onAnswer: (ask: Ask, option: AskOption) => void;
}) {
  return stacked(ask) ? (
    <Column alignment="start" spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
      {ask.options.map((option) => (
        <Choice key={option.label} option={option} onPress={() => onAnswer(ask, option)} />
      ))}
    </Column>
  ) : (
    <Row alignment="center" spacing={10} modifiers={[frame({ maxWidth: Infinity })]}>
      {ask.options.map((option) => (
        <Choice key={option.label} side option={option} onPress={() => onAnswer(ask, option)} />
      ))}
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
        padding({ leading: side ? 14 : 18, trailing: side ? 14 : 18 }),
        frame({ height: OPTION }),
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
        numberOfLines={1}
        textStyle={{ fontSize: 17, fontWeight: side ? '600' : '400' }}
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
