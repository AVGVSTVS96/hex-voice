import { Circle, ZStack } from '@expo/ui/swift-ui';
import {
  Animation,
  animation,
  foregroundStyle,
  frame,
  offset,
  onAppear,
  opacity,
  rotationEffect,
  scaleEffect,
  strokeBorder,
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { Control } from '@/components/voice-control';
import { motion } from '@/motion';
import { TOOL } from '@/screens/layout';
import { theme } from '@/theme';

const RING = 56;
const DOT = 14;
const LINE = 2;
const ARC = (Math.PI * (RING - LINE)) / 4;
const CLEAR = '#00000000';

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
        frame({ width: TOOL, height: TOOL }),
        animation(Animation.easeInOut({ duration: motion.toolbar / 1000 }), working > 0),
      ]}
    >
      {working > 0 && <Ring />}
      <Control
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
          offset({ x: (TOOL - DOT) / 2, y: -(TOOL - DOT) / 2 }),
          scaleEffect(needs > 0 ? 1 : 0.01),
          opacity(needs > 0 ? 1 : 0),
          animation(Animation.bouncy(), needs > 0),
        ]}
      />
    </ZStack>
  );
}

function Ring() {
  const still = useReducedMotion();
  const [turning, setTurning] = useState(false);
  return (
    <Circle
      modifiers={[
        foregroundStyle(CLEAR),
        frame({ width: RING, height: RING }),
        strokeBorder({ content: theme.accentTrack, style: { lineWidth: LINE }, shape: 'circle' }),
        strokeBorder({
          content: theme.accent,
          style: { lineWidth: LINE, lineCap: 'round', dash: [ARC, 3 * ARC] },
          shape: 'circle',
        }),
        rotationEffect(turning ? 360 : 0),
        animation(
          Animation.linear({ duration: motion.agent.turn / 1000 }).repeat({
            repeatCount: 1_000_000,
            autoreverses: false,
          }),
          turning,
        ),
        onAppear(() => setTurning(!still)),
      ]}
    />
  );
}
