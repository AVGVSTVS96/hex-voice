import { Icon, RNHostView, Spacer } from '@expo/ui';
import { Circle, Rectangle, ZStack } from '@expo/ui/swift-ui';
import { foregroundStyle, frame, strokeBorder } from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { ColorValue } from 'react-native';

import { Arc } from '@/components/agent-line';
import type { TaskState } from '@/live/tasks';
import { theme } from '@/theme';
import { metrics, radius, space } from '@/ui/tokens';
import type { Tone } from '@/ui/tokens';

// What needs you says what kind it is: a question (`asks`), one hex has a pick for (`pick`), or a
// reply it waits on (`needs`).
export type MarkState = TaskState | 'asks' | 'pick' | 'paused' | 'stopped' | 'read' | 'pending';

// Drawn natively so a long list stays cheap; only the arc moves, so only it animates. What needs
// you is a mint disc, with a question mark for a question and a sparkle for one hex has a pick
// for; what hex has under way is its blue arc. Only what's finished sits in a square, with a tick.
export const Mark = ({ state }: { state: MarkState }) => {
  if (state === 'working') {
    return (
      <RNHostView matchContents>
        <View
          style={{
            width: metrics.list.mark,
            height: metrics.list.mark,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Arc size={metrics.list.arc} />
        </View>
      </RNHostView>
    );
  }
  return (
    <ZStack
      alignment="center"
      modifiers={[frame({ width: metrics.list.mark, height: metrics.list.mark })]}
    >
      <Face state={state} />
    </ZStack>
  );
};

const Face = ({ state }: { state: Exclude<MarkState, 'working'> }) => {
  const square = metrics.list.todo;
  const disc = (color: ColorValue, children: ReactNode) => (
    <>
      <Circle modifiers={[frame({ width: square, height: square }), foregroundStyle(color)]} />
      {children}
    </>
  );
  switch (state) {
    case 'needs': {
      return disc(
        theme.accentMuted,
        <Circle
          modifiers={[
            frame({ width: metrics.badge.dot, height: metrics.badge.dot }),
            foregroundStyle(theme.accent),
          ]}
        />,
      );
    }
    case 'asks': {
      return disc(
        theme.accentMuted,
        <Icon name="questionmark" size={metrics.symbol.mark} color={theme.accent} />,
      );
    }
    case 'pick': {
      return disc(
        theme.accentMuted,
        <Icon name="sparkle" size={metrics.symbol.mark} color={theme.accent} />,
      );
    }
    case 'done': {
      return (
        <>
          <Spacer
            modifiers={[
              frame({ width: square, height: square }),
              strokeBorder({
                content: theme.tertiary,
                style: { lineWidth: metrics.list.stroke },
                shape: 'roundedRectangle',
                cornerRadius: radius.mark,
              }),
            ]}
          />
          <Icon name="checkmark" size={metrics.symbol.mark} color={theme.secondary} />
        </>
      );
    }
    case 'read': {
      return (
        <Circle
          modifiers={[
            frame({ width: metrics.badge.dot, height: metrics.badge.dot }),
            foregroundStyle(theme.tertiary),
          ]}
        />
      );
    }
    case 'failed': {
      return disc(
        theme.dangerMuted,
        <Icon name="exclamationmark" size={metrics.symbol.mark} color={theme.danger} />,
      );
    }
    case 'paused': {
      return disc(
        theme.surfaceSelected,
        <Icon name="pause.fill" size={metrics.symbol.mark} color={theme.secondary} />,
      );
    }
    case 'stopped': {
      return (
        <Rectangle
          modifiers={[
            frame({ width: metrics.badge.dot, height: metrics.badge.dot }),
            foregroundStyle(theme.tertiary),
          ]}
        />
      );
    }
    case 'pending': {
      return (
        <Spacer
          modifiers={[
            frame({ width: square - space[1], height: square - space[1] }),
            strokeBorder({
              content: theme.tertiary,
              style: { lineWidth: metrics.list.stroke, dash: [2, 2] },
              shape: 'circle',
            }),
          ]}
        />
      );
    }
    case 'idle': {
      return (
        <Spacer
          modifiers={[
            frame({ width: metrics.badge.dot, height: metrics.badge.dot }),
            strokeBorder({
              content: theme.tertiary,
              style: { lineWidth: metrics.list.stroke },
              shape: 'circle',
            }),
          ]}
        />
      );
    }
  }
};

// A section's name in its color on a tinted dot, as Muse heads Tracking and Goals: mint for what
// needs you, blue for what hex is doing, red for what went wrong.
export type Tint = 'needs' | 'working' | 'failed';

const TINTS: Record<Tint, { ink: Tone; wash: Tone }> = {
  needs: { ink: 'accent', wash: 'accentMuted' },
  working: { ink: 'progress', wash: 'progressMuted' },
  failed: { ink: 'danger', wash: 'dangerMuted' },
};

export const Badge = ({ tint }: { tint: Tint }) => {
  const { ink, wash } = TINTS[tint];
  return (
    <ZStack
      alignment="center"
      modifiers={[frame({ width: metrics.list.mark, height: metrics.list.mark })]}
    >
      <Circle
        modifiers={[
          frame({ width: metrics.badge.size, height: metrics.badge.size }),
          foregroundStyle(theme[wash]),
        ]}
      />
      <Circle
        modifiers={[
          frame({ width: metrics.badge.dot, height: metrics.badge.dot }),
          foregroundStyle(theme[ink]),
        ]}
      />
    </ZStack>
  );
};

export const inkOf = (tint: Tint) => TINTS[tint].ink;
