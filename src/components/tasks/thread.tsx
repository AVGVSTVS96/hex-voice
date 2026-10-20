import { Column, Icon, Row, Spacer, Text, TextInput, type TextInputRef } from '@expo/ui';
import { ScrollView } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  clipShape,
  clipped,
  contentShape,
  defaultScrollAnchor,
  foregroundStyle,
  frame,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { useEffect, useRef, useState } from 'react';

import { Hairline, Header, INSET, Mark, Pill, SectionHead, ios } from '@/components/tasks/parts';
import { OpenIn, PlaceTile } from '@/components/tasks/places';
import { Said, SaidLine, Sent } from '@/components/tasks/said';
import { TraceLine } from '@/components/tasks/trace';
import type { Sending } from '@/live/chat';
import { PLACES, placeOf } from '@/live/inbox';
import { STATE_WORDS, taskTime, type Chat, type Task, type TaskRow } from '@/live/tasks';
import { theme } from '@/theme';

const FIELD = 50;

// A thread's last words on its topic's page: who said what last, under a head that opens the
// thread and names it where the topic has others. Where the thread takes messages from here, a
// field under them opens it ready to write.
export function Messages({
  thread,
  chat,
  onOpen,
  onWrite,
}: {
  thread: TaskRow;
  chat: Chat | undefined;
  onOpen: () => void;
  onWrite: () => void;
}) {
  if (!chat || (!chat.total && !chat.sends)) return null;
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

// A thread a level down from its topic: everything said there, newest at the foot, and what it's
// doing now, opening into its steps. What it waits on you for stays on the topic's page behind it.
// Where it takes messages from here you write at the foot; anywhere else the foot talks it through
// or opens it in its app, as its topic's does. Its app's mark at the top opens it there too. Its
// current step shows only while its session is in a turn: a thread can stay at work between them,
// waiting on work it handed off, with nothing running to show or stop.
export function ThreadPage({
  thread,
  chat,
  pending,
  focus,
  foot = 0,
  onBack,
  onOpen,
  onSteps,
  onSend,
  onRetry,
  onStop,
  onTalk,
}: {
  thread: TaskRow | Task;
  chat: Chat | undefined;
  pending: Sending[];
  focus: number;
  foot?: number;
  onBack: () => void;
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
      <Header
        title={title}
        subtitle={`${place} · ${running ? `working for ${taskTime(thread)}` : STATE_WORDS[thread.state === 'working' ? 'idle' : thread.state]}`}
        onBack={onBack}
        trailing={
          thread.link ? (
            <Row
              alignment="center"
              spacing={0}
              onPress={() => onOpen(thread)}
              modifiers={[
                frame({ width: 36, height: 36 }),
                contentShape(shapes.rectangle()),
                ...(ios ? [accessibilityLabel(`Open in ${place}`)] : []),
              ]}
            >
              <PlaceTile place={placeOf(thread.app)} size={30} />
            </Row>
          ) : undefined
        }
      />
      <Spacer modifiers={[frame({ height: 8 })]} />
      <Hairline />
      <ScrollView
        showsIndicators={false}
        modifiers={[
          defaultScrollAnchor('bottom'),
          frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
          clipped(),
        ]}
      >
        <Column alignment="start" spacing={18} modifiers={[padding({ top: 12, bottom: 20 })]}>
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
          {running ? (
            <TraceLine
              lead={<Mark state="working" />}
              text={doing ?? 'Working'}
              time={taskTime(thread)}
              chevron="chevron.right"
              onPress={onSteps}
              label={`Working: ${doing ?? ''}. Shows its steps`}
              after={
                chat?.sends ? (
                  <Text
                    onPress={onStop}
                    textStyle={{ fontSize: 15, fontWeight: '500' }}
                    modifiers={[foregroundStyle(theme.accent)]}
                  >
                    Stop
                  </Text>
                ) : undefined
              }
            />
          ) : null}
        </Column>
      </ScrollView>
      {chat?.sends ? (
        <Composer title={title} focus={focus} foot={foot} onSend={onSend} />
      ) : (
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

// Where you write to the thread, as tall as the pills it takes the place of. `focus` counts the
// times you asked to write, so each one brings the keyboard up.
function Composer({
  title,
  focus,
  foot,
  onSend,
}: {
  title: string;
  focus: number;
  foot: number;
  onSend: (text: string) => void;
}) {
  const input = useRef<TextInputRef>(null);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (!focus) return;
    const wait = setTimeout(() => input.current?.focus(), 350);
    return () => clearTimeout(wait);
  }, [focus]);
  const words = text.trim();
  const send = () => {
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
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
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
        modifiers={[
          frame({ width: FIELD, height: FIELD }),
          background(words ? theme.prominent : theme.surface),
          clipShape('circle'),
          contentShape(shapes.circle()),
          ...(ios ? [accessibilityLabel('Send')] : []),
        ]}
      >
        <Icon name="arrow.up" size={18} color={words ? theme.onProminent : theme.tertiary} />
      </Row>
    </Row>
  );
}
