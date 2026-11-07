import { Column, Icon, Row, Spacer, TextInput } from '@expo/ui';
import { Button, HStack, Rectangle, SwipeActions, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityElement,
  accessibilityIdentifier,
  accessibilityLabel,
  animation,
  background,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  contentShape,
  disabled,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  onTapGesture,
  padding,
  shapes,
  strokeBorder,
  tint,
  type ModifierConfig,
} from '@expo/ui/swift-ui/modifiers';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { Markdown } from '@/components/markdown';
import { Mark } from '@/components/tasks/mark';
import { Typing, useField } from '@/components/tasks/pages';
import { noteAsk, useWords } from '@/hooks/use-asks';
import { carryDraft, useDraft } from '@/hooks/use-draft';
import { openURL, useFailures } from '@/hooks/use-failures';
import { Failure, NotNeededButton, SectionHead, listRow } from '@/components/tasks/parts';
import { unreached, type Ask, type AskLink, type AskOption, type Words } from '@/live/asks';
import { fitsOneLine } from '@/live/inbox';
import { clock } from '@/live/tasks';
import { motion } from '@/motion';
import { theme } from '@/theme';
import { Text } from '@/ui/text';
import { labelOf, metrics, radius, space, type } from '@/ui/tokens';

// Compact, so a page of many asks scans: folded, a question and a line of why; open, its choices
// on one line where they fit.
const ROW = 40;
// How much of the thread's own words show before a tap shows them all.
const SAID = 6;
// The pencil takes taps across 44 points but only the question's first line of height.
const PENCIL = metrics.bar.button;
const LINE = type.question.lineHeight;

type Answer = (ask: Ask, option: AskOption) => void;

// The project page's asks, each a row of its list, so a swipe left on one puts it away.
export function YourCall({
  asks,
  answered,
  width,
  onAnswer,
  onUndo,
  onAgain,
  onDismiss,
}: {
  asks: Ask[];
  answered: Record<string, string | null>;
  width: number;
  onAnswer: Answer;
  onUndo: (ask: Ask) => void;
  onAgain: (ask: Ask) => void;
  onDismiss: (ask: Ask) => void;
}) {
  const open = asks.filter((ask) => !answered[ask.id]).length;
  const row = (i: number) => listRow(width, { top: i > 0, bottom: i < asks.length - 1 });
  return (
    <>
      <Column
        alignment="start"
        spacing={0}
        modifiers={listRow(width, { top: false, bottom: false })}
      >
        <SectionHead title="Your call" count={open} />
      </Column>
      {asks.map((ask, i) => {
        const said = answered[ask.id];
        if (said)
          return (
            <Row
              key={ask.id}
              alignment="center"
              spacing={metrics.list.gap}
              modifiers={[
                padding({
                  leading: metrics.list.inset - space[0.5],
                  trailing: metrics.list.inset,
                  top: space[2.5],
                  bottom: space[3.5],
                }),
                frame({ maxWidth: Infinity, alignment: 'leading' }),
                ...row(i),
              ]}
            >
              <Mark state="done" />
              <Column
                alignment="start"
                spacing={space[0.25]}
                modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
              >
                <Text variant="subheadline" tone="secondary">
                  {ask.question}
                </Text>
                <Text variant="subheadline">{said}</Text>
                {ask.missed ? <Unreached missed={ask.missed} onAgain={() => onAgain(ask)} /> : null}
                {ask.failed ? <Failure text={ask.failed} /> : null}
              </Column>
              <Text
                variant="subheadline"
                weight="semibold"
                tone="accent"
                onPress={() => onUndo(ask)}
                modifiers={[accessibilityLabel(`Undo ${said}`)]}
              >
                Undo
              </Text>
            </Row>
          );
        return (
          <SwipeActions key={ask.id} modifiers={row(i)}>
            <AskCard ask={ask} first={i === 0} width={width} onAnswer={onAnswer} />
            <SwipeActions.Actions edge="trailing">
              <NotNeededButton onPress={() => onDismiss(ask)} />
            </SwipeActions.Actions>
          </SwipeActions>
        );
      })}
    </>
  );
}

