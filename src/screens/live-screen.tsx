import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Persona, type PersonaState } from '@/components/persona';
import { opalPaletteInput } from '@/components/persona/variants';
import { Transcript } from '@/components/transcript';
import { VoiceControl } from '@/components/voice-control';
import { VoiceSettings } from '@/components/voice-settings';
import { useCallActivity } from '@/hooks/use-call-activity';
import { REACTIONS, useCallPreferences } from '@/hooks/use-call-preferences';
import { useCallFeedback } from '@/hooks/use-call-feedback';
import { useLiveSession } from '@/hooks/use-live-session';
import { usePersonaPreference } from '@/hooks/use-persona-preference';
import { useVoicePreference } from '@/hooks/use-voice-preference';
import { activityOrb } from '@/live/activity-orb';
import { motion } from '@/motion';
import { metrics, theme } from '@/theme';

const DOCKED_SIZE = 52;
const COMMIT = 0.35;
const FLICK = 500;
const RUBBER_BAND = 44;
const LANDED = 2;

export default function LiveScreen() {
  const session = useLiveSession();
  const { voice, setVoice, loaded: voiceLoaded } = useVoicePreference();
  const { variant, setVariant, loaded: personaLoaded } = usePersonaPreference();
  const preferences = useCallPreferences();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const connected = session.status === 'connected';
  const connecting = session.status === 'connecting';
  const disconnecting = session.status === 'disconnecting';
  const asleep = !connected && !connecting && !disconnecting;
  const voiceLocked = connecting || connected || disconnecting;
  const speaking = connected && session.outputLevel > 0.035;
  const personaState: PersonaState =
    connecting || disconnecting
      ? 'thinking'
      : speaking
        ? 'speaking'
        : connected && !session.muted
          ? 'listening'
          : 'idle';
  const status = connecting
    ? 'Connecting'
    : disconnecting
      ? 'Ending conversation'
      : connected
        ? session.muted
          ? 'Microphone muted'
          : 'Conversation active'
        : 'Ready to start a conversation';

  useCallFeedback(session.status, preferences);
  useCallActivity({
    ...session,
    orb: activityOrb(variant, preferences.personaColor, preferences.opalPalette),
  });
  const haptic = (feedback: () => Promise<void>) => {
    if (process.env.EXPO_OS === 'ios' && preferences.haptics) void feedback();
  };
  const tick = () => haptic(Haptics.selectionAsync);
  const land = () => haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));

  const size = Math.min(width * 0.62, height * 0.34, 280);
  const wake = useSharedValue(0);
  const breath = useSharedValue(0);
  const level = useSharedValue(0);
  const reaction = REACTIONS.find(({ id }) => id === preferences.reaction)!.amount;
  const heard = connected && !reducedMotion ? Math.max(0, session.inputLevel - 0.06) / 0.94 : 0;
  useEffect(() => {
    const target = connected ? 1 : asleep ? 0 : 0.5;
    if (reducedMotion) {
      wake.set(target);
      breath.set(0);
      return;
    }
    wake.set(
      connected
        ? withSpring(1, motion.wake)
        : withTiming(target, {
            duration: asleep ? motion.settle.asleep : motion.settle.connecting,
            easing: motion.settle.easing,
          }),
    );
    breath.set(
      asleep
        ? withRepeat(withTiming(1, motion.breath), -1, true)
        : withTiming(0, { duration: motion.breath.out }),
    );
  }, [connected, asleep, reducedMotion, wake, breath]);
  useEffect(() => {
    level.set(withSpring(heard, motion.reaction));
  }, [heard, level]);

  const bottomInset = Math.max(insets.bottom, 20) + 14;
  const shiftX = metrics.gutter + DOCKED_SIZE / 2 - width / 2;
  const travel = height - bottomInset - 32 - height / 2;
  const progress = useSharedValue(0);
  const goal = useSharedValue(0);
  const grab = useSharedValue({ offset: 0, line: COMMIT, crossed: false });
  const landing = useSharedValue(-1);

  const animateTo = (target: number, velocity = 0) => {
    'worklet';
    goal.set(target);
    landing.set(target);
    if (reducedMotion) {
      progress.set(withTiming(target, motion.reduced));
      return;
    }
    const distance = Math.abs(target - progress.get());
    const direction = Math.sign(target - progress.get());
    const toward = Math.max(0, direction * velocity);
    const omega = Math.min(
      Math.max(motion.glide.ease, toward / (distance || 1)),
      motion.glide.snap,
    );
    progress.set(
      withSpring(target, {
        mass: 1,
        stiffness: omega * omega,
        damping: 2 * omega,
        velocity: direction * Math.min(toward, omega * distance),
      }),
    );
  };

  const drag = () =>
    Gesture.Pan()
      .activeOffsetY([-12, 12])
      .onStart(({ translationY }) => {
        'worklet';
        cancelAnimation(progress);
        landing.set(-1);
        const now = progress.get();
        grab.set({
          offset: now - translationY / travel,
          line: goal.get() === 0 ? now + COMMIT : now - COMMIT,
          crossed: false,
        });
      })
      .onUpdate(({ translationY }) => {
        'worklet';
        const { offset, line, crossed } = grab.get();
        const raw = offset + translationY / travel;
        const limit = RUBBER_BAND / travel;
        const over = raw < 0 ? -raw : raw > 1 ? raw - 1 : 0;
        const banded = limit * (1 - 1 / ((over * 0.55) / limit + 1));
        progress.set(raw < 0 ? -banded : raw > 1 ? 1 + banded : raw);
        const past = goal.get() === 0 ? raw >= line : raw <= line;
        if (past !== crossed) {
          grab.set({ offset, line, crossed: past });
          scheduleOnRN(tick);
        }
      })
      .onEnd(({ velocityY }) => {
        'worklet';
        const from = goal.get();
        const target =
          velocityY > FLICK ? 1 : velocityY < -FLICK ? 0 : grab.get().crossed ? 1 - from : from;
        animateTo(target, velocityY / travel);
        scheduleOnRN(setReading, target === 1);
      });
  const screenDrag = drag().enabled(!reading).failOffsetX([-20, 20]);
  const orbGesture = Gesture.Race(
    drag().enabled(reading),
    Gesture.Tap()
      .enabled(reading)
      .onEnd(() => {
        'worklet';
        animateTo(0);
        scheduleOnRN(setReading, false);
      }),
  );

  const toggleReading = () => {
    const target = goal.get() === 0 ? 1 : 0;
    animateTo(target);
    setReading(target === 1);
  };

  useAnimatedReaction(
    () => progress.get(),
    (now) => {
      const target = landing.get();
      if (target >= 0 && Math.abs(now - target) * travel <= LANDED) {
        landing.set(-1);
        scheduleOnRN(land);
      }
    },
  );
  useAnimatedReaction(
    () => progress.get() >= 0.5,
    (on, was) => {
      if (was !== null && on !== was) scheduleOnRN(setCaptionsOn, on);
    },
  );

  const orbStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const t = reducedMotion ? (p < 0.5 ? 0 : 1) : p;
    const arc = t <= 0 ? 0 : t <= 1 ? t * t : 2 * t - 1;
    const awake = wake.get();
    const resting = size * (0.86 + 0.14 * awake);
    const visual = (resting + (DOCKED_SIZE - resting) * t) * (1 + 0.025 * breath.get());
    return {
      opacity:
        Math.min(1, 0.5 + 0.5 * awake + 0.1 * breath.get()) *
        (reducedMotion ? Math.abs(2 * p - 1) : 1),
      transform: [
        { translateX: shiftX * arc },
        { translateY: travel * t },
        { scale: (visual / size) * (1 + reaction * level.get()) },
      ],
    };
  });
  const transcriptStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const shown = reducedMotion
      ? Math.min(1, Math.max(0, p))
      : interpolate(p, [0.12, 0.72], [0, 1], Extrapolation.CLAMP);
    return { opacity: shown, transform: [{ translateY: reducedMotion ? 0 : (shown - 1) * 28 }] };
  });

  const onPrimaryPress = () => {
    if (disconnecting || !voiceLoaded) return;
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    if (connected || connecting) void session.stop();
    else void session.start(voice);
  };

  return (
    <View style={styles.screen}>
      <GestureDetector gesture={screenDrag}>
        <View style={styles.fill}>
          <Animated.View
            pointerEvents={reading ? 'auto' : 'none'}
            accessibilityElementsHidden={!reading}
            importantForAccessibility={reading ? 'auto' : 'no-hide-descendants'}
            style={[
              styles.transcript,
              { top: insets.top + 72, bottom: bottomInset + 64 + 18 },
              transcriptStyle,
            ]}
          >
            <Transcript entries={session.transcript} active={reading} />
            <View pointerEvents="none" style={styles.fade} />
          </Animated.View>
          <GestureDetector gesture={orbGesture}>
            <Animated.View
              accessible
              accessibilityLabel={status}
              style={[
                styles.orb,
                { width: size, height: size, left: (width - size) / 2, top: (height - size) / 2 },
                orbStyle,
              ]}
            >
              <Persona
                variant={variant}
                state={personaState}
                size={size}
                color={preferences.personaColor}
                palette={opalPaletteInput(preferences.opalPalette)}
              />
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureDetector>
      <View pointerEvents="box-none" style={[styles.toolbar, { top: insets.top + 12 }]}>
        <VoiceControl
          icon="captions"
          label={captionsOn ? 'Show orb' : 'Show transcript'}
          testID="transcript-button"
          selected={captionsOn}
          onPress={toggleReading}
          size={48}
        />
        <VoiceControl
          icon="settings"
          label="Voice and appearance settings"
          testID="voice-settings-button"
          onPress={() => setSettingsOpen(true)}
          size={48}
        />
      </View>
      <View pointerEvents="box-none" style={[styles.bottom, { paddingBottom: bottomInset }]}>
        {session.error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {session.error}
          </Text>
        )}
        <View pointerEvents="box-none" style={styles.controls}>
          <VoiceControl
            icon={session.muted ? 'mic-off' : 'mic'}
            label={session.muted ? 'Unmute microphone' : 'Mute microphone'}
            testID="session-mute-button"
            disabled={!connected}
            selected={session.muted}
            size={60}
            onPress={() => {
              haptic(Haptics.selectionAsync);
              session.toggleMute();
            }}
          />
          <VoiceControl
            icon={connected || connecting ? 'close' : 'waveform'}
            label={
              disconnecting
                ? 'Ending conversation'
                : connecting
                  ? 'Cancel connection'
                  : connected
                    ? 'End conversation'
                    : session.error
                      ? 'Retry conversation'
                      : 'Start conversation'
            }
            testID="session-primary-button"
            prominent
            size={64}
            loading={connecting || disconnecting}
            disabled={disconnecting || !voiceLoaded}
            onPress={onPrimaryPress}
          />
        </View>
      </View>
      <VoiceSettings
        isPresented={settingsOpen}
        onDismiss={() => setSettingsOpen(false)}
        voice={voice}
        onVoiceChange={setVoice}
        voiceEnabled={voiceLoaded && !voiceLocked}
        voiceLocked={voiceLocked}
        persona={variant}
        onPersonaChange={setVariant}
        personaEnabled={personaLoaded}
        preferences={preferences}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  fill: { ...StyleSheet.absoluteFill },
  transcript: { position: 'absolute', left: metrics.gutter, right: metrics.gutter },
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    experimental_backgroundImage: `linear-gradient(${theme.background}, transparent)`,
  },
  orb: { position: 'absolute' },
  toolbar: {
    position: 'absolute',
    left: metrics.gutter,
    right: metrics.gutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottom: {
    position: 'absolute',
    bottom: 0,
    left: metrics.gutter,
    right: metrics.gutter,
    gap: 22,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    height: 64,
  },
  error: {
    color: theme.danger,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
});
