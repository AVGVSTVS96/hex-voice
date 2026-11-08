import { Column, Icon, Row, Spacer, TextInput } from '@expo/ui';
import { HStack, SwipeActions, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityAddTraits,
  accessibilityElement,
  accessibilityIdentifier,
  accessibilityLabel,
  animation,
  background,
  clipShape,
  contentShape,
  fixedSize,
  foregroundStyle,
  frame,
  monospacedDigit,
  onTapGesture,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import type { ModifierConfig } from '@expo/ui/swift-ui/modifiers';
import { useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { Markdown } from '@/components/markdown';
import { Mark } from '@/components/tasks/mark';
import { Typing, useField } from '@/components/tasks/pages';
import { noteAsk, shotOf, useWords } from '@/hooks/use-asks';
import { carryDraft, useDraft } from '@/hooks/use-draft';
import { openURL, useFailures } from '@/hooks/use-failures';
import { Failure, NotNeededButton, Pill, StageHead, listRow } from '@/components/tasks/parts';
import { NOT_NEEDED, PICK, unreached } from '@/live/asks';
import type { Ask, AskLink, AskOption, Words } from '@/live/asks';
import { clock } from '@/live/tasks';
import { motion } from '@/motion';
import { theme } from '@/theme';
import { EvenRow, Fits } from '../../../modules/rows';
import { ShotsView } from '../../../modules/shots';
import { Text } from '@/ui/text';
import { labelOf, metrics, radius, space } from '@/ui/tokens';

// How much of the thread's own words show before a tap shows them all.
const SAID = 6;
// Most choices that share a row, each its own pill, as Muse sets Deny and Allow.
const SIDE_BY_SIDE = 3;
// A card keeps in from the page's sides, and its words from its own edges.
const MARGIN = space[3];
const INSIDE = space[4];

type Answer = (ask: Ask, option: AskOption) => void;

// The project page's asks, each a card in a row of its list, so a swipe left on one puts it away.
export const YourCall = ({
  asks,
  answered,
  onAnswer,
  onUndo,
  onAgain,
  onDismiss,
}: {
  asks: Ask[];
  answered: Record<string, string | null>;
  onAnswer: Answer;
  onUndo: (ask: Ask) => void;
  onAgain: (ask: Ask) => void;
  onDismiss: (ask: Ask) => void;
}) => {
  const open = asks.filter((ask) => !answered[ask.id]).length;
  return (
    <>
      <Column alignment="start" spacing={0} modifiers={listRow()}>
        <StageHead tint="needs" title="Needs you" count={open || undefined} />
      </Column>
      {asks.map((ask) => {
        const said = answered[ask.id];
        if (said) {
          return (
            <Card key={ask.id}>
              <HStack alignment="top" spacing={metrics.list.gap}>
                <Mark state="done" />
                <VStack
                  alignment="leading"
                  spacing={space[1]}
                  modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
                >
                  <Text variant="detail" tone="secondary" paragraph>
                    {ask.question}
                  </Text>
                  <Text variant="body" paragraph>
                    {said}
                  </Text>
                  {ask.missed ? (
                    <Unreached
                      missed={ask.missed}
                      onAgain={() => {
                        onAgain(ask);
                      }}
                    />
                  ) : null}
                  {ask.failed ? <Failure text={ask.failed} /> : null}
                </VStack>
                <Pill
                  label="Undo"
                  accessibility={`Undo ${said}`}
                  onPress={() => {
                    onUndo(ask);
                  }}
                  small
                />
              </HStack>
            </Card>
          );
        }
        return (
          <SwipeActions key={ask.id} modifiers={listRow()}>
            <AskCard ask={ask} onAnswer={onAnswer} onDismiss={onDismiss} />
            <SwipeActions.Actions edge="trailing">
              <NotNeededButton
                onPress={() => {
                  onDismiss(ask);
                }}
              />
            </SwipeActions.Actions>
          </SwipeActions>
        );
      })}
    </>
  );
};

// A card on the page, as Muse sets an approval: its own surface, apart from the next by air.
const Card = ({ children }: { children: ReactNode }) => (
  <VStack
    alignment="leading"
    spacing={space[3]}
    modifiers={[
      padding({ all: INSIDE }),
      frame({ maxWidth: Infinity, alignment: 'leading' }),
      background(theme.card),
      clipShape('roundedRectangle', radius.group),
      padding({ leading: MARGIN, trailing: MARGIN, bottom: space[3] }),
      ...listRow(),
    ]}
  >
    {children}
  </VStack>
);

// The question first and large, why hex asks under it in gray, then the choices as pills; a tap
// on the words opens where it was asked and the thread's own words. Writing on it keeps it open.
const AskCard = ({
  ask,
  onAnswer,
  onDismiss,
}: {
  ask: Ask;
  onAnswer: Answer;
  onDismiss: (ask: Ask) => void;
}) => {
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
      .attempt('note', 'Note not sent', async () => {
        await noteAsk(ask, text);
      })
      .then((sent) => {
        setNoting(false);
        setNoted(sent);
        if (sent) {
          setWriting(false);
        }
      });
  };
  // What last didn't go through on it, folded or open.
  const failed = notes.failed.note ?? ask.failed;
  return (
    <Card>
      <HStack
        alignment="center"
        spacing={space[2]}
        modifiers={[frame({ maxWidth: Infinity }), animation(motion.list, open)]}
      >
        <Text
          variant="caption"
          tone="tertiary"
          modifiers={[monospacedDigit(), frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          {clock(new Date(ask.at))}
        </Text>
        <Icon
          name="square.and.pencil"
          size={metrics.symbol.bar}
          color={writing ? theme.text : theme.secondary}
          modifiers={[
            frame({ width: metrics.bar.button, height: metrics.symbol.bar, alignment: 'trailing' }),
            contentShape(shapes.rectangle()),
            onTapGesture(() => {
              setOpen(true);
              setWriting(!writing);
            }),
            accessibilityLabel(writing ? 'Close your answer' : 'Write your own'),
            accessibilityAddTraits(['isButton']),
          ]}
        />
      </HStack>
      <VStack
        alignment="leading"
        spacing={space[2]}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          contentShape(shapes.rectangle()),
          onTapGesture(() => {
            setOpen(!open);
          }),
          accessibilityIdentifier('ask-card'),
          accessibilityLabel(`${ask.question}. ${open ? 'Folds it' : 'Opens it'}`),
        ]}
      >
        <Text
          variant="headline"
          paragraph
          modifiers={[
            fixedSize({ horizontal: false, vertical: true }),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        >
          {ask.question}
        </Text>
        {ask.context ? (
          <Text
            variant="detail"
            tone="secondary"
            paragraph
            modifiers={[
              fixedSize({ horizontal: false, vertical: true }),
              frame({ maxWidth: Infinity, alignment: 'leading' }),
            ]}
          >
            {ask.context}
          </Text>
        ) : null}
      </VStack>
      {open && (words || ask.links?.length) ? (
        <VStack
          alignment="leading"
          spacing={space[2]}
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          {words ? <Said words={words} /> : null}
          {ask.links?.length ? <Links links={ask.links} /> : null}
        </VStack>
      ) : null}
      {noted && !notes.failed.note ? (
        <Text variant="caption" tone="secondary" paragraph>
          {`Sent to ${ask.topic} as a note. The question is still open.`}
        </Text>
      ) : null}
      {failed ? <Failure text={failed} /> : null}
      <Shots ask={ask} />
      {writing ? (
        <Composer
          draft={`ask:${ask.id}`}
          focus={writing === true}
          topic={ask.topic}
          sending={noting}
          onNote={note}
          onAnswer={(label) => {
            onAnswer(ask, { label });
          }}
          onDismiss={() => {
            onDismiss(ask);
          }}
        />
      ) : (
        <Answers ask={ask} onAnswer={onAnswer} />
      )}
    </Card>
  );
};

// What each option looks like, when the choice is between looks: its screenshot, over its answer
// when every option has one, and all of them full screen on a tap.
export const Shots = ({ ask }: { ask: Ask }) => {
  const shown = ask.options.filter((option) => option.shot !== undefined);
  if (!shown.length) {
    return null;
  }
  const shots = shown.map((option) => shotOf(ask, option.shot!));
  return (
    <ShotsView
      uris={shots.map((shot) => shot.uri)}
      shapes={shown.map((option) => option.shape ?? 1)}
      headers={shots[0].headers}
      labels={shown.map((option) => option.label)}
      height={metrics.shot}
      gap={space[2]}
      radius={radius.inner}
      secondary={theme.secondary}
      surface={theme.fill}
      edge={theme.edge}
      modifiers={[frame({ maxWidth: Infinity })]}
    />
  );
};

// The thread's own words, under where and when they were said: a few lines, all of them on a tap.
export const Said = ({ words }: { words: Words }) => {
  const [whole, setWhole] = useState(false);
  const when = words.at ? ` · ${clock(new Date(words.at))}` : '';
  return (
    <Column
      alignment="start"
      spacing={space[1]}
      onPress={() => {
        setWhole(!whole);
      }}
      modifiers={[
        padding({ all: space[3] }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        background(theme.fill),
        clipShape('roundedRectangle', radius.inner),
        contentShape(shapes.rectangle()),
        animation(motion.list, whole),
        accessibilityElement('combine'),
      ]}
    >
      <Text variant="caption" tone="secondary">
        {`From ${words.place}${when}`}
      </Text>
      <Markdown
        inline={!whole}
        lines={whole ? undefined : SAID}
        variant="detail"
        tone="secondary"
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        {words.text}
      </Markdown>
    </Column>
  );
};

export const Links = ({ links }: { links: AskLink[] }) => {
  const tries = useFailures();
  const failed = links.map((link) => tries.failed[link.url]).find(Boolean);
  return (
    <Column alignment="start" spacing={space[1]}>
      <Row alignment="center" spacing={space[2]}>
        {links.map((link) => (
          <Pill
            key={link.url}
            label={link.label}
            icon="arrow.up.right"
            accessibility={`Open ${link.label}`}
            onPress={() => {
              void tries.attempt(link.url, 'Not opened', async () => {
                await openURL(link.url);
              });
            }}
            small
          />
        ))}
      </Row>
      {failed ? <Failure text={failed} /> : null}
    </Column>
  );
};

// An ask's choices on its row in the list, as small pills, hex's pick tinted.
export const InlineAnswers = ({
  ask,
  onAnswer,
  modifiers,
}: {
  ask: Ask;
  onAnswer: Answer;
  modifiers: ModifierConfig[];
}) => (
  <Row alignment="center" spacing={space[2]} modifiers={modifiers}>
    {ask.options.map((option) => (
      <Pill
        key={option.label}
        label={option.label}
        pick={option.pick}
        onPress={() => {
          onAnswer(ask, option);
        }}
        small
      />
    ))}
  </Row>
);

// The choices as Muse's pills, side by side when each fits its share of the row. Longer ones are
// read, so each is a block of its own words, whole, one under another. hex's pick is tinted and
// named, so the card holds no solid button that reads as already chosen. Under screenshots, each
// answer sits under its own as a small pill, so its name says which is which in one line.
const Answers = ({ ask, onAnswer }: { ask: Ask; onAnswer: Answer }) => {
  const n = ask.options.length;
  if (!n) {
    return null;
  }
  const shots = ask.options.every((option) => option.shot !== undefined);
  const pills = ask.options.map((option) => (
    <Pill
      key={option.label}
      label={option.label}
      pick={option.pick}
      grow
      small={shots}
      onPress={() => {
        onAnswer(ask, option);
      }}
    />
  ));
  if (shots) {
    return (
      <Row alignment="center" spacing={space[2]} modifiers={[frame({ maxWidth: Infinity })]}>
        {pills}
      </Row>
    );
  }
  const blocks = (
    <Column alignment="start" spacing={space[2]} modifiers={[frame({ maxWidth: Infinity })]}>
      {ask.options.map((option) => (
        <Column
          key={option.label}
          alignment="start"
          spacing={0}
          onPress={() => {
            onAnswer(ask, option);
          }}
          modifiers={[
            padding({ leading: space[4], trailing: space[4], top: space[3], bottom: space[3] }),
            frame({ minHeight: metrics.pill.regular }),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
            background(option.pick ? theme.accentMuted : theme.fill),
            clipShape('roundedRectangle', radius.option),
            contentShape(shapes.rectangle()),
            accessibilityElement('combine'),
            accessibilityLabel(option.pick ? `${option.label}, ${PICK}` : option.label),
            accessibilityAddTraits(['isButton']),
          ]}
        >
          <Text variant="body" weight={option.pick ? 'medium' : 'regular'} paragraph>
            {option.label}
          </Text>
          {option.pick ? (
            <Row alignment="center" spacing={space[1]}>
              <Icon name="sparkle" size={metrics.symbol.mark} color={theme.accent} />
              <Text variant="caption" tone="accent">
                {PICK}
              </Text>
            </Row>
          ) : null}
        </Column>
      ))}
    </Column>
  );
  if (n > SIDE_BY_SIDE) {
    return blocks;
  }
  return (
    <Fits>
      <EvenRow spacing={space[2]} modifiers={[frame({ maxWidth: Infinity })]}>
        {pills}
      </EvenRow>
      {blocks}
    </Fits>
  );
};

// What you write goes to the ask's thread as a note and leaves the ask open: ↑ is the one accent
// action. Answering with it instead is the deliberate second step, drawn in text and not accent so
// it never reads as already answered, and Not needed puts the ask away with no answer at all.
// None of them goes while a note is on its way.
const Composer = ({
  draft,
  focus,
  topic,
  sending,
  onNote,
  onAnswer,
  onDismiss,
}: {
  draft: string;
  focus: boolean;
  topic: string;
  sending: boolean;
  onNote: (text: string) => void;
  onAnswer: (text: string) => void;
  onDismiss: () => void;
}) => {
  const { first, keep } = useDraft(draft);
  const [text, setText] = useState(first);
  const typing = useTyping();
  const field = useField();
  const words = sending ? '' : text.trim();
  return (
    <Column alignment="start" spacing={space[3]} modifiers={[frame({ maxWidth: Infinity })]}>
      <Row
        alignment="end"
        spacing={space[2]}
        modifiers={[
          padding({ leading: space[4], trailing: space[1], top: space[1], bottom: space[1] }),
          frame({ minHeight: metrics.field }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          background(theme.fill),
          clipShape('roundedRectangle', radius.field),
        ]}
      >
        <TextInput
          ref={field}
          autoFocus={focus}
          multiline
          testID="ask-input"
          onFocus={() => {
            typing(true);
          }}
          onBlur={() => {
            typing(false);
          }}
          defaultValue={first}
          placeholder={`A note for ${topic}`}
          placeholderTextColor={theme.tertiary}
          cursorColor={theme.text}
          onChangeText={(now) => {
            setText(now);
            keep(now);
          }}
          textStyle={labelOf('body')}
          modifiers={[
            foregroundStyle(theme.text),
            padding({ top: space[2], bottom: space[2] }),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        />
        <Icon
          name="arrow.up.circle.fill"
          size={metrics.symbol.send}
          color={words ? theme.text : theme.tertiary}
          onPress={
            words
              ? () => {
                  onNote(words);
                }
              : undefined
          }
          modifiers={[
            frame({ width: metrics.bar.button, height: metrics.bar.button }),
            accessibilityLabel(`Send a note to ${topic}`),
          ]}
        />
      </Row>
      <Row alignment="center" spacing={space[2]} modifiers={[frame({ maxWidth: Infinity })]}>
        <Pill
          label="Answer with this"
          icon="checkmark"
          onPress={
            words
              ? () => {
                  onAnswer(words);
                }
              : undefined
          }
          small
        />
        <Spacer flexible />
        <Text
          variant="detail"
          tone={sending ? 'tertiary' : 'secondary'}
          onPress={sending ? undefined : onDismiss}
          modifiers={[padding({ top: space[2], bottom: space[2], leading: space[2] })]}
        >
          {NOT_NEEDED}
        </Text>
      </Row>
    </Column>
  );
};

// Says the field is being typed in, and stops saying so when it goes: a note or an answer takes
// the field away with the keyboard still up, and iOS never tells a field that's gone it lost focus,
// so the page would keep its foot hidden for typing.
const useTyping = () => {
  const typing = useContext(Typing);
  const on = useRef(false);
  useEffect(
    () => () => {
      if (on.current) {
        typing(false);
      }
    },
    [],
  );
  return (now: boolean) => {
    on.current = now;
    typing(now);
  };
};

// An answer that couldn't reach every place, and the way to finish it.
export const Unreached = ({ missed, onAgain }: { missed: number; onAgain: () => void }) => (
  <Row alignment="center" spacing={space[2]} modifiers={[frame({ maxWidth: Infinity })]}>
    <Failure text={unreached(missed)} />
    <Text
      variant="caption"
      weight="medium"
      tone="accent"
      onPress={onAgain}
      modifiers={[padding({ top: space[2], bottom: space[2] })]}
    >
      Send again
    </Text>
  </Row>
);
