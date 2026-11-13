import { Column, Icon, Row, Spacer, TextInput } from "@expo/ui";
import { HStack, RNHostView, SwipeActions, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityElement,
  accessibilityHint,
  accessibilityIdentifier,
  accessibilityLabel,
  animation,
  background,
  clipShape,
  clipped,
  contentShape,
  fixedSize,
  foregroundStyle,
  frame,
  lineLimit,
  monospacedDigit,
  onTapGesture,
  padding,
  shapes,
  strokeBorder,
} from "@expo/ui/swift-ui/modifiers";
import type { ModifierConfig } from "@expo/ui/swift-ui/modifiers";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { SFSymbol } from "sf-symbols-typescript";

import { Markdown } from "@/components/markdown";
import { AddMedia } from "@/components/media/add-media";
import { Pictures } from "@/components/media/pictures";
import type { Picture } from "@/components/media/pictures";
import { Waiting } from "@/components/media/waiting";
import { Mark } from "@/components/tasks/mark";
import { Typing, useField } from "@/components/tasks/pages";
import { Failure, NotNeededButton, Pill, StageHead, listRow } from "@/components/tasks/parts";
import { noteAsk, shotOf, useWords } from "@/hooks/use-asks";
import type { Chosen } from "@/hooks/use-asks";
import { carryDraft, draftOf, useDraft } from "@/hooks/use-draft";
import { openURL, useFailures } from "@/hooks/use-failures";
import { pictureOf } from "@/hooks/use-media";
import { NOT_NEEDED, PICK, unreached } from "@/live/asks";
import type { Ask, AskId, AskLink, AskOption, Words } from "@/live/asks";
import { MOST } from "@/live/media";
import type { Picked } from "@/live/media";
import { clock } from "@/live/tasks";
import { motion } from "@/motion";
import { theme } from "@/theme";
import { Text } from "@/ui/text";
import { labelOf, metrics, radius, space } from "@/ui/tokens";

import { EvenRow, Fits } from "../../../modules/rows";

const PILLS_PER_ROW = 3;

const OWN_WORDS = "Answer in your own words";

const LINES_RESERVED = 3;

const LINES_WHILE_TYPING = 5;

const REPLY_MARK = 3;

const CARD_MARGIN = space[3];
const CARD_PADDING = space[4];

