import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Glyph } from '@/components/glyph';
import {
  ENDINGS,
  SOURCES,
  byDay,
  callDetails,
  callName,
  callTime,
  type CallId,
  type CallSummary,
} from '@/live/calls';
import { motion } from '@/motion';
import { circle, theme } from '@/theme';
import { ScrollView } from '@/ui/scroll';
import { metrics, radius, space, textOf } from '@/ui/tokens';

const ACTION = 64;
const DELETE_AT = 180;

type Props = {
  top: number;
  width: number;
  calls?: CallSummary[];
  live?: string;
  viewing: string | null;
  offline: boolean;
  haptics: boolean;
  onOpen: (call: CallSummary) => void;
  onDelete: (id: CallId) => void;
};

export const CallsSidebar = ({
  top,
  width,
  calls,
  live,
  viewing,
  offline,
  haptics,
  onOpen,
  onDelete,
}: Props) => {
  // A head only parts one group from another, so a lone one is left off.
  const days = byDay(calls ?? []);
  return (
    <View style={[styles.sidebar, { width, paddingTop: top }]}>
      <Text accessibilityRole="header" style={styles.title}>
        Calls
      </Text>
      {calls && !calls.length ? (
        <Empty offline={offline} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {offline && (
            <Text style={styles.offline}>Can’t reach hex. These are kept on this device.</Text>
          )}
          {days.map((day) => (
            <View key={day.label}>
              {days.length > 1 ? <Text style={styles.day}>{day.label}</Text> : null}
              {day.calls.map((call) => (
                <Row
                  key={call.id}
                  call={call}
                  width={width}
                  live={call.id === live}
                  selected={call.id === viewing}
                  haptics={haptics}
                  onOpen={onOpen}
                  onDelete={onDelete}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const Row = ({
  call,
  width,
  live,
  selected,
  haptics,
  onOpen,
  onDelete,
}: {
  call: CallSummary;
  width: number;
  live: boolean;
  selected: boolean;
  haptics: boolean;
  onOpen: (call: CallSummary) => void;
  onDelete: (id: CallId) => void;
}) => {
  const x = useSharedValue(0);
  const from = useSharedValue(0);
  // Swiped open, its delete button is there for VoiceOver too; closed, the row's own action is.
  const [open, setOpen] = useState(false);
  const remove = () => {
    if (process.env.EXPO_OS === 'ios' && haptics)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete(call.id);
  };
  const settle = (to: number, velocity = 0) => {
    'worklet';
    x.set(withSpring(to, { ...motion.row, velocity }));
    scheduleOnRN(setOpen, to !== 0);
  };
  const swipe = Gesture.Pan()
    .enabled(!live)
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onStart(() => {
      from.set(x.get());
    })
    .onUpdate(({ translationX }) => {
      x.set(Math.min(0, from.get() + translationX));
    })
    .onEnd(({ translationX, velocityX }) => {
      const at = from.get() + translationX;
      if (at < -DELETE_AT) {
        x.set(withTiming(-width, { duration: motion.rowOut }));
        scheduleOnRN(remove);
      } else settle(at < -ACTION / 2 || velocityX < -400 ? -ACTION : 0, velocityX);
    });
  const tap = Gesture.Tap().onEnd(() => {
    if (x.get() < -1) settle(0);
    else scheduleOnRN(onOpen, call);
  });
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const action = useAnimatedStyle(() => ({
    opacity: Math.min(1, -x.get() / ACTION),
    transform: [{ scale: 0.6 + 0.4 * Math.min(1, -x.get() / ACTION) }],
  }));

  const ending = call.end && ENDINGS[call.end];
  return (
    <Animated.View
      exiting={FadeOut.duration(motion.rowOut)}
      layout={LinearTransition.duration(motion.rowOut)}
      style={[styles.row, selected && styles.selected]}
    >
      <Animated.View style={[styles.action, action]}>
        <Pressable
          accessibilityLabel="Delete call"
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
          onPress={remove}
          style={styles.delete}
        >
          <Glyph name="trash" size={metrics.symbol.bar} color={theme.onProminent} />
        </Pressable>
      </Animated.View>
      <GestureDetector gesture={Gesture.Exclusive(swipe, tap)}>
        <Animated.View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${callName(call)}, ${call.failed ?? callDetails(call)}, ${callTime(call.started)}`}
          accessibilityActions={live ? [] : [{ name: 'delete', label: 'Delete call' }]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === 'delete') remove();
          }}
          style={[styles.slide, selected && styles.selected, slide]}
        >
          <View style={styles.nameRow}>
            <Text numberOfLines={2} style={styles.name}>
              {callName(call)}
            </Text>
            <Text style={styles.when}>{live ? 'Now' : callTime(call.started)}</Text>
          </View>
          <View style={styles.metaRow}>
            {call.from === 'app' ? null : (
              <Glyph
                name={SOURCES[call.from].symbol}
                size={metrics.symbol.small}
                color={live ? theme.progress : theme.secondary}
              />
            )}
            <Text numberOfLines={1} style={styles.meta}>
              {live ? (
                <Text style={styles.live}>Live now</Text>
              ) : call.failed ? (
                <Text style={styles.bad}>{call.failed}</Text>
              ) : (
                callDetails(call)
              )}
              {!live && !call.failed && ending?.short && (
                <Text style={ending.bad && styles.bad}>{` · ${ending.short}`}</Text>
              )}
            </Text>
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
};

const Empty = ({ offline }: { offline: boolean }) => (
  <View style={styles.empty}>
    <View style={styles.ring}>
      <Glyph
        name={offline ? 'wifi.slash' : 'clock.arrow.circlepath'}
        size={metrics.symbol.regular}
        color={theme.secondary}
      />
    </View>
    <Text style={styles.emptyTitle}>{offline ? 'Can’t reach hex' : 'No calls yet'}</Text>
    <Text style={styles.emptyText}>
      {offline
        ? 'Check that Tailscale is on. Calls catches up on its own once hex answers.'
        : 'When a call ends, it lands here, whether you called from this app, the web page or your phone.'}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.sheet,
  },
  title: {
    ...textOf('title'),
    color: theme.text,
    paddingHorizontal: metrics.list.inset,
    paddingTop: space[3],
    paddingBottom: space[2],
  },
  list: { paddingBottom: space[10] },
  offline: {
    ...textOf('caption'),
    color: theme.secondary,
    paddingHorizontal: metrics.list.inset,
    paddingTop: space[2],
  },
  day: {
    ...textOf('detail'),
    color: theme.secondary,
    paddingHorizontal: metrics.list.inset,
    paddingTop: space[6],
    paddingBottom: space[2],
  },
  // The row sizes to its words; its delete button waits behind it, uncovered by the swipe.
  row: {
    marginHorizontal: space[2],
    borderRadius: radius.control,
    borderCurve: 'continuous',
  },
  selected: { backgroundColor: theme.card },
  slide: {
    gap: space[1],
    paddingHorizontal: metrics.list.inset - space[2],
    paddingVertical: space[3],
    borderRadius: radius.control,
    borderCurve: 'continuous',
    backgroundColor: theme.sheet,
  },
  nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  name: { ...textOf('headline'), flex: 1, color: theme.text },
  meta: { ...textOf('detail'), flexShrink: 1, color: theme.secondary },
  live: { color: theme.progress },
  bad: { color: theme.danger },
  when: { ...textOf('caption'), color: theme.tertiary, fontVariant: ['tabular-nums'] },
  action: { position: 'absolute', right: space[2], top: 0, bottom: 0, justifyContent: 'center' },
  delete: {
    ...circle(44),
    backgroundColor: theme.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingHorizontal: space[8], paddingTop: metrics.emptyTop },
  ring: {
    ...circle(72),
    backgroundColor: theme.skeleton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...textOf('title'), color: theme.text, marginTop: space[6] },
  emptyText: {
    ...textOf('body'),
    color: theme.secondary,
    textAlign: 'center',
    marginTop: space[2],
  },
});
