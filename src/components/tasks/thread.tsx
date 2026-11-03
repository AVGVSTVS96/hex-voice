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
import { useContext, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

import { Header } from '@/components/tasks/bar';
import { Mark } from '@/components/tasks/mark';
import { Typing } from '@/components/tasks/pages';
import { Faded, Pill, SectionHead, ios } from '@/components/tasks/parts';
import { OpenIn } from '@/components/tasks/places';
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
  onWrite,
}: {
  thread: TaskRow;
  chat: Chat;
  onOpen: () => void;
  onWrite: () => void;
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
      {chat.sends ? (
        <Row
          alignment="center"
          spacing={0}
          onPress={onWrite}
          testID="thread-write"
          modifiers={[
            padding({ leading: 18, trailing: 6 }),
            frame({ height: 44 }),
            frame({ maxWidth: Infinity }),
            background(theme.surface),
            clipShape('capsule'),
            contentShape(shapes.capsule()),
            padding({ leading: 16, trailing: 16, top: 8 }),
            ...(ios ? [accessibilityLabel(`Message ${thread.place}`)] : []),
          ]}
        >
          <Text textStyle={{ fontSize: 16 }} modifiers={[foregroundStyle(theme.tertiary)]}>
            {`Message ${thread.place || thread.name}`}
          </Text>
          <Spacer flexible />
        </Row>
      ) : null}
    </Column>
  );
}

// Its current step shows only while its session is in a turn: a thread can stay at work between
// them, waiting on work it handed off, with nothing running to show or stop. `beside` its topic's
// page, that page carries the heading, Talk it through and the way out to its app, so this one is
// only the conversation and its composer.
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
      {beside ? null : (
        <Header
          title={title}
          subtitle={`${place} · ${running ? `working for ${taskTime(thread)}` : STATE_WORDS[thread.state === 'working' ? 'idle' : thread.state]}`}
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
        />
      ) : beside ? null : (
        <Row
          alignment="center"
          spacing={10}
          modifiers={[
            padding({ leading: 16, trailing: 16, top: 8, bottom: Math.max(14, foot) }),
            frame({ maxWidth: Infinity }),
          ]}
        >
          <Pill label="Talk it through" icon="waveform" prominent onPress={onTalk} />
          <OpenIn task={thread} threads={[thread]} onOpen={onOpen} />
        </Row>
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
}: {
  title: string;
  working: boolean;
  focus: boolean;
  foot: number;
  onSend: (text: string) => void;
  onStop: () => void;
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
    </Row>
  );
}
