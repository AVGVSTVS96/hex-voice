import { Host, Icon } from '@expo/ui';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ZoomIn,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { AgentLine as Line } from '@/live/agents';
import { motion } from '@/motion';
import { theme } from '@/theme';

const { step, turn, rise } = motion.agent;
const timing = { duration: step, easing: Easing.out(Easing.cubic) };
const enter = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: rise }] },
    animations: {
      opacity: withTiming(1, timing),
      transform: [{ translateY: withTiming(0, timing) }],
    },
  };
};
const leave = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: {
      opacity: withTiming(0, timing),
      transform: [{ translateY: withTiming(-rise, timing) }],
    },
  };
};

export function AgentLine({ line }: { line: Line | null }) {
  if (!line) return null;
  const label = `hex is ${line.state === 'running' ? 'working' : line.state}: ${line.text}${line.where ? `, ${line.where}` : ''}`;
  return (
    <Animated.View
      entering={FadeIn.duration(step)}
      exiting={FadeOut.duration(step)}
      accessible
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={styles.row}
    >
      <Glyph state={line.state} />
      <View style={styles.ticker}>
        <Animated.Text
          key={`${line.id} ${line.text}`}
          entering={enter}
          exiting={leave}
          numberOfLines={1}
          style={[styles.text, line.waiting && styles.waiting]}
        >
          {line.text}
        </Animated.Text>
      </View>
      {line.where ? (
        <Text
          style={[
            styles.where,
            line.state === 'done' && styles.done,
            line.state === 'failed' && styles.failed,
          ]}
        >
          {line.where}
        </Text>
      ) : null}
    </Animated.View>
  );
}

export type GlyphState = Line['state'] | 'needs' | 'idle';

// One mark, one meaning: the arc turns while something works, a check is done, ! failed, a
// filled mint dot is your turn, and a hollow ring is idle. A quiet mark is history, an entry
// something newer has replaced: a bare check or ! where it finished, a small dot where it moved on.
export function Glyph({ state, quiet = false }: { state: GlyphState; quiet?: boolean }) {
  if (quiet)
    return (
      <View style={styles.mark}>
        {state === 'done' || state === 'failed' ? (
          <Host matchContents>
            <Icon
              name={state === 'done' ? 'checkmark' : 'exclamationmark'}
              size={11}
              color={state === 'done' ? theme.secondary : theme.danger}
            />
          </Host>
        ) : (
          <View style={styles.past} />
        )}
      </View>
    );
  if (state === 'needs')
    return (
      <View style={styles.mark}>
        <View style={styles.yourTurn} />
      </View>
    );
  if (state === 'idle')
    return (
      <View style={styles.mark}>
        <View style={styles.idle} />
      </View>
    );
  return (
    <View style={[styles.glyph, state === 'failed' && styles.glyphFailed]}>
      {state === 'running' ? (
        <Arc />
      ) : (
        <Animated.View key={state} entering={ZoomIn.springify().damping(14)}>
          <Host matchContents>
            <Icon
              name={state === 'done' ? 'checkmark' : 'exclamationmark'}
              size={11}
              color={state === 'done' ? theme.accent : theme.danger}
            />
          </Host>
        </Animated.View>
      )}
    </View>
  );
}

function Arc() {
  const spin = useSharedValue(0);
  const still = useReducedMotion();
  useEffect(() => {
    if (still) return;
    spin.set(withRepeat(withTiming(1, { duration: turn, easing: Easing.linear }), -1));
    return () => cancelAnimation(spin);
  }, [spin, still]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get() * 360}deg` }] }));
  return <Animated.View style={[styles.arc, style]} />;
}

const styles = StyleSheet.create({
  row: { height: 22, flexDirection: 'row', alignItems: 'center', gap: 10 },
  glyph: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphFailed: { backgroundColor: theme.dangerMuted },
  mark: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  yourTurn: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.accent },
  past: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.tertiary },
  idle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: theme.tertiary,
  },
  arc: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.accentTrack,
    borderTopColor: theme.accent,
  },
  ticker: { flex: 1, height: 22, overflow: 'hidden' },
  text: {
    position: 'absolute',
    left: 0,
    right: 0,
    color: theme.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  waiting: { color: theme.secondary },
  where: { color: theme.tertiary, fontSize: 13, lineHeight: 22, fontVariant: ['tabular-nums'] },
  done: { color: theme.accent },
  failed: { color: theme.danger },
});
