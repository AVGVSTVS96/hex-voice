import { Column, RNHostView, Row, ScrollView, Spacer, Text } from '@expo/ui';
import { Button as NativeButton } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  background,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  contentShape,
  controlSize,
  foregroundStyle,
  frame,
  labelStyle,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Glyph } from '@/components/agent-line';
import { STATE_WORDS, type TaskAgent, type TaskState } from '@/live/tasks';
import { theme } from '@/theme';

export const ios = process.env.EXPO_OS === 'ios';
export const INSET = 22;
const HEADER = 44;

export function Header({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack?: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={12}
      style={{ height: HEADER }}
      modifiers={[padding({ top: 14, leading: 16, trailing: 16 }), frame({ maxWidth: Infinity })]}
    >
      {onBack ? (
        <NativeButton
          label="Back"
          systemImage="chevron.left"
          onPress={onBack}
          testID="task-back"
          modifiers={[
            labelStyle('iconOnly'),
            buttonStyle('glass'),
            buttonBorderShape('circle'),
            controlSize('large'),
          ]}
        />
      ) : (
        <Spacer style={{ width: HEADER }} />
      )}
      <Spacer flexible />
      <Column alignment="center" spacing={1}>
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 17, fontWeight: '600' }}
          modifiers={[foregroundStyle(theme.text)]}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          textStyle={{ fontSize: 13 }}
          modifiers={[foregroundStyle(theme.secondary)]}
        >
          {subtitle}
        </Text>
      </Column>
      <Spacer flexible />
      <Spacer style={{ width: HEADER }} />
    </Row>
  );
}

export function Scroll({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      showsIndicators={false}
      modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' })]}
    >
      <Column alignment="start" spacing={0} modifiers={[padding({ bottom: 40 })]}>
        {children}
      </Column>
    </ScrollView>
  );
}

export function GroupHead({ title, count }: { title: string; count: number }) {
  return (
    <Row
      alignment="center"
      spacing={0}
      modifiers={[
        padding({ leading: INSET, trailing: INSET, top: 16, bottom: 4 }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Text
        textStyle={{ fontSize: 13, fontWeight: '600' }}
        modifiers={[foregroundStyle(theme.secondary)]}
      >
        {title}
      </Text>
      <Spacer flexible />
      <Text textStyle={{ fontSize: 13 }} modifiers={[foregroundStyle(theme.tertiary)]}>
        {String(count)}
      </Text>
    </Row>
  );
}

export function Mark({ state, quiet = false }: { state: TaskState | 'paused'; quiet?: boolean }) {
  return (
    <RNHostView matchContents>
      <View>
        <Glyph state={state === 'working' ? 'running' : state} quiet={quiet} />
      </View>
    </RNHostView>
  );
}

// A row: its mark, a name and where it lives, when, then one line in its own words: the newest
// step while it works, what it's waiting on when it needs you, its last status once it's settled.
export function Line({
  state,
  title,
  where,
  time,
  text,
  sub = false,
  onPress,
}: {
  state: TaskState;
  title: string;
  where?: string;
  time?: string;
  text: string;
  sub?: boolean;
  onPress: () => void;
}) {
  const live = state === 'working' || state === 'needs';
  return (
    <Row
      alignment="start"
      spacing={12}
      onPress={onPress}
      modifiers={[
        padding({ leading: sub ? INSET + 32 : INSET, trailing: INSET, top: 10, bottom: 10 }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
        contentShape(shapes.rectangle()),
        ...(ios
          ? [
              accessibilityLabel(
                `${title}${where ? `, ${where}` : ''}, ${STATE_WORDS[state]}${text ? `: ${text}` : ''}`,
              ),
            ]
          : []),
      ]}
    >
      <Mark state={state} />
      <Column
        alignment="start"
        spacing={2}
        modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
      >
        <Row alignment="center" spacing={6} modifiers={[frame({ maxWidth: Infinity })]}>
          <Text
            numberOfLines={1}
            textStyle={{ fontSize: 16, fontWeight: sub ? '400' : '500' }}
            modifiers={[foregroundStyle(theme.text)]}
          >
            {title}
          </Text>
          {where ? (
            <Text
              numberOfLines={1}
              textStyle={{ fontSize: 14 }}
              modifiers={[foregroundStyle(theme.secondary)]}
            >
              {where}
            </Text>
          ) : null}
          <Spacer flexible />
          {time ? (
            <Text textStyle={{ fontSize: 13 }} modifiers={[foregroundStyle(theme.tertiary)]}>
              {time}
            </Text>
          ) : null}
        </Row>
        {text ? (
          <Text
            numberOfLines={2}
            textStyle={{
              fontSize: 15,
              lineHeight: 17,
              fontWeight: state === 'working' && !sub ? '500' : '400',
            }}
            modifiers={[
              foregroundStyle(
                state === 'failed' ? theme.danger : live ? theme.text : theme.secondary,
              ),
            ]}
          >
            {text}
          </Text>
        ) : null}
      </Column>
    </Row>
  );
}

export function AgentRow({ agent, onPress }: { agent: TaskAgent; onPress: () => void }) {
  return (
    <Line sub state={agent.state} title={agent.label} text={agent.line ?? ''} onPress={onPress} />
  );
}

export function Inset({ children }: { children: ReactNode }) {
  return (
    <Column
      alignment="start"
      spacing={0}
      modifiers={[
        padding({ leading: INSET, trailing: INSET }),
        frame({ maxWidth: Infinity, alignment: 'leading' }),
      ]}
    >
      {children}
    </Column>
  );
}

export function Pill({
  label,
  prominent = false,
  onPress,
}: {
  label: string;
  prominent?: boolean;
  onPress: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={0}
      onPress={onPress}
      modifiers={[
        frame({ height: 52 }),
        frame({ maxWidth: Infinity }),
        background(prominent ? theme.prominent : theme.surface),
        clipShape('capsule'),
        contentShape(shapes.capsule()),
        ...(ios ? [accessibilityLabel(label)] : []),
      ]}
    >
      <Spacer flexible />
      <Text
        textStyle={{ fontSize: 17, fontWeight: prominent ? '600' : '500' }}
        modifiers={[foregroundStyle(prominent ? theme.onProminent : theme.text)]}
      >
        {label}
      </Text>
      <Spacer flexible />
    </Row>
  );
}
