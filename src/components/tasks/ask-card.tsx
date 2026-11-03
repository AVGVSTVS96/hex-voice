import { Column, Icon, Row, Spacer, Text, TextInput } from '@expo/ui';
import { Rectangle } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  animation,
  background,
  clipShape,
  contentShape,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  shapes,
  strokeBorder,
  type ModifierConfig,
} from '@expo/ui/swift-ui/modifiers';
import { useContext, useState } from 'react';
import { Linking } from 'react-native';

import { Mark } from '@/components/tasks/mark';
import { Typing } from '@/components/tasks/pages';
import { useDraft } from '@/hooks/use-draft';
import { GAP, Hairline, INSET, SectionHead, ios } from '@/components/tasks/parts';
import type { Ask, AskLink, AskOption } from '@/live/asks';
import { fitsOneLine } from '@/live/inbox';
import { motion, rowsKey } from '@/motion';
import { radius, theme } from '@/theme';

const ROW = 50;
const QUESTION = 17;
// The pencil takes taps across 44 points but only the question's first line of height.
const PENCIL = 44;
const LINE = 22;

type Answer = (ask: Ask, option: AskOption) => void;

export function YourCall({
  asks,
  answered,
  width,
  onAnswer,
  onUndo,
}: {
  asks: Ask[];
  answered: Record<string, string | null>;
  width: number;
  onAnswer: Answer;
  onUndo: (ask: Ask) => void;
}) {
  const open = asks.filter((ask) => !answered[ask.id]).length;
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[
        animation(motion.list, rowsKey(asks.map((ask) => `${ask.id}=${answered[ask.id] ?? ''}`))),
      ]}
    >
      <SectionHead title="Your call" count={open} />
      {asks.map((ask, i) => {
        const said = answered[ask.id];
        if (said)
          return (
            <Row
              key={ask.id}
              alignment="center"
              spacing={GAP}
              modifiers={[
                padding({ leading: INSET - 2, trailing: INSET, top: 10, bottom: 14 }),
                frame({ maxWidth: Infinity, alignment: 'leading' }),
              ]}
            >
              <Mark state="done" />
              <Column
                alignment="start"
                spacing={1}
                modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
              >
                <Text textStyle={{ fontSize: 15 }} modifiers={[foregroundStyle(theme.secondary)]}>
                  {ask.question}
                </Text>
                <Text textStyle={{ fontSize: 15 }} modifiers={[foregroundStyle(theme.text)]}>
                  {said}
                </Text>
              </Column>
              <Text
                textStyle={{ fontSize: 15, fontWeight: '600' }}
                onPress={() => onUndo(ask)}
                modifiers={[
                  foregroundStyle(theme.accent),
                  ...(ios ? [accessibilityLabel(`Undo ${said}`)] : []),
                ]}
              >
                Undo
              </Text>
            </Row>
          );
        return <AskCard key={ask.id} ask={ask} first={i === 0} width={width} onAnswer={onAnswer} />;
      })}
    </Column>
  );
}

