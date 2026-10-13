import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { VoiceControl } from '@/components/voice-control';
import { motion } from '@/motion';
import { theme } from '@/theme';

const SIZE = 48;
const RING = 56;

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
    <View style={styles.button}>
      <VoiceControl
        icon="tasks"
        label={label}
        testID="tasks-button"
        selected={selected}
        onPress={onPress}
        size={SIZE}
      />
      {working > 0 && <Ring />}
      {needs > 0 && (
        <Animated.View
          pointerEvents="none"
          entering={ZoomIn.springify().damping(14)}
          exiting={ZoomOut.duration(motion.toolbar)}
          style={styles.dot}
        />
      )}
    </View>
  );
}

function Ring() {
  const spin = useSharedValue(0);
  const still = useReducedMotion();
  useEffect(() => {
    if (still) return;
    spin.set(withRepeat(withTiming(1, { duration: motion.agent.turn, easing: Easing.linear }), -1));
    return () => cancelAnimation(spin);
  }, [spin, still]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get() * 360}deg` }] }));
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(motion.toolbar)}
      exiting={FadeOut.duration(motion.toolbar)}
      style={[styles.ring, style]}
    />
  );
}

const styles = StyleSheet.create({
  button: { width: SIZE, height: SIZE },
  ring: {
    position: 'absolute',
    left: (SIZE - RING) / 2,
    top: (SIZE - RING) / 2,
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 2,
    borderColor: theme.accentTrack,
    borderTopColor: theme.accent,
  },
  dot: {
    position: 'absolute',
    left: 34,
    top: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: theme.background,
    backgroundColor: theme.accent,
  },
});
