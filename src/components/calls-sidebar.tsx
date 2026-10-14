import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  isNaming,
  timeOfDay,
  type CallSummary,
} from '@/live/calls';
import { motion } from '@/motion';
import { theme } from '@/theme';

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
  onDelete: (id: string) => void;
};

export function CallsSidebar({
  top,
  width,
  calls,
  live,
  viewing,
  offline,
  haptics,
  onOpen,
  onDelete,
}: Props) {
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
            <Text style={styles.offline}>Can’t reach hex. These are kept on this phone.</Text>
          )}
          {byDay(calls ?? []).map((day) => (
            <View key={day.label}>
              <Text style={styles.day}>{day.label}</Text>
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
}

function Row({
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
  onDelete: (id: string) => void;
}) {
  const x = useSharedValue(0);
  const from = useSharedValue(0);
  const remove = () => {
    if (process.env.EXPO_OS === 'ios' && haptics)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete(call.id);
  };
  const settle = (to: number, velocity = 0) => {
    'worklet';
    x.set(withSpring(to, { ...motion.row, velocity }));
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

  const naming = isNaming(call);
  const ending = call.end && ENDINGS[call.end];
  return (
    <Animated.View
      exiting={FadeOut.duration(motion.rowOut)}
      layout={LinearTransition.duration(motion.rowOut)}
      style={[styles.row, selected && styles.selected]}
    >
      <Animated.View style={[styles.action, action]}>
        <Pressable accessibilityLabel="Delete call" onPress={remove} style={styles.delete}>
          <Glyph name="trash" size={19} color={theme.onProminent} />
        </Pressable>
      </Animated.View>
      <GestureDetector gesture={Gesture.Exclusive(swipe, tap)}>
        <Animated.View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${callName(call)}, ${callDetails(call)}, ${timeOfDay(call.started)}`}
          style={[styles.slide, selected && styles.selected, slide]}
        >
          <View style={styles.icon}>
            <Glyph name={SOURCES[call.from].symbol} size={17} color={theme.secondary} />
          </View>
          <View style={styles.body}>
            <Text numberOfLines={1} style={[styles.name, !call.title && styles.unnamed]}>
              {callName(call)}
            </Text>
            <View style={styles.metaRow}>
              <Text numberOfLines={1} style={styles.meta}>
                {live ? <Text style={styles.live}>Live now</Text> : callDetails(call)}
                {!live && ending?.short && (
                  <Text style={ending.bad && styles.bad}>{` · ${ending.short}`}</Text>
                )}
              </Text>
              <Text style={styles.when}>{live || naming ? 'Now' : timeOfDay(call.started)}</Text>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

function Empty({ offline }: { offline: boolean }) {
  return (
    <View style={styles.empty}>
      <View style={styles.ring}>
        <Glyph
          name={offline ? 'wifi.slash' : 'clock.arrow.circlepath'}
          size={28}
          color={theme.secondary}
        />
      </View>
      <Text style={styles.emptyTitle}>{offline ? 'Can’t reach hex' : 'No calls yet'}</Text>
      <Text style={styles.emptyText}>
        {offline
          ? 'Check that Tailscale is on, then open Calls again.'
          : 'When a call ends, it lands here, whether you called from this app, the web page or your phone.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.sheet,
  },
  title: {
    color: theme.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  list: { paddingBottom: 40 },
  offline: {
    color: theme.secondary,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  day: {
    color: theme.secondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  row: { height: 64, marginHorizontal: 8, borderRadius: 14, borderCurve: 'continuous' },
  selected: { backgroundColor: theme.skeleton },
  slide: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: theme.sheet,
  },
  icon: { width: 44, alignItems: 'center' },
  body: { flex: 1, paddingRight: 12, gap: 2 },
  name: {
    color: theme.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '500',
    letterSpacing: -0.16,
  },
  unnamed: { color: theme.secondary, fontWeight: '400' },
  metaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  meta: { flex: 1, color: theme.secondary, fontSize: 14, lineHeight: 19 },
  live: { color: theme.switchOn },
  bad: { color: theme.danger },
  when: { color: theme.secondary, fontSize: 14, lineHeight: 19, fontVariant: ['tabular-nums'] },
  action: { position: 'absolute', right: 8, top: 10 },
  delete: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 130 },
  ring: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.skeleton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    marginTop: 22,
  },
  emptyText: {
    color: theme.secondary,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 8,
  },
});