function AskCard({
  ask,
  first,
  width,
  onAnswer,
}: {
  ask: Ask;
  first: boolean;
  width: number;
  onAnswer: Answer;
}) {
  const [writing, setWriting] = useState(false);
  const [whole, setWhole] = useState(false);
  return (
    <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      <Column
        alignment="start"
        spacing={4}
        modifiers={[
          padding({ leading: INSET, trailing: INSET, top: first ? 2 : 22, bottom: 12 }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        <Row alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
          <Text
            textStyle={{ fontSize: QUESTION, lineHeight: LINE, fontWeight: '600' }}
            modifiers={[
              foregroundStyle(theme.text),
              frame({ maxWidth: Infinity, alignment: 'leading' }),
            ]}
          >
            {ask.question}
          </Text>
          <Row
            alignment="center"
            spacing={0}
            style={{ width: PENCIL, height: PENCIL }}
            onPress={() => setWriting(!writing)}
            modifiers={[
              padding({ top: (LINE - PENCIL) / 2, bottom: (LINE - PENCIL) / 2 }),
              ...(ios
                ? [accessibilityLabel(writing ? 'Close your answer' : 'Write your own')]
                : []),
            ]}
          >
            <Spacer flexible />
            <Icon
              name="square.and.pencil"
              size={15}
              color={writing ? theme.accent : theme.secondary}
            />
          </Row>
        </Row>
        {ask.context ? (
          <Text
            textStyle={{ fontSize: 15, lineHeight: 20 }}
            onPress={() => setWhole(!whole)}
            modifiers={[
              foregroundStyle(theme.secondary),
              whole ? lineLimit() : lineLimit(4),
              animation(motion.list, whole),
              ...(ios ? [accessibilityLabel(whole ? 'Show less' : 'Show all')] : []),
            ]}
          >
            {ask.context}
          </Text>
        ) : null}
        {ask.links?.length ? <Links links={ask.links} /> : null}
      </Column>
      {writing ? (
        <Composer
          draft={`ask:${ask.id}`}
          topic={ask.topic}
          onSend={(label) => onAnswer(ask, { label })}
        />
      ) : (
        <Answers ask={ask} width={width} onAnswer={onAnswer} />
      )}
    </Column>
  );
}

function Links({ links }: { links: AskLink[] }) {
  return (
    <Row alignment="center" spacing={6} modifiers={[padding({ top: 4 })]}>
      {links.map((link, i) => (
        <Row key={link.url} alignment="center" spacing={6}>
          {i ? (
            <Text textStyle={{ fontSize: 15 }} modifiers={[foregroundStyle(theme.tertiary)]}>
              ·
            </Text>
          ) : null}
          <Row
            alignment="center"
            spacing={3}
            onPress={() => void Linking.openURL(link.url)}
            modifiers={ios ? [accessibilityLabel(`Open ${link.label}`)] : []}
          >
            <Text
              numberOfLines={1}
              textStyle={{ fontSize: 15 }}
              modifiers={[foregroundStyle(theme.secondary)]}
            >
              {link.label}
            </Text>
            <Icon name="arrow.up.right" size={11} color={theme.secondary} />
          </Row>
        </Row>
      ))}
    </Row>
  );
}

export function InlineAnswers({
  ask,
  size,
  onAnswer,
  modifiers,
}: {
  ask: Ask;
  size: 15 | 17;
  onAnswer: Answer;
  modifiers: ModifierConfig[];
}) {
  const gap = size - 1;
  return (
    <Row alignment="center" spacing={gap} modifiers={modifiers}>
      {ask.options.map((option, i) => (
        <Row key={option.label} alignment="center" spacing={gap}>
          {i ? (
            <Rectangle
              modifiers={[frame({ width: 1, height: gap }), foregroundStyle(theme.edge)]}
            />
          ) : null}
          <Row
            alignment="center"
            spacing={Math.round(size / 3)}
            onPress={() => onAnswer(ask, option)}
            modifiers={[
              padding({ top: 6, bottom: 4 }),
              ...(ios
                ? [accessibilityLabel(option.pick ? `${option.label}, hex’s pick` : option.label)]
                : []),
            ]}
          >
            {option.pick ? <Icon name="checkmark" size={size - 3} color={theme.accent} /> : null}
            <Text
              numberOfLines={1}
              textStyle={{ fontSize: size, fontWeight: option.pick ? '600' : '500' }}
              modifiers={[foregroundStyle(option.pick ? theme.accent : theme.secondary)]}
            >
              {option.label}
            </Text>
          </Row>
        </Row>
      ))}
    </Row>
  );
}

function Answers({ ask, width, onAnswer }: { ask: Ask; width: number; onAnswer: Answer }) {
  if (!ask.options.length) return null;
  if (fitsOneLine(ask.options, width - 2 * INSET, QUESTION))
    return (
      <InlineAnswers
        ask={ask}
        size={QUESTION}
        onAnswer={onAnswer}
        modifiers={[padding({ leading: INSET, trailing: INSET, top: 2, bottom: 14 })]}
      />
    );
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
    </Row>
  );
}

function Composer({
  draft,
  topic,
  onSend,
}: {
  draft: string;
  topic: string;
  onSend: (text: string) => void;
}) {
  const { first, keep } = useDraft(draft);
  const [text, setText] = useState(first);
  const typing = useContext(Typing);
  const note = text.trim();
  return (
    <Row
      alignment="end"
      spacing={10}
      modifiers={[
        padding({ leading: 14, trailing: 6, top: 6, bottom: 6 }),
        frame({ minHeight: ROW - 8 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        background(theme.surface),
        clipShape('roundedRectangle', radius.control),
        strokeBorder({
          content: theme.edge,
          style: { lineWidth: 1 },
          shape: 'roundedRectangle',
          cornerRadius: radius.control,
        }),
        padding({ leading: INSET - 6, trailing: INSET - 6, top: 6, bottom: 6 }),
      ]}
    >
      <TextInput
        autoFocus
        multiline
        testID="ask-input"
        onFocus={() => typing(true)}
        onBlur={() => typing(false)}
        defaultValue={first}
        placeholder={`Your answer or a note for ${topic}`}
        placeholderTextColor={theme.tertiary}
        cursorColor={theme.accent}
        onChangeText={(now) => {
          setText(now);
          keep(now);
        }}
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