type Answer = (ask: Ask, option: Chosen) => void;

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
  const open = asks.filter((ask) => (answered[ask.id] ?? "") === "").length;

  return (
    <>
      <Column alignment="start" spacing={0} modifiers={listRow()}>
        <StageHead tint="needs" title="Needs you" count={open || undefined} />
      </Column>
      {asks.map((ask) => {
        const said = answered[ask.id] ?? "";

        if (said !== "") {
          return (
            <Card key={ask.id}>
              <HStack alignment="top" spacing={metrics.list.gap}>
                <Mark state="done" />
                <VStack
                  alignment="leading"
                  spacing={space[1]}
                  modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
                >
                  <Text variant="detail" tone="secondary" paragraph>
                    {ask.question}
                  </Text>
                  <Text variant="body" paragraph>
                    {said}
                  </Text>
                  {ask.missed === undefined ? null : (
                    <Unreached
                      missed={ask.missed}
                      onAgain={() => {
                        onAgain(ask);
                      }}
                    />
                  )}
                  <Failure text={ask.failed} />
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

const Card = ({ children }: { children: ReactNode }) => (
  <VStack
    alignment="leading"
    spacing={space[3]}
    modifiers={[
      padding({ all: CARD_PADDING }),
      frame({ maxWidth: Infinity, alignment: "leading" }),
      background(theme.card),
      clipShape("roundedRectangle", radius.group),
      padding({ leading: CARD_MARGIN, trailing: CARD_MARGIN, bottom: space[3] }),
      ...listRow(),
    ]}
  >
    {children}
  </VStack>
);

const AskCard = ({
  ask,
  onAnswer,
  onDismiss,
}: {
  ask: Ask;
  onAnswer: Answer;
  onDismiss: (ask: Ask) => void;
}) => {
  const [held] = useState(
    () => !!carryDraft(`ask:${ask.id}`, ask.was?.map((id) => `ask:${id}`) ?? []).trim(),
  );

  const [open, setOpen] = useState(held);
  const words = useWords(ask.id);
  const reply = useContext(Reply);
  const here = reply?.ask?.id === ask.id;

  const links = ask.links ?? [];

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
          modifiers={[monospacedDigit(), frame({ maxWidth: Infinity, alignment: "leading" })]}
        >
          {clock(new Date(ask.at))}
        </Text>
        <Pill
          label={NOT_NEEDED}
          accessibility={`${NOT_NEEDED}: puts the question away`}
          onPress={() => {
            onDismiss(ask);
          }}
          small
        />
      </HStack>
      <VStack
        alignment="leading"
        spacing={space[2]}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: "leading" }),
          contentShape(shapes.rectangle()),
          onTapGesture(() => {
            setOpen(!open);
          }),
          accessibilityIdentifier("ask-card"),
          accessibilityLabel(`${ask.question}. ${open ? "Folds it" : "Opens it"}`),
        ]}
      >
        <Text
          variant="headline"
          paragraph
          modifiers={[
            fixedSize({ horizontal: false, vertical: true }),
            frame({ maxWidth: Infinity, alignment: "leading" }),
          ]}
        >
          {ask.question}
        </Text>
        {ask.context === undefined || ask.context === "" ? null : (
          <Text
            variant="detail"
            tone="secondary"
            paragraph
            modifiers={[
              fixedSize({ horizontal: false, vertical: true }),
              frame({ maxWidth: Infinity, alignment: "leading" }),
            ]}
          >
            {ask.context}
          </Text>
        )}
      </VStack>
      {words ? (
        <Said
          words={words}
          open={open}
          onToggle={() => {
            setOpen(!open);
          }}
        />
      ) : null}
      {links.length > 0 && (open || !words) ? <Links links={links} /> : null}
      <Failure text={ask.failed} />
      <Shots ask={ask} />
      <Answers ask={ask} onAnswer={onAnswer} />
      {reply ? (
        <OwnWords
          draft={draftOf(`ask:${ask.id}`)}
          here={here}
          onPress={() => {
            reply.open(ask);
          }}
        />
      ) : null}
      {reply?.noted.has(ask.id) === true ? (
        <Text variant="caption" tone="secondary" paragraph>
          {`Sent to ${ask.topic} as a note. The question is still open.`}
        </Text>
      ) : null}
    </Card>
  );
};

export const Shots = ({ ask }: { ask: Ask }) => {
  const shown = ask.options.filter(
    (option): option is AskOption & { shot: number } => option.shot !== undefined,
  );

  const pictures = ask.pictures ?? [];

  const tiles: Picture[] =
    shown.length > 0
      ? shown.map((option) => ({
          ...shotOf(ask, option.shot),
          shape: option.shape ?? 1,
          label: option.label,
        }))
      : pictures.map((picture, i) => ({
          ...pictureOf(picture.id),
          shape: picture.shape ?? 1,
          label: pictures.length === 1 ? ask.question : `${ask.question} ${i + 1}`,
        }));

  return <Pictures pictures={tiles} height={metrics.picture.card} />;
};

export const Said = ({
  words,
  open,
  onToggle,
}: {
  words: Words;
  open: boolean;
  onToggle: () => void;
}) => {
  const when = words.at === undefined || words.at === "" ? "" : ` · ${clock(new Date(words.at))}`;

  return (
    <Column
      alignment="start"
      spacing={space[2]}
      modifiers={[
        padding({ all: space[3] }),
        frame({ maxWidth: Infinity, alignment: "leading" }),
        background(theme.fill),
        clipShape("roundedRectangle", radius.inner),
        animation(motion.list, open),
      ]}
    >
      <Row
        alignment="center"
        spacing={space[2]}
        onPress={onToggle}
        modifiers={[
          frame({ maxWidth: Infinity }),
          contentShape(shapes.rectangle()),
          accessibilityElement("combine"),
          accessibilityLabel(`From ${words.place}${when}. ${open ? "Hides" : "Shows"} the message`),
          accessibilityAddTraits(["isButton"]),
        ]}
      >
        <Text variant="caption" tone="secondary">
          {`From ${words.place}${when}`}
        </Text>
        <Spacer flexible />
        <Icon
          name={open ? "chevron.up" : "chevron.down"}
          size={metrics.symbol.small}
          color={theme.tertiary}
        />
      </Row>
      {open ? (
        <Markdown
          variant="detail"
          modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
        >
          {words.text}
        </Markdown>
      ) : null}
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
              void tries.attempt(link.url, "Not opened", async () => {
                await openURL(link.url);
              });
            }}
            small
          />
        ))}
      </Row>
      <Failure text={failed} />
    </Column>
  );
};

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
            frame({ maxWidth: Infinity, alignment: "leading" }),
            background(option.pick === true ? theme.accentMuted : theme.fill),
            clipShape("roundedRectangle", radius.option),
            contentShape(shapes.rectangle()),
            accessibilityElement("combine"),
            accessibilityLabel(option.pick === true ? `${option.label}, ${PICK}` : option.label),
            accessibilityAddTraits(["isButton"]),
          ]}
        >
          <Text
            variant="body"
            weight={option.pick === true ? "medium" : "regular"}
            paragraph
            modifiers={[fixedSize({ horizontal: false, vertical: true })]}
          >
            {option.label}
          </Text>
          {option.pick === true ? (
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

  if (n > PILLS_PER_ROW) {
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

interface Typed {
  topic: string;
  words: boolean;
  sending: boolean;
  send: (as: "note" | "answer") => void;
}

export interface Replying {
  ask: Ask | null;
  noted: ReadonlySet<AskId>;
  open: (ask: Ask) => void;
  close: () => void;
  note: (id: AskId) => void;
}

export const Reply = createContext<Replying | undefined>(undefined);

export const useReplying = (): Replying => {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [noted, setNoted] = useState<ReadonlySet<AskId>>(new Set());

  return {
    ask,
    noted,
    open: setAsk,
    close: () => {
      setAsk(null);
    },
    note: (id) => {
      setNoted((was) => new Set([...was, id]));
    },
  };
};

const OwnWords = ({
  draft,
  here,
  onPress,
}: {
  draft: string;
  here: boolean;
  onPress: () => void;
}) => (
  <Row
    alignment="center"
    spacing={space[3]}
    onPress={onPress}
    testID="ask-own"
    modifiers={[
      padding({ leading: space[4], trailing: space[4], top: space[3], bottom: space[3] }),
      frame({ minHeight: metrics.pill.regular }),
      frame({ maxWidth: Infinity, alignment: "leading" }),
      background(theme.fill),
      ...(here
        ? [
            strokeBorder({
              content: theme.secondary,
              shape: "roundedRectangle",
              cornerRadius: radius.option,
            }),
          ]
        : []),
      clipShape("roundedRectangle", radius.option),
      contentShape(shapes.rectangle()),
      accessibilityElement("combine"),
      accessibilityLabel(draft.trim() ? `${OWN_WORDS}: ${draft}` : OWN_WORDS),
      accessibilityAddTraits(["isButton"]),
    ]}
  >
    <Icon name="square.and.pencil" size={metrics.symbol.small} color={theme.secondary} />
    <Text
      variant="body"
      tone={draft.trim() ? "text" : "secondary"}
      numberOfLines={2}
      modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
    >
      {draft.trim() || OWN_WORDS}
    </Text>
  </Row>
);

const inkOf = (live: boolean, lit: boolean) => {
  if (lit) {
    return "onProminent";
  }

  return live ? "text" : "tertiary";
};

const SendButton = ({
  label,
  icon,
  about,
  live,
  prominent = false,
  onPress,
}: {
  label: string;
  icon: SFSymbol;
  about: string;
  live: boolean;
  prominent?: boolean;
  onPress: () => void;
}) => {
  const lit = live && prominent;
  const ink = inkOf(live, lit);

  return (
    <Row
      alignment="center"
      spacing={space[2]}
      {...(live && { onPress })}
      testID={`ask-${label}`}
      modifiers={[
        padding({ leading: space[4], trailing: space[4] }),
        frame({ minHeight: metrics.pill.regular }),
        frame({ maxWidth: Infinity }),
        background(lit ? theme.prominent : theme.fill),
        clipShape("capsule"),
        contentShape(shapes.capsule()),
        accessibilityElement("combine"),
        accessibilityLabel(label),
        accessibilityHint(about),
        accessibilityAddTraits(["isButton"]),
      ]}
    >
      <Icon name={icon} size={metrics.symbol.small} color={theme[ink]} />
      <Text variant="body" weight={prominent ? "medium" : "regular"} tone={ink}>
        {label}
      </Text>
    </Row>
  );
};

const Sends = ({ typed }: { typed: Typed }) => {
  const live = typed.words && !typed.sending;

  return (
    <Row alignment="center" spacing={space[2]} modifiers={[frame({ maxWidth: Infinity })]}>
      <SendButton
        label="Send as note"
        icon="text.bubble"
        about={`Send as a note to ${typed.topic}; the question stays open`}
        live={live}
        onPress={() => {
          typed.send("note");
        }}
      />
      <SendButton
        label="Answer"
        icon="checkmark"
        about="Answer the question with your words"
        live={live}
        prominent
        onPress={() => {
          typed.send("answer");
        }}
      />
    </Row>
  );
};

export const ReplyComposer = ({
  ask,
  onAnswer,
  onClose,
  onNoted,
}: {
  ask: Ask;
  onAnswer: Answer;
  onClose: () => void;
  onNoted: (id: AskId) => void;
}) => {
  const { first, keep } = useDraft(`ask:${ask.id}`);
  const [text, setText] = useState(first);
  const now = useRef(first);
  const typing = useTyping();
  const field = useField();
  const notes = useFailures();
  const [sending, setSending] = useState(false);
  const [media, setMedia] = useState<Picked[]>([]);
  const picking = useRef(false);
  const opened = useRef(false);

  const send = async (as: "note" | "answer") => {
    const said = now.current.trim();

    if (said === "" && media.length === 0) {
      return;
    }

    if (as === "answer") {
      onAnswer(ask, { label: said === "" ? shown(media) : said, media });
      onClose();

      return;
    }

    setSending(true);

    const sent = await notes.attempt("note", "Note not sent", async () => {
      await noteAsk(ask, said, media);
    });

    setSending(false);

    if (sent) {
      onNoted(ask.id);
      onClose();
    }
  };

  const typed: Typed = {
    topic: ask.topic,
    words: text.trim() !== "" || media.length > 0,
    sending,
    send: (as) => {
      void send(as);
    },
  };

  return (
    <Column
      alignment="start"
      spacing={space[2]}
      modifiers={[
        padding({ leading: CARD_MARGIN, trailing: CARD_MARGIN }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Row alignment="center" spacing={space[2]} modifiers={[frame({ maxWidth: Infinity })]}>
        <Column
          alignment="start"
          spacing={0}
          modifiers={[
            frame({ width: REPLY_MARK, height: metrics.symbol.send }),
            background(theme.accent),
            clipShape("capsule"),
          ]}
        />
        <Text variant="detail" tone="accent">
          Replying to
        </Text>
        <Text
          variant="detail"
          numberOfLines={1}
          modifiers={[frame({ maxWidth: Infinity, alignment: "leading" })]}
        >
          {ask.question}
        </Text>
        <Icon
          name="xmark"
          size={metrics.symbol.small}
          color={theme.secondary}
          onPress={onClose}
          modifiers={[
            frame({ width: metrics.bar.button, height: metrics.symbol.send }),
            contentShape(shapes.rectangle()),
            accessibilityLabel("Close, keeping your words"),
          ]}
        />
      </Row>
      <Row alignment="end" spacing={space[2]} modifiers={[frame({ maxWidth: Infinity })]}>
        <AddMedia
          testID="ask-add"
          label="Add a photo or video"
          most={MOST - media.length}
          sends={false}
          onChoose={() => {
            picking.current = true;
          }}
          onAdd={(more) => {
            picking.current = false;
            setMedia((was) => [...was, ...more].slice(0, MOST));
          }}
        >
          <Row
            alignment="center"
            spacing={0}
            modifiers={[
              frame({ width: metrics.field, height: metrics.field }),
              background(theme.surface),
              clipShape("circle"),
              contentShape(shapes.circle()),
            ]}
          >
            <Icon name="plus" size={metrics.symbol.row} color={theme.text} />
          </Row>
        </AddMedia>
        <Column
          alignment="start"
          spacing={space[3]}
          modifiers={[
            padding({
              leading: media.length ? space[2] : space[4],
              trailing: space[4],
              top: media.length ? space[2] : space[3],
              bottom: space[3],
            }),
            frame({ minHeight: metrics.field }),
            frame({ maxWidth: Infinity, alignment: "leading" }),
            background(theme.surface),
            clipShape("roundedRectangle", radius.option),
          ]}
        >
          {media.length ? (
            <RNHostView matchContents={{ vertical: true }}>
              <Waiting
                media={media}
                onRemove={(at) => {
                  setMedia((was) => was.filter((_, i) => i !== at));
                }}
              />
            </RNHostView>
          ) : null}
          <TextInput
            ref={field}
            autoFocus
            multiline
            testID="ask-input"
            onFocus={() => {
              picking.current = false;
              typing(true);

              if (!opened.current) {
                opened.current = true;
                void field.current?.setSelection(now.current.length, now.current.length);
              }
            }}
            onBlur={() => {
              typing(false);

              if (now.current.trim() === "" && media.length === 0 && !picking.current) {
                onClose();
              }
            }}
            defaultValue={first}
            placeholder={OWN_WORDS}
            placeholderTextColor={theme.secondary}
            cursorColor={theme.text}
            onChangeText={(next) => {
              now.current = next;
              setText(next);
              keep(next);
            }}
            textStyle={labelOf("body")}
            modifiers={[
              foregroundStyle(theme.text),
              lineLimit({ min: LINES_RESERVED, max: LINES_WHILE_TYPING }),
              clipped(),
              frame({ maxWidth: Infinity, alignment: "leading" }),
              accessibilityLabel(`${OWN_WORDS}, or a note for ${ask.topic}`),
              ...(media.length ? [padding({ leading: space[2] })] : []),
            ]}
          />
        </Column>
      </Row>
      <Failure text={notes.failed.note} />
      <Sends typed={typed} />
    </Column>
  );
};

const shown = (media: Picked[]) => {
  const kinds = new Set(media.map((one) => one.kind));
  const kind = kinds.size === 1 ? [...kinds][0] : "photo or video";

  return media.length === 1 ? `a ${kind}` : `${media.length} ${kind}s`;
};

const useTyping = () => {
  const typing = useContext(Typing);
  const on = useRef(false);

  const stopOnRemovalSinceIOSSendsNoBlur = () => () => {
    if (on.current) {
      typing?.(false);
    }
  };

  useEffect(stopOnRemovalSinceIOSSendsNoBlur, []);

  return (now: boolean) => {
    on.current = now;
    typing?.(now);
  };
};

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
