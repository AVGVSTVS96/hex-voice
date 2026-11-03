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

import { Mark } from '@/components/tasks/mark';
import { Typing } from '@/components/tasks/pages';
import { noteAsk } from '@/hooks/use-asks';
import { useDraft } from '@/hooks/use-draft';
import { openURL, useFailures } from '@/hooks/use-failures';
import { Failure, GAP, Hairline, INSET, SectionHead, ios } from '@/components/tasks/parts';
import { unreached, type Ask, type AskLink, type AskOption } from '@/live/asks';
import { fitsOneLine } from '@/live/inbox';
import { motion, rowsKey } from '@/motion';
import { radius, theme } from '@/theme';

// Compact, so a page of many asks scans: a question, two lines of why, and its choices on one
// line where they fit.
const ROW = 40;
const QUESTION = 16;
const ANSWER = 15;
const CONTEXT = 2;
// The pencil takes taps across 44 points but only the question's first line of height.
const PENCIL = 44;
const LINE = 21;

type Answer = (ask: Ask, option: AskOption) => void;

export function YourCall({
  asks,
  answered,
  width,
  onAnswer,
  onUndo,
  onAgain,
}: {
  asks: Ask[];
  answered: Record<string, string | null>;
  width: number;
  onAnswer: Answer;
  onUndo: (ask: Ask) => void;
  onAgain: (ask: Ask) => void;
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
                {ask.missed ? <Unreached missed={ask.missed} onAgain={() => onAgain(ask)} /> : null}
                {ask.failed ? <Failure text={ask.failed} /> : null}
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
        return (
          <Column
            key={ask.id}
            alignment="start"
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity })]}
          >
            {i ? <Hairline /> : null}
            <AskCard ask={ask} first={i === 0} width={width} onAnswer={onAnswer} />
          </Column>
        );
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
  // A note leaves the ask open, so the card stays and says it went, or why it didn't.
  const notes = useFailures();
  const [noting, setNoting] = useState(false);
  const [noted, setNoted] = useState(false);
  const note = (text: string) => {
    setNoting(true);
    void notes
      .attempt('note', 'Note not sent', () => noteAsk(ask, text))
      .then((sent) => {
        setNoting(false);
        setNoted(sent);
        if (sent) setWriting(false);
      });
  };
  return (
    <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      <Column
        alignment="start"
        spacing={3}
        modifiers={[
          padding({ leading: INSET, trailing: INSET, top: first ? 2 : 12, bottom: 6 }),
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
            textStyle={{ fontSize: 14, lineHeight: 19 }}
            onPress={() => setWhole(!whole)}
            modifiers={[
              foregroundStyle(theme.secondary),
              whole ? lineLimit() : lineLimit(CONTEXT),
              animation(motion.list, whole),
              ...(ios ? [accessibilityLabel(whole ? 'Show less' : 'Show all')] : []),
            ]}
          >
            {ask.context}
          </Text>
        ) : null}
        {ask.links?.length ? <Links links={ask.links} /> : null}
        {notes.failed.note ? (
          <Failure text={notes.failed.note} modifiers={[padding({ top: 4 })]} />
        ) : noted ? (
          <Text
            textStyle={{ fontSize: 13, lineHeight: 18 }}
            modifiers={[foregroundStyle(theme.secondary), padding({ top: 4 })]}
          >
            {`Note sent to ${ask.topic}`}
          </Text>
        ) : ask.failed ? (
          <Failure text={ask.failed} modifiers={[padding({ top: 4 })]} />
        ) : null}
      </Column>
      {writing ? (
        <Composer
          draft={`ask:${ask.id}`}
          topic={ask.topic}
          sending={noting}
          onNote={note}
          onAnswer={(label) => onAnswer(ask, { label })}
        />
      ) : (
        <Answers ask={ask} width={width} onAnswer={onAnswer} />
      )}
    </Column>
  );
}

