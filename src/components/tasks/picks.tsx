import { Column, Icon, Row, ScrollView } from '@expo/ui';
import {
  accessibilityAddTraits,
  accessibilityElement,
  accessibilityLabel,
  animation,
  background,
  clipShape,
  contentShape,
  fixedSize,
  frame,
  padding,
  scrollClipDisabled,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Markdown } from '@/components/markdown';
import { Header, PageBar, useChrome } from '@/components/tasks/bar';
import { Links, Shots } from '@/components/tasks/ask-card';
import { Faded, questions } from '@/components/tasks/parts';
import { Foot } from '@/components/tasks/thread';
import { useWords } from '@/hooks/use-asks';
import { PICK } from '@/live/asks';
import type { Ask, AskId, AskOption } from '@/live/asks';
import { clock } from '@/live/tasks';
import { motion } from '@/motion';
import { theme } from '@/theme';
import { Text } from '@/ui/text';
import { metrics, radius, space } from '@/ui/tokens';
import type { Tone } from '@/ui/tokens';

export interface Picked {
  ask: Ask;
  option: AskOption;
}

// What you've chosen on hex's picks before taking them: another answer than hex's, or `later` to
// leave the question in Needs you. Held by Tasks, so the list and a question's page share it.
type Choice = AskOption | 'later';

export const usePickChoices = () => {
  const [choices, setChoices] = useState<Record<AskId, Choice>>({});

  return {
    choiceOf: ({ ask, option }: Picked): Choice => choices[ask.id] ?? option,
    choose: (id: AskId, choice: Choice) => {
      setChoices((was) => ({ ...was, [id]: choice }));
    },
    clear: () => {
      setChoices({});
    },
  };
};

export type PickChoices = ReturnType<typeof usePickChoices>;

const LATER = 'Decide later';

const wraps = [
  fixedSize({ horizontal: false, vertical: true }),
  frame({ maxWidth: Infinity, alignment: 'leading' }),
];

// Every question hex has an answer for, each a card that opens its own page to read and change,
// and one button that sends the answers on them all.
export const PicksPage = ({
  picks,
  choices,
  open,
  foot,
  onOpen,
  onTake,
}: {
  picks: Picked[];
  choices: PickChoices;
  // The question open beside the list, on the Duo held wide.
  open: AskId | null;
  foot: number;
  onOpen: (id: AskId) => void;
  onTake: (taken: Picked[]) => void;
}) => {
  const taken = picks.flatMap((picked) => {
    const choice = choices.choiceOf(picked);

    return choice === 'later' ? [] : [{ ask: picked.ask, option: choice }];
  });

  const later = picks.length - taken.length;

  return (
    <Page>
      <Header
        title="hex’s picks"
        subtitle={
          later ? `${questions(picks.length)} · ${later} for later` : questions(picks.length)
        }
      />
      <Faded>
        <ScrollView
          showsIndicators={false}
          modifiers={[
            scrollClipDisabled(),
            frame({ maxWidth: metrics.readable, maxHeight: Infinity, alignment: 'top' }),
          ]}
        >
          <Column
            alignment="start"
            spacing={space[2]}
            modifiers={[padding({ leading: space[3], trailing: space[3], bottom: space[6] })]}
          >
            {picks.length ? (
              picks.map((picked) => (
                <PickRow
                  key={picked.ask.id}
                  ask={picked.ask}
                  choice={choices.choiceOf(picked)}
                  open={picked.ask.id === open}
                  onPress={() => {
                    onOpen(picked.ask.id);
                  }}
                />
              ))
            ) : (
              <Text
                tone="secondary"
                modifiers={[padding({ top: metrics.emptyTop }), frame({ maxWidth: Infinity })]}
              >
                Nothing left to take
              </Text>
            )}
          </Column>
        </ScrollView>
      </Faded>
      <Foot foot={foot}>
        <Row
          alignment="center"
          spacing={0}
          onPress={
            taken.length
              ? () => {
                  onTake(taken);
                }
              : undefined
          }
          testID="picks-take"
          modifiers={[
            frame({ height: metrics.pill.height }),
            frame({ maxWidth: metrics.readable }),
            background(taken.length ? theme.prominent : theme.fill),
            clipShape('capsule'),
            contentShape(shapes.capsule()),
            animation(motion.list, taken.length),
            accessibilityLabel(`Answer ${questions(taken.length)}`),
            accessibilityAddTraits(['isButton']),
          ]}
        >
          <Text variant="headline" tone={taken.length ? 'onProminent' : 'tertiary'}>
            {`Answer ${questions(taken.length)}`}
          </Text>
        </Row>
      </Foot>
    </Page>
  );
};

