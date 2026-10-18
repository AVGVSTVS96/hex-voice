import { Column, Icon, RNHostView, Row, Spacer, Text } from '@expo/ui';
import { Button as NativeButton, Capsule, Circle, Rectangle, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  alignmentGuide,
  background,
  buttonBorderShape,
  buttonStyle,
  clipShape,
  contentShape,
  controlSize,
  foregroundStyle,
  frame,
  labelStyle,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  listRowSeparatorTint,
  offset,
  opacity,
  padding,
  shapes,
  strokeBorder,
  type ModifierConfig,
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { PixelRatio, View, type ColorValue } from 'react-native';

import { Arc } from '@/components/agent-line';
import { LANE_TICKS, laneX, type TaskState, type Turn } from '@/live/tasks';
import { theme } from '@/theme';

export const ios = process.env.EXPO_OS === 'ios';
export const INSET = 20;
// A row's mark sits in a slot this wide, and its words start after it and the gap.
export const MARK = 16;
export const GAP = 10;
const HEADER = 36;
const HAIRLINE = 1 / PixelRatio.get();

// What every row of a list `width` wide wears: no inset of its own, the sheet behind it, and a
// separator that runs edge to edge.
export function listRow(width: number, { top = true, bottom = true } = {}): ModifierConfig[] {
  return [
    listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }),
    listRowBackground(theme.sheet),
    listRowSeparatorTint(theme.edge),
    alignmentGuide('listRowSeparatorLeading', 0),
    alignmentGuide('listRowSeparatorTrailing', width),
    ...(top ? [] : [listRowSeparator('hidden', 'top')]),
    ...(bottom ? [] : [listRowSeparator('hidden', 'bottom')]),
  ];
}

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
      style={{ height: HEADER + 14 }}
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
            controlSize('regular'),
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
        {subtitle ? (
          <Text
            numberOfLines={1}
            textStyle={{ fontSize: 13 }}
            modifiers={[foregroundStyle(theme.secondary)]}
          >
            {subtitle}
          </Text>
        ) : null}
      </Column>
      <Spacer flexible />
      <Spacer style={{ width: HEADER }} />
    </Row>
  );
}

