import { RNHostView, Icon, Spacer } from '@expo/ui';
import { Circle, Rectangle, ZStack } from '@expo/ui/swift-ui';
import { foregroundStyle, frame, strokeBorder } from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import { View, type ColorValue } from 'react-native';

import { Arc } from '@/components/agent-line';
import { MARK } from '@/components/tasks/parts';
import type { TaskState } from '@/live/tasks';
import { theme } from '@/theme';

export type MarkState = TaskState | 'paused' | 'stopped' | 'read' | 'pending';

// Drawn natively so a long list stays cheap; only the arc moves, so only it animates.
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
    case 'stopped':
      return (
        <Rectangle modifiers={[frame({ width: 7, height: 7 }), foregroundStyle(theme.tertiary)]} />
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
