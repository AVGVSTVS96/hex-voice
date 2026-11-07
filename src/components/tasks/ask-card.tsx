import { Column, Icon, Row, Spacer, TextInput } from '@expo/ui';
import { Capsule, HStack, Rectangle, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityElement,
  accessibilityIdentifier,
  accessibilityLabel,
  animation,
  background,
  clipShape,
  contentShape,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  onTapGesture,
  padding,
  shapes,
  strokeBorder,
  type ModifierConfig,
} from '@expo/ui/swift-ui/modifiers';
import { useContext, useState } from 'react';

import { Markdown } from '@/components/markdown';
import { TakePicks } from '@/components/tasks/inbox';
import { Mark } from '@/components/tasks/mark';
import { Typing, useField } from '@/components/tasks/pages';
import { noteAsk, useWords } from '@/hooks/use-asks';
import { useDraft } from '@/hooks/use-draft';
import { openURL, useFailures } from '@/hooks/use-failures';
import { Failure, Hairline, SectionHead } from '@/components/tasks/parts';
import {
  NOT_NEEDED,
  unreached,
  type Ask,
  type AskLink,
  type AskOption,
  type Words,
} from '@/live/asks';
import { fitsOneLine, picksOf, type HexPick } from '@/live/inbox';
import { clock } from '@/live/tasks';
import { motion, rowsKey } from '@/motion';
import { theme } from '@/theme';
import { Text } from '@/ui/text';
import { labelOf, metrics, radius, space, type } from '@/ui/tokens';

// Compact, so a page of many asks scans: folded, a question on one line; open, its choices on one
// line where they fit.
const ROW = 40;
// How much of the thread's own words show before a tap shows them all.
const SAID = 6;
// The pencil takes taps across 44 points but only the question's first line of height.
const PENCIL = metrics.bar.button;
const LINE = type.headline.lineHeight;

type Answer = (ask: Ask, option: AskOption) => void;

export function YourCall({
  asks,
  answered,
  width,
  onAnswer,
  onTakePicks,
  onUndo,
  onAgain,
  onDismiss,
}: {
  asks: Ask[];
  answered: Record<string, string | null>;
  width: number;
  onAnswer: Answer;
  onTakePicks: (picks: HexPick[]) => void;
  onUndo: (ask: Ask) => void;
  onAgain: (ask: Ask) => void;
  onDismiss: (ask: Ask) => void;
}) {
  const open = asks.filter((ask) => !answered[ask.id]).length;
  const picks = picksOf(asks, answered);
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[
        animation(motion.list, rowsKey(asks.map((ask) => `${ask.id}=${answered[ask.id] ?? ''}`))),
      ]}
    >
      {picks.length > 1 ? (
        <TakePicks picks={picks} onTake={() => onTakePicks(picks)}>
          {(confirm) => (
            <SectionHead
              title={`Your call · ${open}`}
              kind="needs"
              action={{ label: `Take hex’s ${picks.length}`, onPress: confirm }}
            />
          )}
        </TakePicks>
      ) : (
        <SectionHead title="Your call" kind="needs" count={open} />
      )}
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
                  top: space[3],
                  bottom: space[4],
                }),
                frame({ maxWidth: Infinity, alignment: 'leading' }),
              ]}
            >
              <Mark state="done" />
              <Column
                alignment="start"
                spacing={space[0.5]}
                modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
              >
                <Text variant="detail" tone="secondary">
                  {ask.question}
                </Text>
                <Text variant="detail">{said}</Text>
                {ask.missed ? <Unreached missed={ask.missed} onAgain={() => onAgain(ask)} /> : null}
                {ask.failed ? <Failure text={ask.failed} /> : null}
              </Column>
              <Text
                variant="detail"
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
          <Column
            key={ask.id}
            alignment="start"
            spacing={0}
            modifiers={[frame({ maxWidth: Infinity })]}
          >
            {i ? <Hairline /> : null}
            <AskCard
              ask={ask}
              first={i === 0}
              width={width}
              onAnswer={onAnswer}
              onDismiss={onDismiss}
            />
          </Column>
        );
      })}
    </Column>
  );
}

