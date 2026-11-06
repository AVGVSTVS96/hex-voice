import { Column, Icon, RNHostView, Row, Spacer, TextInput, type TextInputRef } from '@expo/ui';
import { ScrollView } from '@expo/ui/swift-ui';
import {
  accessibilityIdentifier,
  accessibilityLabel,
  background,
  clipShape,
  contentShape,
  defaultScrollAnchor,
  foregroundStyle,
  frame,
  onTapGesture,
  padding,
  scrollClipDisabled,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useContext, useEffect, useState, type ReactNode, type RefObject } from 'react';

import { AddMedia } from '@/components/media/add-media';
import { Waiting } from '@/components/media/waiting';
import { Header, PageBar, Talk } from '@/components/tasks/bar';
import { useDraft } from '@/hooks/use-draft';
import { Mark } from '@/components/tasks/mark';
import { Typing, useField } from '@/components/tasks/pages';
import { Failure, Faded, SectionHead } from '@/components/tasks/parts';
import { Said, SaidLine, Sent } from '@/components/tasks/said';
import { TraceLine } from '@/components/tasks/trace';
import type { Sending } from '@/live/chat';
import { MOST, type Picked } from '@/live/media';
import { PLACES, placeOf } from '@/live/inbox';
import { STATE_WORDS, taskTime, type Chat, type Task, type TaskRow } from '@/live/tasks';
import { radius, theme } from '@/theme';
import { Text } from '@/ui/text';
import { labelOf, metrics, space } from '@/ui/tokens';

export function Messages({
  thread,
  chat,
  onOpen,
}: {
  thread: TaskRow;
  chat: Chat;
  onOpen: () => void;
}) {
  const last = chat.turns.slice(-2);
  return (
    <Column alignment="start" spacing={0}>
      <Column
        alignment="start"
        spacing={0}
        onPress={onOpen}
        modifiers={[
          frame({ maxWidth: Infinity, alignment: 'leading' }),
          contentShape(shapes.rectangle()),
          accessibilityLabel(`${thread.place}. Opens its messages`),
        ]}
      >
        <SectionHead
          title={thread.place === thread.name ? 'Messages' : `Messages · ${thread.place}`}
          count={chat.total || undefined}
          opens
        />
        {last.map((turn, i) => (
          <SaidLine
            key={i}
            turn={turn}
            named={turn.from !== last[i - 1]?.from}
            lines={i === last.length - 1 ? 3 : 2}
          />
        ))}
      </Column>
    </Column>
  );
}

