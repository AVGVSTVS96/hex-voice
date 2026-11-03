import { Column, Icon, Row, Spacer, Text, TextInput, type TextInputRef } from '@expo/ui';
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
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard } from 'react-native';

import { Header, PageBar, Talk } from '@/components/tasks/bar';
import { Mark } from '@/components/tasks/mark';
import { Typing } from '@/components/tasks/pages';
import { Faded, SectionHead, ios } from '@/components/tasks/parts';
import { Said, SaidLine, Sent } from '@/components/tasks/said';
import { TraceLine } from '@/components/tasks/trace';
import type { Sending } from '@/live/chat';
import { PLACES, placeOf } from '@/live/inbox';
import { STATE_WORDS, taskTime, type Chat, type Task, type TaskRow } from '@/live/tasks';
import { theme } from '@/theme';

const FIELD = 50;

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
          ...(ios ? [accessibilityLabel(`${thread.place}. Opens its messages`)] : []),
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
}: {
  thread: TaskRow | Task;
  beside?: boolean;
  chat: Chat | undefined;
  pending: Sending[];
  focus: boolean;
  foot?: number;
  onOpen: (thread: TaskRow) => void;
  onSteps: () => void;
  onSend: (text: string) => void;
  onRetry: (sent: Sending) => void;
  onStop: () => void;
  onTalk: () => void;
}) {
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
            thread.link && chat?.sends
              ? { place: placeOf(thread.app), onPress: () => onOpen(thread) }
              : undefined
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
            spacing={18}
            modifiers={[
              padding({ top: 20, bottom: 20 }),
              contentShape(shapes.rectangle()),
              onTapGesture(Keyboard.dismiss),
            ]}
          >
            {first > 0 ? (
              <Text
                textStyle={{ fontSize: 13 }}
                modifiers={[foregroundStyle(theme.tertiary), frame({ maxWidth: Infinity })]}
              >
                {`Earlier messages are in ${place}`}
              </Text>
            ) : null}
            {chat && !turns.length && !pending.length ? (
              <Text
                textStyle={{ fontSize: 15 }}
                modifiers={[
                  foregroundStyle(theme.tertiary),
                  padding({ top: 40 }),
                  frame({ maxWidth: Infinity }),
                ]}
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
            <Text
              textStyle={{ fontSize: 15, fontWeight: '600' }}
              modifiers={[foregroundStyle(theme.accent)]}
            >
              Steps
            </Text>
          }
          onPress={onSteps}
          label={`Working: ${doing ?? ''}. Shows its steps`}
        />
      ) : null}
      {chat?.sends ? (
        <Composer
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
  title,
  working,
  focus,
  foot,
  onSend,
  onStop,
  onTalk,
}: {
  title: string;
  working: boolean;
  focus: boolean;
  foot: number;
  onSend: (text: string) => void;
  onStop: () => void;
  onTalk: () => void;
}) {
  const input = useRef<TextInputRef>(null);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const typingHere = useContext(Typing);
  useEffect(() => {
    if (!focus) return;
    const wait = setTimeout(() => input.current?.focus(), 350);
    return () => clearTimeout(wait);
  }, [focus]);
  const words = text.trim();
  const stops = working && !text;
  const lit = stops || !!words;
  const send = () => {
    if (stops) return onStop();
    if (!words) return;
    onSend(words);
    setText('');
    input.current?.clear();
  };
  return (
    <Row
      alignment="end"
      spacing={8}
      modifiers={[
        padding({ leading: 16, trailing: 16, top: 8, bottom: typing ? 8 : Math.max(14, foot) }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Row
        alignment="center"
        spacing={0}
        modifiers={[
          padding({ leading: 18, trailing: 18, top: 14, bottom: 14 }),
          frame({ minHeight: FIELD }),
          frame({ maxWidth: Infinity }),
          background(theme.surface),
          clipShape('roundedRectangle', FIELD / 2),
        ]}
      >
        <TextInput
          ref={input}
          multiline
          placeholder={`Message ${title}`}
          placeholderTextColor={theme.tertiary}
          cursorColor={theme.accent}
          onChangeText={setText}
          onFocus={() => {
            setTyping(true);
            typingHere(true);
          }}
          onBlur={() => {
            setTyping(false);
            typingHere(false);
          }}
          textStyle={{ fontSize: 17 }}
          testID="thread-input"
          modifiers={[
            foregroundStyle(theme.text),
            frame({ maxWidth: Infinity, alignment: 'leading' }),
          ]}
        />
      </Row>
      <Row
        alignment="center"
        spacing={0}
        onPress={send}
        testID="thread-send"
        modifiers={[
          frame({ width: FIELD, height: FIELD }),
          background(lit ? theme.prominent : theme.surface),
          clipShape('circle'),
          contentShape(shapes.circle()),
          ...(ios ? [accessibilityLabel(stops ? 'Stop' : 'Send')] : []),
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
      spacing={8}
      modifiers={[
        padding({ leading: 16, trailing: 16, top: 8, bottom: Math.max(14, foot) }),
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
        padding({ leading: 18, trailing: 18 }),
        frame({ height: FIELD }),
        frame({ maxWidth: Infinity }),
        background(theme.surface),
        clipShape('roundedRectangle', FIELD / 2),
        contentShape(shapes.rectangle()),
        ...(ios ? [accessibilityLabel(`Message ${title}`)] : []),
      ]}
    >
      <Text textStyle={{ fontSize: 17 }} modifiers={[foregroundStyle(theme.tertiary)]}>
        {`Message ${title}`}
      </Text>
      <Spacer flexible />
    </Row>
  );
}