function Links({ links }: { links: AskLink[] }) {
  const tries = useFailures();
  const failed = links.map((link) => tries.failed[link.url]).find(Boolean);
  return (
    <Column alignment="start" spacing={4} modifiers={[padding({ top: 4 })]}>
      <Row alignment="center" spacing={6}>
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
              onPress={() => void tries.attempt(link.url, 'Not opened', () => openURL(link.url))}
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
      {failed ? <Failure text={failed} /> : null}
    </Column>
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
  if (fitsOneLine(ask.options, width - 2 * INSET, ANSWER))
    return (
      <InlineAnswers
        ask={ask}
        size={ANSWER}
        onAnswer={onAnswer}
        modifiers={[padding({ leading: INSET, trailing: INSET, top: 0, bottom: 10 })]}
      />
    );
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity }), padding({ bottom: 4 })]}
    >
      {ask.options.map((option) => (
        <Choice key={option.label} option={option} onPress={() => onAnswer(ask, option)} />
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
        padding({ leading: INSET, trailing: INSET, top: 6, bottom: 6 }),
        frame({ minHeight: ROW }),
        frame({ maxWidth: Infinity }),
        contentShape(shapes.rectangle()),
        ...(ios
          ? [accessibilityLabel(option.pick ? `${option.label}, hex’s pick` : option.label)]
          : []),
      ]}
    >
      {option.pick ? (
        <Icon name="checkmark" size={14} color={theme.accent} />
      ) : (
        <Spacer style={{ width: 14 }} />
      )}
      <Text
        textStyle={{ fontSize: ANSWER, lineHeight: 20, fontWeight: option.pick ? '500' : '400' }}
        modifiers={[
          foregroundStyle(option.pick ? theme.accent : theme.text),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      >
        {option.label}
      </Text>
      {option.pick ? (
        <Text
          textStyle={{ fontSize: 12, fontWeight: '500' }}
          modifiers={[foregroundStyle(theme.accent)]}
        >
          hex’s pick
        </Text>
      ) : null}
    </Row>
  );
}

// What you write goes to the ask's thread as a note and leaves the ask open; answering with it
// instead is the deliberate second step. Neither goes while a note is on its way.
function Composer({
  draft,
  topic,
  sending,
  onNote,
  onAnswer,
}: {
  draft: string;
  topic: string;
  sending: boolean;
  onNote: (text: string) => void;
  onAnswer: (text: string) => void;
}) {
  const { first, keep } = useDraft(draft);
  const [text, setText] = useState(first);
  const typing = useContext(Typing);
  const words = sending ? '' : text.trim();
  return (
    <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
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
          placeholder={`A note for ${topic}`}
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
          color={words ? theme.accent : theme.tertiary}
          onPress={words ? () => onNote(words) : undefined}
          modifiers={ios ? [accessibilityLabel(`Send a note to ${topic}`)] : []}
        />
      </Row>
      <Text
        textStyle={{ fontSize: 15, fontWeight: '600' }}
        onPress={words ? () => onAnswer(words) : undefined}
        modifiers={[
          foregroundStyle(words ? theme.accent : theme.tertiary),
          padding({ leading: INSET, trailing: INSET, top: 4, bottom: 10 }),
        ]}
      >
        Answer with this
      </Text>
    </Column>
  );
}

// An answer that couldn't reach every place, and the way to finish it.
export function Unreached({ missed, onAgain }: { missed: number; onAgain: () => void }) {
  return (
    <Row alignment="center" spacing={8} modifiers={[frame({ maxWidth: Infinity })]}>
      <Failure text={unreached(missed)} />
      <Text
        textStyle={{ fontSize: 13, fontWeight: '600' }}
        onPress={onAgain}
        modifiers={[foregroundStyle(theme.accent), padding({ top: 6, bottom: 6 })]}
      >
        Send again
      </Text>
    </Row>
  );
}