// Folded, the question on one line and when it was asked; a tap opens the question whole, its
// background, the thread's own words, and the answers. Writing on it keeps it open.
function AskCard({
  ask,
  first,
  width,
  onAnswer,
  onDismiss,
}: {
  ask: Ask;
  first: boolean;
  width: number;
  onAnswer: Answer;
  onDismiss: (ask: Ask) => void;
}) {
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
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
            bottom: open ? space[2] : space[3],
          }),
          frame({ maxWidth: Infinity }),
        ]}
      >
        <VStack
          alignment="leading"
          spacing={space[2]}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: 'leading' }),
            contentShape(shapes.rectangle()),
            onTapGesture(() => setOpen(!open)),
            accessibilityIdentifier('ask-card'),
            accessibilityLabel(`${ask.question}. ${open ? 'Folds it' : 'Opens it'}`),
          ]}
        >
          <Text
            variant="headline"
            weight={open ? undefined : 'regular'}
            paragraph
            modifiers={[
              open ? lineLimit() : lineLimit(1),
              frame({ maxWidth: Infinity, alignment: 'leading' }),
            ]}
          >
            {ask.question}
          </Text>
          {open && ask.context ? (
            <Text
              variant="detail"
              paragraph
              modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
            >
              {ask.context}
            </Text>
          ) : null}
        </VStack>
        {open ? (
          <Row
            alignment="center"
            spacing={0}
            onPress={() => setWriting(!writing)}
            modifiers={[
              frame({ width: PENCIL, height: PENCIL }),
              contentShape(shapes.rectangle()),
              padding({
                leading: space[1],
                // Its symbol, centered in its square, ends at the list's inset, as the date does.
                top: (LINE - PENCIL) / 2,
                bottom: (LINE - PENCIL) / 2,
              }),
              accessibilityLabel(writing ? 'Close your answer' : 'Write your own'),
            ]}
          >
            <Icon
              name="square.and.pencil"
              size={metrics.symbol.small}
              color={writing ? theme.accent : theme.secondary}
            />
          </Row>
        ) : (
          <Text
            variant="caption"
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
          spacing={space[1]}
          modifiers={[
            padding({
              leading: metrics.list.inset,
              trailing: metrics.list.inset,
              bottom: space[2],
            }),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        >
          {words ? <Said words={words} /> : null}
          {ask.links?.length ? <Links links={ask.links} /> : null}
          {notes.failed.note ? (
            <Failure text={notes.failed.note} modifiers={[padding({ top: space[1] })]} />
          ) : noted ? (
            <Text
              variant="caption"
              tone="secondary"
              paragraph
              modifiers={[padding({ top: space[1] })]}
            >
              {`Note sent to ${ask.topic}`}
            </Text>
          ) : null}
        </Column>
      ) : null}
      {ask.failed ? (
        <Failure
          text={ask.failed}
          modifiers={[
            padding({
              leading: metrics.list.inset,
              trailing: metrics.list.inset,
              bottom: open ? space[2] : space[3],
            }),
          ]}
        />
      ) : null}
      {!open ? null : writing ? (
        <Composer
          draft={`ask:${ask.id}`}
          topic={ask.topic}
          sending={noting}
          onNote={note}
          onAnswer={(label) => onAnswer(ask, { label })}
          onDismiss={() => onDismiss(ask)}
        />
      ) : (
        <Answers ask={ask} width={width} onAnswer={onAnswer} />
      )}
    </Column>
  );
}

// The thread's own words, quoted under hex's summary with a rule beside them, so the two never read
// as one: where and when they were said, a few lines, all of them on a tap.
function Said({ words }: { words: Words }) {
  const [whole, setWhole] = useState(false);
  const when = words.at ? ` · ${clock(new Date(words.at))}` : '';
  return (
    <HStack
      alignment="top"
      spacing={space[3]}
      modifiers={[
        padding({ top: space[4], bottom: space[0.5] }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
      ]}
    >
      <Capsule modifiers={[frame({ width: 2 }), foregroundStyle(theme.fillStrong)]} />
      <Column
        alignment="start"
        spacing={space[1]}
        onPress={() => setWhole(!whole)}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          contentShape(shapes.rectangle()),
          animation(motion.list, whole),
          accessibilityElement('combine'),
        ]}
      >
        <Text variant="caption" weight="semibold" tone="secondary">
          {`From ${words.place}${when}`}
        </Text>
        <Markdown
          inline={!whole}
          lines={whole ? undefined : SAID}
          variant="caption"
          tone="secondary"
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          {words.text}
        </Markdown>
      </Column>
    </HStack>
  );
}

