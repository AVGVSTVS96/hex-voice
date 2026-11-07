import { RNHostView, Icon, Spacer } from '@expo/ui';
import { Circle, Rectangle, ZStack } from '@expo/ui/swift-ui';
import { clipShape, foregroundStyle, frame, strokeBorder } from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { View, type ColorValue } from 'react-native';

import { Arc } from '@/components/agent-line';
import type { TaskState } from '@/live/tasks';
import { theme } from '@/theme';
import { metrics, radius } from '@/ui/tokens';

export type MarkState = TaskState | 'paused' | 'stopped' | 'read' | 'pending';

// Drawn natively so a long list stays cheap; only the arc moves, so only it animates.
export function Mark({ state }: { state: MarkState }) {
  if (state === 'working')
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
          <Arc size={metrics.list.todo} />
        </View>
      </RNHostView>
    );
  return (
    <ZStack
      alignment="center"
      modifiers={[frame({ width: metrics.list.mark, height: metrics.list.mark })]}
    >
      <Face state={state} />
    </ZStack>
  );
}

function Face({ state }: { state: Exclude<MarkState, 'working'> }) {
  const disc = (color: ColorValue, children: ReactNode) => (
    <>
      <Circle modifiers={[frame({ width: 16, height: 16 }), foregroundStyle(color)]} />
      {children}
    </>
  );
  switch (state) {
    // A to-do: yours while open, ticked once hex has it, as Muse draws one.
    case 'needs':
      return (
        <Spacer
          modifiers={[
            frame({ width: metrics.list.todo, height: metrics.list.todo }),
            strokeBorder({
              content: theme.accent,
              style: { lineWidth: 1.5 },
              shape: 'roundedRectangle',
              cornerRadius: radius.mark,
            }),
          ]}
        />
      );
    case 'done':
      return (
        <>
          <Rectangle
            modifiers={[
              frame({ width: metrics.list.todo, height: metrics.list.todo }),
              foregroundStyle(theme.fillStrong),
              clipShape('roundedRectangle', radius.mark),
            ]}
          />
          <Icon name="checkmark" size={metrics.symbol.mark} color={theme.secondary} />
        </>
      );
    case 'read':
      return <Icon name="checkmark" size={metrics.symbol.small} color={theme.tertiary} />;
    case 'failed':
      return disc(
        theme.dangerFill,
        <Icon name="exclamationmark" size={metrics.symbol.mark} color={theme.danger} />,
      );
    case 'paused':
      return disc(
        theme.fillStrong,
        <Icon name="pause.fill" size={metrics.symbol.mark} color={theme.secondary} />,
      );
    case 'stopped':
      return (
        <Rectangle modifiers={[frame({ width: 8, height: 8 }), foregroundStyle(theme.tertiary)]} />
      );
    case 'pending':
      return (
        <Spacer
          modifiers={[
            frame({ width: 12, height: 12 }),
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
            frame({ width: 9, height: 9 }),
            strokeBorder({ content: theme.tertiary, style: { lineWidth: 1.5 }, shape: 'circle' }),
          ]}
        />
      );
  }
}