// A section's name over its rows, with how many on the right.
export function SectionHead({ title, count }: { title: string; count?: string | number }) {
  return (
    <Row
      alignment="center"
      spacing={0}
      modifiers={[
        padding({ leading: INSET, trailing: INSET, top: 22, bottom: 6 }),
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
      {count !== undefined ? (
        <Text textStyle={{ fontSize: 13 }} modifiers={[foregroundStyle(theme.tertiary)]}>
          {String(count)}
        </Text>
      ) : null}
    </Row>
  );
}

export function Hairline() {
  return (
    <Rectangle
      modifiers={[
        frame({ height: HAIRLINE }),
        frame({ maxWidth: Infinity }),
        foregroundStyle(theme.edge),
      ]}
    />
  );
}

export type MarkState = TaskState | 'paused' | 'read' | 'pending';

// A row's state, small, drawn natively so a long list stays cheap: a mint dot needs you, the arc
// turns while it works, a check is done (plain once read), ! failed, a ring is idle, a dashed ring
// hasn't started. Only the arc moves, so only it is the animated one.
export function Mark({ state }: { state: MarkState }) {
  if (state === 'working')
    return (
      <RNHostView matchContents>
        <View style={{ width: MARK, height: MARK, alignItems: 'center', justifyContent: 'center' }}>
          <Arc size={13} />
        </View>
      </RNHostView>
    );
  return (
    <ZStack alignment="center" modifiers={[frame({ width: MARK, height: MARK })]}>
      <Face state={state} />
    </ZStack>
  );
}

function Face({ state }: { state: Exclude<MarkState, 'working'> }) {
  const disc = (color: ColorValue, children: ReactNode) => (
    <>
      <Circle modifiers={[frame({ width: 14, height: 14 }), foregroundStyle(color)]} />
      {children}
    </>
  );
  switch (state) {
    case 'needs':
      return <Circle modifiers={[frame({ width: 8, height: 8 }), foregroundStyle(theme.accent)]} />;
    case 'done':
      return disc(theme.accentMuted, <Icon name="checkmark" size={8} color={theme.accent} />);
    case 'read':
      return <Icon name="checkmark" size={10} color={theme.tertiary} />;
    case 'failed':
      return disc(theme.dangerMuted, <Icon name="exclamationmark" size={8} color={theme.danger} />);
    case 'paused':
      return disc(
        theme.surfaceSelected,
        <Icon name="pause.fill" size={7} color={theme.secondary} />,
      );
    case 'pending':
      return (
        <Spacer
          modifiers={[
            frame({ width: 10, height: 10 }),
            strokeBorder({
              content: theme.tertiary,
              style: { lineWidth: 1.5, dash: [2, 2] },
              shape: 'circle',
            }),
          ]}
        />
      );
    case 'idle':
      return (
        <Spacer
          modifiers={[
            frame({ width: 8, height: 8 }),
            strokeBorder({ content: theme.tertiary, style: { lineWidth: 1.5 }, shape: 'circle' }),
          ]}
        />
      );
  }
}

const LANE = 10;

// C's lane: the last week on a log scale (`laneX`), now at the right, with faint ticks an hour and a
// day back. A bar wherever it worked, at least 2pt however short, joined to the next where they
// touch, each step a hair apart only where there's room to see it (the last few minutes); a thin
// line while it waited on you, a ring where it asked; a dot where it finished, red where it failed.
// Every thread of a topic draws on the same lane.
export function Lane({
  tracks,
  width,
  now = Date.now(),
}: {
  tracks: Turn[][];
  width: number;
  now?: number;
}) {
  const x = (at: string) => laneX(Date.parse(at), now, width);
  const marks: ReactNode[] = LANE_TICKS.map((age) => (
    <Rectangle
      key={`tick:${age}`}
      modifiers={[
        frame({ width: 1, height: 5 }),
        foregroundStyle(theme.edge),
        offset({ x: laneX(now - age, now, width) - 0.5 }),
      ]}
    />
  ));
  tracks.forEach((track, t) => {
    let bar: { from: number; to: number } | undefined;
    const flush = (key: string) => {
      if (!bar) return;
      marks.push(
        <Capsule
          key={key}
          modifiers={[
            frame({ width: Math.max(2, bar.to - bar.from), height: 5 }),
            foregroundStyle(theme.accent),
            offset({ x: Math.min(bar.from, width - 2) }),
          ]}
        />,
      );
      bar = undefined;
    };
    track.forEach((turn, i) => {
      const from = x(turn.at);
      const to = i + 1 < track.length ? x(track[i + 1]!.at) : width;
      const key = `${t}:${i}`;
      if (turn.state === 'working') {
        if (bar && from - bar.to < 1.5 && to - from < 3) bar.to = to;
        else {
          flush(`${key}:bar`);
          bar = { from, to: to - from >= 3 ? to - 1 : to };
        }
        return;
      }
      flush(`${key}:bar`);
      const asked = turn.state === 'needs' && track[i - 1]?.state !== 'needs';
      if (turn.state === 'needs' && to - from >= 2)
        marks.push(
          <Capsule
            key={key}
            modifiers={[
              frame({ width: to - from, height: 1.5 }),
              foregroundStyle(theme.accent),
              opacity(0.5),
              offset({ x: from }),
            ]}
          />,
        );
      if (asked || turn.state === 'done' || turn.state === 'failed')
        marks.push(
          asked ? (
            <Spacer
              key={`${key}:at`}
              modifiers={[
                frame({ width: 7, height: 7 }),
                background(theme.sheet),
                clipShape('circle'),
                strokeBorder({ content: theme.accent, style: { lineWidth: 1.6 }, shape: 'circle' }),
                offset({ x: from - 3.5 }),
              ]}
            />
          ) : (
            <Circle
              key={`${key}:at`}
              modifiers={[
                frame({ width: 5, height: 5 }),
                foregroundStyle(turn.state === 'failed' ? theme.danger : theme.secondary),
                offset({ x: from - 2.5 }),
              ]}
            />
          ),
        );
    });
    flush(`${t}:end`);
  });
  return (
    <ZStack alignment="leading" modifiers={[frame({ width, height: LANE })]}>
      <Rectangle modifiers={[frame({ width, height: 1 }), foregroundStyle(theme.edge)]} />
      {marks}
    </ZStack>
  );
}

export function Pill({
  label,
  icon,
  prominent = false,
  onPress,
}: {
  label: string;
  icon?: 'waveform';
  prominent?: boolean;
  onPress: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={8}
      onPress={onPress}
      modifiers={[
        frame({ height: 50 }),
        frame({ maxWidth: Infinity }),
        background(prominent ? theme.prominent : theme.surface),
        clipShape('capsule'),
        contentShape(shapes.capsule()),
        ...(ios ? [accessibilityLabel(label)] : []),
      ]}
    >
      <Spacer flexible />
      {icon ? (
        <Icon name={icon} size={16} color={prominent ? theme.onProminent : theme.text} />
      ) : null}
      <Text
        textStyle={{ fontSize: 16, fontWeight: '600' }}
        modifiers={[foregroundStyle(prominent ? theme.onProminent : theme.text)]}
      >
        {label}
      </Text>
      <Spacer flexible />
    </Row>
  );
}

// A lane takes a quarter of the row it sits in, within reason.
export function laneWidth(width: number) {
  return Math.round(Math.min(240, Math.max(84, width * 0.25)));
}

// A tab with nothing in it says so, quietly.
export function Empty({ text, width }: { text: string; width: number }) {
  return (
    <Text
      textStyle={{ fontSize: 15 }}
      modifiers={[
        foregroundStyle(theme.tertiary),
        padding({ top: 48, bottom: 48 }),
        frame({ maxWidth: Infinity }),
        ...listRow(width, { top: false, bottom: false }),
      ]}
    >
      {text}
    </Text>
  );
}