// Its current step shows only while its session is in a turn: a thread can stay at work between
// them, waiting on work it handed off, with nothing running to show or stop. `beside` its topic's
// page, that page carries the topic's name and the way out to its app, so this one is headed only
// "Messages" and holds the conversation and its composer.
export function ThreadPage({
  thread,
  beside = false,
  chat,
  pending,
  focus,
  foot = 0,
  onOpen,
  onSteps,
  onSend,
  onRetry,
  onStop,
  onTalk,
  failed,
}: {
  thread: TaskRow | Task;
  beside?: boolean;
  chat: Chat | undefined;
  pending: Sending[];
  focus: boolean;
  foot?: number;
  onOpen: (thread: TaskRow) => void;
  onSteps: () => void;
  onSend: (text: string, media: Picked[]) => void;
  onRetry: (sent: Sending) => void;
  onStop: () => void;
  onTalk: () => void;
  // Why the last Stop didn't go through.
  failed?: string;
}) {
  const field = useField();
  const place = PLACES[placeOf(thread.app)];
  const running = thread.running;
  const title = thread.place || thread.name;
  // Its back names the topic, so the topic's own thread is headed for what it holds.
  const heading = !thread.place || thread.place === thread.name ? 'Messages' : thread.place;
  const turns = chat?.turns ?? [];
  const first = (chat?.total ?? 0) - turns.length;
  // What it's doing now, past what it said: that's in the conversation already.
  const doing =
    'steps' in thread ? thread.steps.find((step) => step.kind !== 'say')?.text : undefined;
  return (
    <Column
      alignment="center"
      spacing={0}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
    >
      {beside ? (
        <PageBar title="Messages" subtitle={chat?.total ? String(chat.total) : undefined} />
      ) : (
        <Header
          title={heading}
          subtitle={
            running
              ? `working for ${taskTime(thread)}`
              : `${STATE_WORDS[thread.state === 'working' ? 'idle' : thread.state]} · ${taskTime(thread)}`
          }
          door={
            thread.link ? { place: placeOf(thread.app), onPress: () => onOpen(thread) } : undefined
          }
        />
      )}
      <Faded>
        <ScrollView
          showsIndicators={false}
          modifiers={[
            scrollClipDisabled(),
            defaultScrollAnchor('bottom'),
            accessibilityIdentifier('thread-messages'),
            frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
          ]}
        >
          <Column
            alignment="start"
            spacing={space[4.5]}
            modifiers={[
              padding({ top: space[5], bottom: space[5] }),
              contentShape(shapes.rectangle()),
              onTapGesture(() => field.current?.blur()),
            ]}
          >
            {first > 0 ? (
              <Text variant="footnote" tone="tertiary" modifiers={[frame({ maxWidth: Infinity })]}>
                {`Earlier messages are in ${place}`}
              </Text>
            ) : null}
            {chat && !turns.length && !pending.length ? (
              <Text
                variant="subheadline"
                tone="tertiary"
                modifiers={[padding({ top: space[10] }), frame({ maxWidth: Infinity })]}
              >
                Nothing said here yet
              </Text>
            ) : null}
            {turns.map((turn, i) => (
              <Said key={first + i} turn={turn} />
            ))}
            {pending.map((sent) => (
              <Sent key={sent.key} sent={sent} onRetry={() => onRetry(sent)} />
            ))}
          </Column>
        </ScrollView>
      </Faded>
      {running ? (
        <TraceLine
          lead={<Mark state="working" />}
          text={doing ?? 'Working'}
          time={taskTime(thread)}
          chevron="chevron.right"
          after={
            <Text variant="subheadline" weight="semibold" tone="accent">
              Steps
            </Text>
          }
          onPress={onSteps}
          label={`Working: ${doing ?? ''}. Shows its steps`}
        />
      ) : null}
      {failed ? (
        <Failure
          text={failed}
          modifiers={[
            padding({ leading: metrics.list.inset, trailing: metrics.list.inset, top: space[2] }),
          ]}
        />
      ) : null}
      {chat?.sends ? (
        <Composer
          key={thread.id}
          field={field}
          draft={`thread:${thread.id}`}
          title={title}
          working={running && !pending.some((sent) => !sent.failed)}
          focus={focus}
          foot={foot}
          onSend={onSend}
          onStop={onStop}
          onTalk={onTalk}
        />
      ) : (
        <Foot foot={foot}>
          <Talk about={title} alone onPress={onTalk} />
        </Foot>
      )}
    </Column>
  );
}

