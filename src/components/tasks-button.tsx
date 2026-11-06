import { RNHostView } from '@expo/ui';
import { Circle, ZStack } from '@expo/ui/swift-ui';
import {
  Animation,
  animation,
  foregroundStyle,
  frame,
  offset,
  opacity,
  scaleEffect,
  strokeBorder,
} from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';

import { Arc } from '@/components/agent-line';
import { motion } from '@/motion';
import { theme } from '@/theme';
import { GlassButton } from '@/ui/glass-button';
import { metrics } from '@/ui/tokens';

const RING = metrics.tool;
const DOT = 14;
const LINE = 2;

// The Tasks button wears the agent line's marks: its arc turns while anything works, and a mint
// dot says something needs you. Nothing else on it moves.
export function TasksButton({
  needs,
  working,
  selected,
  onPress,
}: {
  needs: number;
  working: number;
  selected: boolean;
  onPress: () => void;
}) {
  const label = [
    'Tasks',
    needs ? `${needs} need${needs === 1 ? 's' : ''} you` : '',
    working ? `${working} working` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <ZStack
      modifiers={[
        frame({ width: metrics.tool, height: metrics.tool }),
        animation(Animation.easeInOut({ duration: motion.toolbar / 1000 }), working > 0),
      ]}
    >
      {working > 0 && <Ring />}
      <GlassButton
        bare
        icon="tasks"
        label={label}
        testID="tasks-button"
        selected={selected}
        onPress={onPress}
      />
      <Circle
        modifiers={[
          foregroundStyle(theme.accent),
          frame({ width: DOT, height: DOT }),
          strokeBorder({ content: theme.background, style: { lineWidth: LINE }, shape: 'circle' }),
          offset({ x: (metrics.tool - DOT) / 2, y: -(metrics.tool - DOT) / 2 }),
          scaleEffect(needs > 0 ? 1 : 0.01),
          opacity(needs > 0 ? 1 : 0),
          animation(Animation.bouncy(), needs > 0),
        ]}
      />
    </ZStack>
  );
}

// The agent line's turning arc, turned by Reanimated: a turn SwiftUI repeats forever also carries
// every move the toolbar makes around it, so the ring flew off the button as places opened.
function Ring() {
  return (
    <RNHostView matchContents>
      <View pointerEvents="none" style={{ width: RING, height: RING }}>
        <Arc size={RING} />
      </View>
    </RNHostView>
  );
}