// Folded like a project row, the question and the first line of its background; a tap opens the
// background whole, the thread's own words, and the answers. Writing on it keeps it open.
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
  // Words typed on it and not sent open it on them, so they're never out of sight: after the page
  // closes, and once hex's check lists it under a new id.
  const [held] = useState(
    () => !!carryDraft(`ask:${ask.id}`, ask.was?.map((id) => `ask:${id}`) ?? []).trim(),
  );
  const [open, setOpen] = useState(held);
  // 'held' opens the field without raising the keyboard; a tap in it raises it.
  const [writing, setWriting] = useState<boolean | 'held'>(held && 'held');
  const words = useWords(open ? ask.id : null);
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
  // What last didn't go through on it, folded or open.
  const failed = notes.failed.note ?? ask.failed;
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity }), animation(motion.list, open)]}
    >
      <HStack
        alignment="top"
        spacing={0}
        modifiers={[
          padding({
            leading: metrics.list.inset,
            top: first ? space[0.5] : space[3],
            bottom: open ? space[1.5] : space[3],
          }),
          frame({ maxWidth: Infinity }),
        ]}
      >
        <VStack
          alignment="leading"
          spacing={space[0.75]}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: 'leading' }),
            contentShape(shapes.rectangle()),
            onTapGesture(() => setOpen(!open)),
            accessibilityIdentifier('ask-card'),
            accessibilityLabel(`${ask.question}. ${open ? 'Folds it' : 'Opens it'}`),
          ]}
        >
          <Text
            variant="question"
            paragraph
            modifiers={[
              open ? lineLimit() : lineLimit(2),
              frame({ maxWidth: Infinity, alignment: 'leading' }),
            ]}
          >
            {ask.question}
          </Text>
          {ask.context ? (
            <Text
              variant="itemDetail"
              tone="secondary"
              paragraph
              modifiers={[
                open ? lineLimit() : lineLimit(1),
                frame({ maxWidth: Infinity, alignment: 'leading' }),
              ]}
            >
              {ask.context}
            </Text>
          ) : null}
        </VStack>
        {open ? (
          <Row
            alignment="center"
            spacing={0}
            style={{ width: PENCIL, height: PENCIL }}
            onPress={() => setWriting(!writing)}
            modifiers={[
              padding({ top: (LINE - PENCIL) / 2, bottom: (LINE - PENCIL) / 2 }),
              accessibilityLabel(writing ? 'Close your answer' : 'Write your own'),
            ]}
          >
            <Spacer flexible />
            <Icon
              name="square.and.pencil"
              size={15}
              color={writing ? theme.accent : theme.secondary}
            />
          </Row>
        ) : (
          <Text
            variant="footnote"
            tone="tertiary"
            modifiers={[
              monospacedDigit(),
              padding({ leading: metrics.list.gap, trailing: metrics.list.inset }),
            ]}
          >
            {clock(new Date(ask.at))}
          </Text>
        )}
      </HStack>
      {open ? (
        <Column
          alignment="start"
          spacing={space[0.75]}
          modifiers={[
            padding({
              leading: metrics.list.inset,
              trailing: metrics.list.inset,
              bottom: space[1.5],
            }),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        >
          {words ? <Said words={words} /> : null}
          {ask.links?.length ? <Links links={ask.links} /> : null}
          {noted && !notes.failed.note ? (
            <Text
              variant="footnote"
              tone="secondary"
              paragraph
              modifiers={[padding({ top: space[1] })]}
            >
              {`Sent to ${ask.topic} as a note. The question is still open.`}
            </Text>
          ) : null}
        </Column>
      ) : null}
      {failed ? (
        <Failure
          text={failed}
          modifiers={[
            padding({
              leading: metrics.list.inset,
              trailing: metrics.list.inset,
              bottom: open ? space[1.5] : space[3],
            }),
          ]}
        />
      ) : null}
      {!open ? null : writing ? (
        <Composer
          draft={`ask:${ask.id}`}
          focus={writing === true}
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

// The thread's own words, under where and when they were said: a few lines, all of them on a tap.
function Said({ words }: { words: Words }) {
  const [whole, setWhole] = useState(false);
  const when = words.at ? ` · ${clock(new Date(words.at))}` : '';
  return (
    <Column
      alignment="start"
      spacing={space[0.5]}
      onPress={() => setWhole(!whole)}
      modifiers={[
        padding({ top: space[2], bottom: space[0.5] }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
        animation(motion.list, whole),
        accessibilityElement('combine'),
      ]}
    >
      <Text variant="footnote" weight="semibold" tone="secondary">
        {`From ${words.place}${when}`}
      </Text>
      <Markdown
        inline={!whole}
        lines={whole ? undefined : SAID}
        variant="itemDetail"
        tone="secondary"
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        {words.text}
      </Markdown>
    </Column>
  );
}

function Links({ links }: { links: AskLink[] }) {
  const tries = useFailures();
  const failed = links.map((link) => tries.failed[link.url]).find(Boolean);
  return (
    <Column alignment="start" spacing={space[1]} modifiers={[padding({ top: space[1] })]}>
      <Row alignment="center" spacing={space[1.5]}>
        {links.map((link, i) => (
          <Row key={link.url} alignment="center" spacing={space[1.5]}>
            {i ? (
              <Text variant="subheadline" tone="tertiary">
                ·
              </Text>
            ) : null}
            <Row
              alignment="center"
              spacing={space[0.75]}
              onPress={() => void tries.attempt(link.url, 'Not opened', () => openURL(link.url))}
              modifiers={[accessibilityLabel(`Open ${link.label}`)]}
            >
              <Text numberOfLines={1} variant="subheadline" tone="secondary">
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
  onAnswer,
  modifiers,
}: {
  ask: Ask;
  onAnswer: Answer;
  modifiers: ModifierConfig[];
}) {
  return (
    <Row alignment="center" spacing={space[3.5]} modifiers={modifiers}>
      {ask.options.map((option, i) => (
        <Row key={option.label} alignment="center" spacing={space[3.5]}>
          {i ? (
            <Rectangle
              modifiers={[frame({ width: 1, height: space[3.5] }), foregroundStyle(theme.edge)]}
            />
          ) : null}
          <Row
            alignment="center"
            spacing={space[1.25]}
            onPress={() => onAnswer(ask, option)}
            modifiers={[
              padding({ top: space[1.5], bottom: space[1] }),
              accessibilityLabel(option.pick ? `${option.label}, hex’s pick` : option.label),
            ]}
          >
            {option.pick ? <Icon name="checkmark" size={12} color={theme.accent} /> : null}
            <Text
              numberOfLines={1}
              variant="subheadline"
              weight={option.pick ? 'semibold' : 'medium'}
              tone={option.pick ? 'accent' : 'secondary'}
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
  if (fitsOneLine(ask.options, width - 2 * metrics.list.inset, type.subheadline.fontSize))
    return (
      <InlineAnswers
        ask={ask}
        onAnswer={onAnswer}
        modifiers={[
          padding({
            leading: metrics.list.inset,
            trailing: metrics.list.inset,
            top: 0,
            bottom: space[2.5],
          }),
        ]}
      />
    );
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity }), padding({ bottom: space[1] })]}
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
      spacing={space[3]}
      onPress={onPress}
      modifiers={[
        padding({
          leading: metrics.list.inset,
          trailing: metrics.list.inset,
          top: space[1.5],
          bottom: space[1.5],
        }),
        frame({ minHeight: ROW }),
        frame({ maxWidth: Infinity }),
        contentShape(shapes.rectangle()),
        accessibilityLabel(option.pick ? `${option.label}, hex’s pick` : option.label),
      ]}
    >
      {option.pick ? (
        <Icon name="checkmark" size={14} color={theme.accent} />
      ) : (
        <Spacer style={{ width: 14 }} />
      )}
      <Text
        variant="subheadline"
        weight={option.pick ? 'medium' : 'regular'}
        tone={option.pick ? 'accent' : 'text'}
        paragraph
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        {option.label}
      </Text>
      {option.pick ? (
        <Text variant="caption" weight="medium" tone="accent">
          hex’s pick
        </Text>
      ) : null}
    </Row>
  );
}

// What you write goes where the button you tap says: Answer, the one accent action, answers the
// ask with your words; Send as note tells its thread and leaves the ask open. Neither goes while a
// note is on its way. With the keyboard down they sit in the field's box, under the words; while
// you type they move to the page's foot, just above the keyboard, since the list keeps only the
// field in sight above it. Not needed is the row's swipe left.
function Composer({
  draft,
  focus,
  topic,
  sending,
  onNote,
  onAnswer,
}: {
  draft: string;
  focus: boolean;
  topic: string;
  sending: boolean;
  onNote: (text: string) => void;
  onAnswer: (text: string) => void;
}) {
  const { first, keep } = useDraft(draft);
  const [text, setText] = useState(first);
  const [typing, setTyping] = useState(false);
  const typingHere = useTyping();
  const toFoot = useContext(AnswerBar);
  const field = useField();
  const words = sending ? '' : text.trim();
  useEffect(() => {
    toFoot(draft, typing ? { words, onNote, onAnswer } : null);
  }, [typing, words]);
  useEffect(() => () => toFoot(draft, null), []);
  const type = (now: boolean) => {
    setTyping(now);
    typingHere(now);
  };
  return (
    <VStack
      alignment="trailing"
      spacing={0}
      modifiers={[
        frame({ maxWidth: Infinity }),
        background(theme.surface),
        clipShape('roundedRectangle', radius.control),
        strokeBorder({
          content: theme.edge,
          style: { lineWidth: 1 },
          shape: 'roundedRectangle',
          cornerRadius: radius.control,
        }),
        padding({
          leading: metrics.list.inset - space[1.5],
          trailing: metrics.list.inset - space[1.5],
          top: space[1.5],
          bottom: space[3],
        }),
      ]}
    >
      <TextInput
        ref={field}
        autoFocus={focus}
        multiline
        testID="ask-input"
        onFocus={() => type(true)}
        onBlur={() => type(false)}
        defaultValue={first}
        placeholder={`Your answer, or a note for ${topic}`}
        placeholderTextColor={theme.tertiary}
        cursorColor={theme.accent}
        onChangeText={(now) => {
          setText(now);
          keep(now);
        }}
        textStyle={labelOf('body')}
        modifiers={[
          foregroundStyle(theme.text),
          padding({ leading: space[3.5], trailing: space[3.5], top: space[3], bottom: space[3] }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
        ]}
      />
      {typing ? null : (
        <Sends
          words={words}
          onNote={onNote}
          onAnswer={onAnswer}
          modifiers={[padding({ trailing: space[2.5], bottom: space[2.5] })]}
        />
      )}
    </VStack>
  );
}

// Says the field is being typed in, and stops saying so when it goes: a note or an answer takes
// the field away with the keyboard still up, and iOS never tells a field that's gone it lost focus,
// so the page would keep its foot hidden for typing.
function useTyping() {
  const typing = useContext(Typing);
  const on = useRef(false);
  useEffect(
    () => () => {
      if (on.current) typing(false);
    },
    [],
  );
  return (now: boolean) => {
    on.current = now;
    typing(now);
  };
}

// The sends of the ask being typed on, which its page draws in its foot. Each card says whose they
// are, so one card's note or leaving never takes away another's.
export type Typed = {
  words: string;
  onNote: (words: string) => void;
  onAnswer: (words: string) => void;
};
const AnswerBar = createContext<(from: string, typed: Typed | null) => void>(() => {});

export function useAnswerBar() {
  const [shown, setShown] = useState<(Typed & { from: string }) | null>(null);
  const show = useCallback(
    (from: string, typed: Typed | null) =>
      setShown((now) => (typed ? { ...typed, from } : now?.from === from ? null : now)),
    [],
  );
  return { typed: shown, AnswerBar: AnswerBar.Provider, show };
}

// The page's foot while an ask is typed on: its two sends, just above the keyboard.
export function AnswerFoot({ typed }: { typed: Typed }) {
  return (
    <Sends
      {...typed}
      modifiers={[
        padding({ leading: space[4], trailing: space[4], top: space[2], bottom: space[2] }),
        frame({ maxWidth: Infinity, alignment: 'trailing' }),
      ]}
    />
  );
}

// The two ways what's typed can go, the answer the prominent one, each waiting until there's
// something to send.
function Sends({ words, onNote, onAnswer, modifiers }: Typed & { modifiers: ModifierConfig[] }) {
  return (
    <HStack spacing={space[2]} modifiers={modifiers}>
      <Button
        label="Send as note"
        systemImage="text.bubble"
        onPress={() => onNote(words)}
        modifiers={[
          buttonStyle('bordered'),
          buttonBorderShape('capsule'),
          tint(theme.text),
          disabled(!words),
        ]}
      />
      <Button
        label="Answer"
        systemImage="checkmark"
        onPress={() => onAnswer(words)}
        modifiers={[
          buttonStyle('borderedProminent'),
          buttonBorderShape('capsule'),
          tint(theme.accentSolid),
          disabled(!words),
        ]}
      />
    </HStack>
  );
}

// An answer that couldn't reach every place, and the way to finish it.
export function Unreached({ missed, onAgain }: { missed: number; onAgain: () => void }) {
  return (
    <Row alignment="center" spacing={space[2]} modifiers={[frame({ maxWidth: Infinity })]}>
      <Failure text={unreached(missed)} />
      <Text
        variant="footnote"
        weight="semibold"
        tone="accent"
        onPress={onAgain}
        modifiers={[padding({ top: space[1.5], bottom: space[1.5] })]}
      >
        Send again
      </Text>
    </Row>
  );
}