// Send turns into Stop while the thread works and you've nothing typed, though not before what you
// just sent reaches it, so a second tap on Send can't stop the turn you steered.
function Composer({
  field: input,
  draft,
  title,
  working,
  focus,
  foot,
  onSend,
  onStop,
  onTalk,
}: {
  field: RefObject<TextInputRef | null>;
  draft: string;
  title: string;
  working: boolean;
  focus: boolean;
  foot: number;
  onSend: (text: string, media: Picked[]) => void;
  onStop: () => void;
  onTalk: () => void;
}) {
  const { first, keep } = useDraft(draft);
  const [text, setText] = useState(first);
  const [media, setMedia] = useState<Picked[]>([]);
  const [typing, setTyping] = useState(false);
  const typingHere = useContext(Typing);
  useEffect(() => {
    if (!focus) return;
    const wait = setTimeout(() => input.current?.focus(), 350);
    return () => clearTimeout(wait);
  }, [focus]);
  const words = text.trim();
  const stops = working && !text && !media.length;
  const lit = stops || !!words || !!media.length;
  const send = () => {
    if (stops) return onStop();
    if (!words && !media.length) return;
    onSend(words, media);
    setMedia([]);
    setText('');
    keep('');
    input.current?.clear();
  };
  return (
    <Row
      alignment="end"
      spacing={space[2]}
      modifiers={[
        padding({
          leading: space[4],
          trailing: space[4],
          top: space[2],
          bottom: typing ? space[2] : Math.max(space[3.5], foot),
        }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <AddMedia
        testID="thread-add"
        most={MOST - media.length}
        sends={false}
        onAdd={(more) => setMedia((now) => [...now, ...more].slice(0, MOST))}
        label={
          <Row
            alignment="center"
            spacing={0}
            modifiers={[
              frame({ width: metrics.field, height: metrics.field }),
              background(theme.surface),
              clipShape('circle'),
              contentShape(shapes.circle()),
              accessibilityLabel('Add a photo or video'),
            ]}
          >
            <Icon name="plus" size={20} color={theme.text} />
          </Row>
        }
      />
      <Column
        alignment="start"
        spacing={space[2.5]}
        modifiers={[
          padding({
            leading: media.length ? space[2] : space[4.5],
            trailing: space[4.5],
            top: media.length ? space[2] : space[3.5],
            bottom: space[3.5],
          }),
          frame({ minHeight: metrics.field }),
          frame({ maxWidth: Infinity }),
          background(theme.surface),
          clipShape('roundedRectangle', radius.field),
        ]}
      >
        {media.length ? (
          <RNHostView matchContents={{ vertical: true }}>
            <Waiting
              media={media}
              onRemove={(at) => setMedia((now) => now.filter((_, i) => i !== at))}
            />
          </RNHostView>
        ) : null}
        <TextInput
          ref={input}
          multiline
          defaultValue={first}
          placeholder={`Message ${title}`}
          placeholderTextColor={theme.tertiary}
          cursorColor={theme.accent}
          onChangeText={(now) => {
            setText(now);
            keep(now);
          }}
          onFocus={() => {
            setTyping(true);
            typingHere(true);
          }}
          onBlur={() => {
            setTyping(false);
            typingHere(false);
          }}
          textStyle={labelOf('body')}
          testID="thread-input"
          modifiers={[
            foregroundStyle(theme.text),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
            ...(media.length ? [padding({ leading: space[2.5] })] : []),
          ]}
        />
      </Column>
      <Row
        alignment="center"
        spacing={0}
        onPress={send}
        testID="thread-send"
        modifiers={[
          frame({ width: metrics.field, height: metrics.field }),
          background(lit ? theme.prominent : theme.surface),
          clipShape('circle'),
          contentShape(shapes.circle()),
          accessibilityLabel(stops ? 'Stop' : 'Send'),
        ]}
      >
        <Icon
          name={stops ? 'stop.fill' : 'arrow.up'}
          size={stops ? 14 : 18}
          color={lit ? theme.onProminent : theme.tertiary}
        />
      </Row>
      {typing ? null : <Talk about={title} alone={false} onPress={onTalk} />}
    </Row>
  );
}

// A page's foot: its composer, or the field that opens one, and Talk it through.
export function Foot({ foot, children }: { foot: number; children: ReactNode }) {
  return (
    <Row
      alignment="center"
      spacing={space[2]}
      modifiers={[
        padding({
          leading: space[4],
          trailing: space[4],
          top: space[2],
          bottom: Math.max(space[3.5], foot),
        }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      {children}
    </Row>
  );
}

// The composer's field as a way into the conversation, where its messages aren't on screen.
export function WriteField({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Row
      alignment="center"
      spacing={0}
      onPress={onPress}
      testID="thread-write"
      modifiers={[
        padding({ leading: space[4.5], trailing: space[4.5] }),
        frame({ height: metrics.field }),
        frame({ maxWidth: Infinity }),
        background(theme.surface),
        clipShape('roundedRectangle', radius.field),
        contentShape(shapes.rectangle()),
        accessibilityLabel(`Message ${title}`),
      ]}
    >
      <Text tone="tertiary">{`Message ${title}`}</Text>
      <Spacer flexible />
    </Row>
  );
}