// A question as a card that says it opens: where it's from, the question whole, and the answer it
// gets, hex's with its sparkle, yours plain, or left for later.
const PickRow = ({
  ask,
  choice,
  open,
  onPress,
}: {
  ask: Ask;
  choice: Choice;
  open: boolean;
  onPress: () => void;
}) => {
  const answer = choice === 'later' ? LATER : choice.label;

  return (
    <Column
      alignment="start"
      spacing={space[2]}
      onPress={onPress}
      testID="pick-row"
      modifiers={[
        padding({ leading: space[4], trailing: space[4], top: space[3], bottom: space[4] }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        background(open ? theme.fill : theme.card),
        clipShape('roundedRectangle', radius.group),
        contentShape(shapes.rectangle()),
        accessibilityElement('combine'),
        accessibilityLabel(`${ask.topic}. ${ask.question}. ${answer}. Opens it`),
        accessibilityAddTraits(open ? ['isButton', 'isSelected'] : ['isButton']),
      ]}
    >
      <Row alignment="center" spacing={space[2]} modifiers={[frame({ maxWidth: Infinity })]}>
        <Text
          variant="caption"
          tone="secondary"
          numberOfLines={1}
          modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
        >
          {ask.tag === undefined || ask.tag === '' ? ask.topic : `${ask.topic} · ${ask.tag}`}
        </Text>
        <Icon name="chevron.right" size={metrics.symbol.small} color={theme.secondary} />
      </Row>
      <Text variant="headline" paragraph modifiers={wraps}>
        {ask.question}
      </Text>
      <AnswerTag choice={choice} />
    </Column>
  );
};

interface TagLook {
  pick: boolean;
  icon: SFSymbol;
  ink: Tone;
  text: string;
}

const tagLook = (choice: Choice): TagLook => {
  if (choice === 'later') {
    return { pick: false, icon: 'clock', ink: 'tertiary', text: LATER };
  }

  if (choice.pick === true) {
    return { pick: true, icon: 'sparkle', ink: 'accent', text: `${choice.label} · ${PICK}` };
  }

  return { pick: false, icon: 'checkmark', ink: 'text', text: choice.label };
};

const AnswerTag = ({ choice }: { choice: Choice }) => {
  const { pick, icon, ink, text } = tagLook(choice);
  const later = choice === 'later';

  return (
    <Row
      alignment="center"
      spacing={space[2]}
      modifiers={[
        padding({ leading: space[3], trailing: space[3], top: space[1], bottom: space[1] }),
        frame({ minHeight: metrics.pill.small }),
        background(pick ? theme.accentMuted : theme.fill),
        clipShape('capsule'),
      ]}
    >
      <Icon name={icon} size={metrics.symbol.small} color={theme[ink]} />
      <Text
        variant="detail"
        weight="medium"
        tone={later ? 'secondary' : 'text'}
        paragraph
        modifiers={[fixedSize({ horizontal: false, vertical: true })]}
      >
        {text}
      </Text>
    </Row>
  );
};

// One question in full, read top to bottom: the question, why hex picks its answer, every answer
// with what it does and gives up, then what it's about and the thread's own words. Choosing an
// answer here sets the one "Answer" sends; nothing is sent from this page.
export const PickPage = ({ picked, choices }: { picked?: Picked; choices: PickChoices }) => {
  const { back } = useChrome();

  if (!picked) {
    return (
      <Page>
        <Header title="hex’s picks" subtitle=" " />
        <Text tone="secondary" modifiers={[padding({ top: metrics.emptyTop })]}>
          This question is answered
        </Text>
      </Page>
    );
  }

  const { ask } = picked;
  const choice = choices.choiceOf(picked);
  const hexs = ask.options.find((option) => option.pick === true);
  const door = ask.places.find((place) => (place.link ?? '') !== '');

  const links = [
    ...(door?.link === undefined ? [] : [{ label: `Open ${door.place}`, url: door.link }]),
    ...(ask.links ?? []),
  ];

  return (
    <Page>
      <PageBar title={ask.topic} subtitle={clock(new Date(ask.at))} back={back} />
      <Faded>
        <ScrollView
          showsIndicators={false}
          modifiers={[
            scrollClipDisabled(),
            frame({ maxWidth: metrics.readable, maxHeight: Infinity, alignment: 'top' }),
          ]}
        >
          <Column
            alignment="start"
            spacing={0}
            modifiers={[padding({ leading: space[3], trailing: space[3], bottom: space[10] })]}
          >
            <Column
              alignment="start"
              spacing={space[3]}
              modifiers={[padding({ leading: space[2], trailing: space[2], top: space[2] })]}
            >
              <Text variant="title" paragraph modifiers={wraps}>
                {ask.question}
              </Text>
            </Column>
            {ask.why !== undefined && ask.why !== '' && hexs ? (
              <Column
                alignment="start"
                spacing={space[2]}
                modifiers={[
                  padding({ all: space[4] }),
                  frame({ maxWidth: Infinity, alignment: 'leading' }),
                  background(theme.accentMuted),
                  clipShape('roundedRectangle', radius.group),
                  padding({ top: space[5] }),
                ]}
              >
                <Row alignment="center" spacing={space[2]}>
                  <Icon name="sparkle" size={metrics.symbol.small} color={theme.accent} />
                  <Text variant="detail" weight="medium" tone="accent">
                    {`Why hex picks ${hexs.label}`}
                  </Text>
                </Row>
                <Text variant="body" paragraph modifiers={wraps}>
                  {ask.why}
                </Text>
              </Column>
            ) : null}
            <Column
              alignment="start"
              spacing={space[2]}
              modifiers={[frame({ maxWidth: Infinity })]}
            >
              <Heading title="Your answer" detail="Sent when you tap Answer on hex’s picks" />
              <Shots ask={ask} />
              {ask.options.map((option) => (
                <OptionCard
                  key={option.label}
                  title={option.label}
                  detail={option.detail}
                  pick={option.pick}
                  chosen={choice !== 'later' && choice.label === option.label}
                  onPress={() => {
                    choices.choose(ask.id, option);
                  }}
                />
              ))}
              <OptionCard
                title={LATER}
                detail="Stays in Needs you, unanswered."
                chosen={choice === 'later'}
                onPress={() => {
                  choices.choose(ask.id, 'later');
                }}
              />
            </Column>
            {ask.context ? (
              <Column
                alignment="start"
                spacing={space[2]}
                modifiers={[frame({ maxWidth: Infinity })]}
              >
                <Heading title="What it’s about" />
                <Text
                  variant="body"
                  paragraph
                  modifiers={[
                    ...wraps,
                    padding({ all: space[4] }),
                    background(theme.card),
                    clipShape('roundedRectangle', radius.group),
                  ]}
                >
                  {ask.context}
                </Text>
              </Column>
            ) : null}
            <Thread id={ask.id} links={links} />
          </Column>
        </ScrollView>
      </Faded>
    </Page>
  );
};

const Page = ({ children }: { children: ReactNode }) => (
  <Column
    alignment="center"
    spacing={0}
    modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
  >
    {children}
  </Column>
);

const Heading = ({ title, detail }: { title: string; detail?: string }) => (
  <Column
    alignment="start"
    spacing={0}
    modifiers={[padding({ leading: space[2], top: space[6], bottom: space[1] })]}
  >
    <Text variant="headline">{title}</Text>
    {detail === undefined || detail === '' ? null : (
      <Text variant="caption" tone="secondary" paragraph modifiers={wraps}>
        {detail}
      </Text>
    )}
  </Column>
);

// An answer as a choice you can see is one: a circle that fills when it's yours, its words, what it
// does and gives up, and hex's sparkle on its own pick.
const OptionCard = ({
  title,
  detail,
  pick = false,
  chosen,
  onPress,
}: {
  title: string;
  detail?: string;
  pick?: boolean;
  chosen: boolean;
  onPress: () => void;
}) => (
  <Row
    alignment="start"
    spacing={space[3]}
    onPress={onPress}
    testID="pick-option"
    modifiers={[
      padding({ leading: space[4], trailing: space[4], top: space[3], bottom: space[3] }),
      frame({ maxWidth: Infinity, alignment: 'leading' }),
      background(chosen ? theme.fill : theme.card),
      clipShape('roundedRectangle', radius.option),
      contentShape(shapes.rectangle()),
      animation(motion.list, chosen),
      accessibilityElement('combine'),
      accessibilityLabel([title, pick ? PICK : '', detail ?? ''].filter(Boolean).join('. ')),
      accessibilityAddTraits(chosen ? ['isButton', 'isSelected'] : ['isButton']),
    ]}
  >
    <Icon
      name={chosen ? 'checkmark.circle.fill' : 'circle'}
      size={metrics.symbol.row}
      color={chosen ? theme.text : theme.secondary}
    />
    <Column alignment="start" spacing={space[1]} modifiers={[frame({ maxWidth: Infinity })]}>
      <Text variant="body" weight="medium" paragraph modifiers={wraps}>
        {title}
      </Text>
      {detail === undefined || detail === '' ? null : (
        <Text variant="detail" tone="secondary" paragraph modifiers={wraps}>
          {detail}
        </Text>
      )}
      {pick ? (
        <Row alignment="center" spacing={space[1]}>
          <Icon name="sparkle" size={metrics.symbol.mark} color={theme.accent} />
          <Text variant="caption" tone="accent">
            {PICK}
          </Text>
        </Row>
      ) : null}
    </Column>
  </Row>
);

const saidAt = (at: string | undefined) =>
  at === undefined || at === '' ? '' : ` · ${clock(new Date(at))}`;

// Where it was asked, in the thread's own words, all of them, and the way into the thread.
const Thread = ({ id, links }: { id: AskId; links: { label: string; url: string }[] }) => {
  const words = useWords(id);

  if (!words && !links.length) {
    return null;
  }

  return (
    <Column alignment="start" spacing={space[2]} modifiers={[frame({ maxWidth: Infinity })]}>
      <Heading
        title="From the thread"
        detail={words ? `${words.place}${saidAt(words.at)}` : undefined}
      />
      {words ? (
        <Markdown
          variant="detail"
          tone="secondary"
          modifiers={[
            padding({ all: space[4] }),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
            background(theme.card),
            clipShape('roundedRectangle', radius.group),
          ]}
        >
          {words.text}
        </Markdown>
      ) : null}
      {links.length ? (
        <Column alignment="start" spacing={0} modifiers={[padding({ leading: space[2] })]}>
          <Links links={links} />
        </Column>
      ) : null}
    </Column>
  );
};