function Links({ links }: { links: AskLink[] }) {
  const tries = useFailures();
  const failed = links.map((link) => tries.failed[link.url]).find(Boolean);
  return (
    <Column alignment="start" spacing={space[1]} modifiers={[padding({ top: space[1] })]}>
      <Row alignment="center" spacing={space[2]}>
        {links.map((link, i) => (
          <Row key={link.url} alignment="center" spacing={space[2]}>
            {i ? (
              <Text variant="detail" tone="tertiary">
                ·
              </Text>
            ) : null}
            <Row
              alignment="center"
              spacing={space[1]}
              onPress={() => void tries.attempt(link.url, 'Not opened', () => openURL(link.url))}
              modifiers={[accessibilityLabel(`Open ${link.label}`)]}
            >
              <Text numberOfLines={1} variant="detail" tone="secondary">
                {link.label}
              </Text>
              <Icon name="arrow.up.right" size={metrics.symbol.small} color={theme.secondary} />
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
    <Row alignment="center" spacing={space[4]} modifiers={modifiers}>
      {ask.options.map((option, i) => (
        <Row key={option.label} alignment="center" spacing={space[4]}>
          {i ? (
            <Rectangle
              modifiers={[frame({ width: 1, height: space[4] }), foregroundStyle(theme.edge)]}
            />
          ) : null}
          <Row
            alignment="center"
            spacing={space[1]}
            onPress={() => onAnswer(ask, option)}
            modifiers={[
              padding({ top: space[2], bottom: space[1] }),
              accessibilityLabel(option.pick ? `${option.label}, hex’s pick` : option.label),
            ]}
          >
            {option.pick ? (
              <Icon name="checkmark" size={metrics.symbol.small} color={theme.accent} />
            ) : null}
            <Text
              numberOfLines={1}
              variant="detail"
              weight={option.pick ? 'semibold' : 'semibold'}
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
  if (fitsOneLine(ask.options, width - 2 * metrics.list.inset, type.detail.fontSize))
    return (
      <InlineAnswers
        ask={ask}
        onAnswer={onAnswer}
        modifiers={[
          padding({
            leading: metrics.list.inset,
            trailing: metrics.list.inset,
            top: 0,
            bottom: space[3],
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
          top: space[2],
          bottom: space[2],
        }),
        frame({ minHeight: ROW }),
        frame({ maxWidth: Infinity }),
        contentShape(shapes.rectangle()),
        accessibilityLabel(option.pick ? `${option.label}, hex’s pick` : option.label),
      ]}
    >
      {option.pick ? (
        <Icon name="checkmark" size={metrics.symbol.small} color={theme.accent} />
      ) : (
        <Spacer style={{ width: 14 }} />
      )}
      <Text
        variant="detail"
        weight={option.pick ? 'semibold' : 'regular'}
        tone={option.pick ? 'accent' : 'text'}
        paragraph
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        {option.label}
      </Text>
      {option.pick ? (
        <Text variant="caption" weight="semibold" tone="accent">
          hex’s pick
        </Text>
      ) : null}
    </Row>
  );
}

// What you write goes to the ask's thread as a note and leaves the ask open: ↑ is the one accent
// action. Answering with it instead is the deliberate second step, drawn in text and not accent so
// it never reads as already answered, and Not needed puts the ask away with no answer at all.
// None of them goes while a note is on its way.
function Composer({
  draft,
  topic,
  sending,
  onNote,
  onAnswer,
  onDismiss,
}: {
  draft: string;
  topic: string;
  sending: boolean;
  onNote: (text: string) => void;
  onAnswer: (text: string) => void;
  onDismiss: () => void;
}) {
  const { first, keep } = useDraft(draft);
  const [text, setText] = useState(first);
  const typing = useContext(Typing);
  const field = useField();
  const words = sending ? '' : text.trim();
  return (
    <Column alignment="start" spacing={0} modifiers={[frame({ maxWidth: Infinity })]}>
      <Row
        alignment="end"
        spacing={space[3]}
        modifiers={[
          padding({
            leading: space[4],
            trailing: space[2],
            top: space[2],
            bottom: space[2],
          }),
          frame({ minHeight: ROW - 8 }),
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          background(theme.fill),
          clipShape('roundedRectangle', radius.control),
          strokeBorder({
            content: theme.edge,
            style: { lineWidth: 1 },
            shape: 'roundedRectangle',
            cornerRadius: radius.control,
          }),
          padding({
            leading: metrics.list.inset - space[2],
            trailing: metrics.list.inset - space[2],
            top: space[2],
            bottom: space[2],
          }),
        ]}
      >
        <TextInput
          ref={field}
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
          textStyle={labelOf('body')}
          modifiers={[
            foregroundStyle(theme.text),
            padding({ top: space[2], bottom: space[2] }),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        />
        <Icon
          name="arrow.up.circle.fill"
          size={metrics.symbol.hero}
          color={words ? theme.accent : theme.tertiary}
          onPress={words ? () => onNote(words) : undefined}
          modifiers={[accessibilityLabel(`Send a note to ${topic}`)]}
        />
      </Row>
      <Row
        alignment="center"
        spacing={0}
        modifiers={[
          padding({
            leading: metrics.list.inset,
            trailing: metrics.list.inset,
            top: space[1],
            bottom: space[3],
          }),
          frame({ maxWidth: Infinity }),
        ]}
      >
        <Row
          alignment="center"
          spacing={space[1]}
          onPress={words ? () => onAnswer(words) : undefined}
          modifiers={[accessibilityLabel('Answer with this')]}
        >
          <Icon
            name="checkmark"
            size={metrics.symbol.small}
            color={words ? theme.text : theme.tertiary}
          />
          <Text variant="detail" weight="semibold" tone={words ? 'text' : 'tertiary'}>
            Answer with this
          </Text>
        </Row>
        <Spacer flexible />
        <Text
          variant="detail"
          weight="regular"
          tone={sending ? 'tertiary' : 'secondary'}
          onPress={sending ? undefined : onDismiss}
        >
          {NOT_NEEDED}
        </Text>
      </Row>
    </Column>
  );
}

// An answer that couldn't reach every place, and the way to finish it.
export function Unreached({ missed, onAgain }: { missed: number; onAgain: () => void }) {
  return (
    <Row alignment="center" spacing={space[2]} modifiers={[frame({ maxWidth: Infinity })]}>
      <Failure text={unreached(missed)} />
      <Text
        variant="caption"
        weight="semibold"
        tone="accent"
        onPress={onAgain}
        modifiers={[padding({ top: space[2], bottom: space[2] })]}
      >
        Send again
      </Text>
    </Row>
  );
}
