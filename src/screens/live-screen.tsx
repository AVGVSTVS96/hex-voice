import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
  FadeIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AgentLine } from '@/components/agent-line';
import { CallMenu } from '@/components/call-menu';
import { CallTranscript } from '@/components/call-transcript';
import { CallsSidebar, SIDEBAR } from '@/components/calls-sidebar';
import { Persona, type PersonaState } from '@/components/persona';
import { TasksButton } from '@/components/tasks-button';
import { TasksSheet } from '@/components/tasks-sheet';
import { opalPaletteInput } from '@/components/persona/variants';
import { Transcript } from '@/components/transcript';
import { VoiceControl } from '@/components/voice-control';
import { VoiceSettings } from '@/components/voice-settings';
import { WrapUp } from '@/components/wrap-up';
import { useCallActivity } from '@/hooks/use-call-activity';
import { REACTIONS, useCallPreferences } from '@/hooks/use-call-preferences';
import { useCallFeedback } from '@/hooks/use-call-feedback';
import { useAgentLine } from '@/hooks/use-agent-line';
import { useCall, useCalls } from '@/hooks/use-calls';
import { useTaskCounts } from '@/hooks/use-tasks';
import { useLiveSession } from '@/hooks/use-live-session';
import { usePhoneCall } from '@/hooks/use-phone-call';
import { useWrapUp } from '@/hooks/use-wrap-up';
import { usePersonaPreference } from '@/hooks/use-persona-preference';
import { useVoicePreference } from '@/hooks/use-voice-preference';
import { useVoiceTone } from '@/hooks/use-voice-tone';
import { activityOrb } from '@/live/activity-orb';
import { tasksAPI } from '@/live/api';
import type { TaskRow } from '@/live/tasks';
import {
  ENDINGS,
  callLength,
  callName,
  callWhen,
  transcriptText,
  type CallSummary,
} from '@/live/calls';
import { heard, motion } from '@/motion';
import { orbRest } from '@/screens/orb-rest';
import { metrics, theme } from '@/theme';

const DOCKED_SIZE = 52;
const COMMIT = 0.35;
const FLICK = 500;
const RUBBER_BAND = 44;
const LANDED = 2;
const AGENT_ROW = 22;
const TOOLBAR = 48;

export default function LiveScreen() {
  const session = useLiveSession();
  const { voice, setVoice, loaded: voiceLoaded } = useVoicePreference();
  const { variant, setVariant, loaded: personaLoaded } = usePersonaPreference();
  const preferences = useCallPreferences();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const counts = useTaskCounts();
  const calls = useCalls(drawerOpen);
  const phoneCall = usePhoneCall(calls.live, calls.calls);
  const [viewing, setViewing] = useState<string | null>(null);
  const shown = viewing ? calls.calls?.find((call) => call.id === viewing) : undefined;
  const past = useCall(shown);
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
  const agent = useAgentLine(connected, preferences.haptics);
  useEndedCall(session, voice, calls.add);
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
  const reacting = connected && !reducedMotion && !session.muted && reaction > 0;
  const loudness = reacting ? Math.max(0, session.inputLevel - 0.06) / 0.94 : 0;
  const { pitch, tone } = useVoiceTone(reacting);
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
    level.set(withSpring(loudness, motion.reaction));
  }, [loudness, level]);

  const bottomInset = Math.max(insets.bottom, 20) + 14;
  const agentBottom = Math.max(insets.bottom - 17, 6);
  // The footer (how the call ended, hex's wrap-up, the call buttons) is measured, and what sits
  // above it (the resting orb, or the transcript) keeps clear of it. On a call Tasks opens half
  // height over the screen, and the resting orb keeps clear of it too, still listening.
  const [footer, setFooter] = useState(bottomInset + 64);
  const rest = orbRest(
    {
      top: insets.top + 12 + TOOLBAR,
      bottom: Math.min(height - footer, tasksOpen && voiceLocked ? height / 2 : height),
    },
    height / 2,
    size,
  );
  const restY = useSharedValue(rest.y);
  const restScale = useSharedValue(rest.scale);
  const footerHeight = useSharedValue(footer);
  useEffect(() => {
    const settle = (to: number) =>
      reducedMotion ? withTiming(to, motion.reduced) : withSpring(to, motion.drawer);
    restY.set(settle(rest.y));
    restScale.set(settle(rest.scale));
    footerHeight.set(settle(footer));
  }, [rest.y, rest.scale, footer, reducedMotion, restY, restScale, footerHeight]);
  const shiftX = metrics.gutter + DOCKED_SIZE / 2 - width / 2;
  const dockY = height - bottomInset - 32;
  const travel = dockY - rest.y;
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

  useEffect(() => {
    if (!reading) setViewing(null);
  }, [reading]);

  const drawer = useSharedValue(0);
  const drawerFrom = useSharedValue(0);
  const settleDrawer = (open: boolean, velocity = 0) => {
    'worklet';
    drawer.set(
      reducedMotion
        ? withTiming(open ? 1 : 0, motion.reduced)
        : withSpring(open ? 1 : 0, { ...motion.drawer, velocity: velocity / SIDEBAR }),
    );
    scheduleOnRN(setDrawerOpen, open);
  };
  const drawerPan = (offset: number | [number, number]) =>
    Gesture.Pan()
      .activeOffsetX(offset)
      .failOffsetY([-14, 14])
      .onStart(() => {
        'worklet';
        cancelAnimation(drawer);
        drawerFrom.set(drawer.get());
      })
      .onUpdate(({ translationX }) => {
        'worklet';
        drawer.set(Math.min(1, Math.max(0, drawerFrom.get() + translationX / SIDEBAR)));
      })
      .onEnd(({ velocityX }) => {
        'worklet';
        const open = velocityX > 400 || (velocityX > -400 && drawer.get() > 0.5);
        settleDrawer(open, velocityX);
      });
  const edgeOpen = drawerPan(12);
  const sidebarClose = drawerPan(-16);
  const peekClose = Gesture.Race(
    drawerPan([-10, 10]),
    Gesture.Tap().onEnd(() => {
      'worklet';
      settleDrawer(false);
    }),
  );
  const openDrawer = () => {
    tick();
    settleDrawer(true);
  };
  const openCall = (call: CallSummary) => {
    settleDrawer(false);
    if (call.id === calls.live && voiceLocked) return backToCall();
    setViewing(call.id);
    animateTo(1);
    setReading(true);
  };
  // A past call opened mid-call only changes what's on screen; the live call goes on underneath.
  const backToCall = () => {
    tick();
    setViewing(null);
  };
  const screenStyle = useAnimatedStyle(() => {
    const d = drawer.get();
    return {
      transform: [{ translateX: d * SIDEBAR }],
      borderRadius: 44 * Math.min(1, d * 4),
      borderWidth: d > 0 ? StyleSheet.hairlineWidth : 0,
    };
  });
  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (drawer.get() - 1) * 48 }],
  }));

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
    const fitted = resting * restScale.get();
    const visual = (fitted + (DOCKED_SIZE - fitted) * t) * (1 + 0.025 * breath.get());
    const y = restY.get();
    return {
      opacity:
        Math.min(1, 0.5 + 0.5 * awake + 0.1 * breath.get()) *
        (reducedMotion ? Math.abs(2 * p - 1) : 1),
      transform: [
        { translateX: shiftX * arc },
        { translateY: y - height / 2 + (dockY - y) * t },
        { scale: visual / size },
        ...heard(reaction, size, level.get(), pitch.get(), tone.get()),
      ],
    };
  });
  const transcriptStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const shown = reducedMotion
      ? Math.min(1, Math.max(0, p))
      : interpolate(p, [0.12, 0.72], [0, 1], Extrapolation.CLAMP);
    return {
      bottom: footerHeight.get() + 18,
      opacity: shown,
      transform: [{ translateY: reducedMotion ? 0 : (shown - 1) * 28 }],
    };
  });

  const startCall = (about?: string) => {
    const start = () => {
      if (viewing) {
        animateTo(0);
        setReading(false);
      }
      void session.start(voice, about);
    };
    if (!phoneCall) return start();
    Alert.alert(
      'You’re on a phone call with hex',
      'Starting a call here hangs up the phone call.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Move it here', onPress: start },
      ],
    );
  };
  const onPrimaryPress = () => {
    if (disconnecting || !voiceLoaded) return;
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    if (connected || connecting) void session.stop();
    else startCall();
  };
  const openTasks = () => {
    tick();
    setTasksOpen(true);
  };
  // Talk it through: on a call, the voice brings the task up; before one, it starts a call about it.
  const talkAbout = (task: TaskRow) => {
    setTasksOpen(false);
    if (voiceLocked) void tasksAPI.talk(task.id).catch(() => {});
    else if (voiceLoaded) startCall(task.id);
  };

  const ending = session.ending && !voiceLocked && !viewing ? ENDINGS[session.ending] : undefined;
  const wrapUp = useWrapUp(session.callId, !!ending && session.ending !== 'no-connect');

  return (
    <View style={styles.root}>
      <GestureDetector gesture={sidebarClose}>
        <Animated.View style={[styles.sidebar, sidebarStyle]}>
          <CallsSidebar
            top={insets.top}
            calls={calls.calls}
            live={calls.live}
            viewing={viewing}
            offline={calls.offline}
            haptics={preferences.haptics}
            onOpen={openCall}
            onDelete={(id) => {
              if (id === viewing) setReading(false);
              calls.remove(id);
            }}
          />
        </Animated.View>
      </GestureDetector>
      <Animated.View style={[styles.screen, screenStyle]}>
        <GestureDetector gesture={screenDrag}>
          <View style={styles.fill}>
            <Animated.View
              pointerEvents={reading ? 'auto' : 'none'}
              accessibilityElementsHidden={!reading}
              importantForAccessibility={reading ? 'auto' : 'no-hide-descendants'}
              style={[styles.transcript, { top: insets.top + 72 }, transcriptStyle]}
            >
              {shown ? (
                <CallTranscript
                  summary={shown}
                  call={past.call}
                  failed={past.failed}
                  live={shown.id === calls.live}
                />
              ) : (
                <Transcript entries={session.transcript} active={reading} />
              )}
              <View pointerEvents="none" style={styles.fade} />
              <View pointerEvents="none" style={styles.fadeBottom} />
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
          {shown ? (
            <>
              <VoiceControl
                icon="calls"
                label="Calls"
                testID="calls-button"
                selected={drawerOpen}
                onPress={openDrawer}
                size={48}
              />
              <View pointerEvents="box-none" style={styles.pastTitle}>
                <Text numberOfLines={1} style={styles.pastName}>
                  {callName(shown)}
                </Text>
                {voiceLocked ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={backToCall}
                    hitSlop={10}
                    style={styles.backToCall}
                  >
                    <View style={styles.liveDot} />
                    <Text style={styles.backText}>Back to your call</Text>
                  </Pressable>
                ) : (
                  <Text numberOfLines={1} style={styles.pastWhen}>
                    {callWhen(shown, shown.id === calls.live)}
                  </Text>
                )}
              </View>
              <CallMenu
                transcript={past.call && transcriptText(past.call)}
                title={callName(shown)}
                onDelete={
                  shown.id === calls.live
                    ? undefined
                    : () => {
                        setReading(false);
                        animateTo(0);
                        calls.remove(shown.id);
                      }
                }
              />
            </>
          ) : (
            <>
              <View style={styles.toolbarStart}>
                <VoiceControl
                  icon="captions"
                  label={captionsOn ? 'Show orb' : 'Show transcript'}
                  testID="transcript-button"
                  selected={captionsOn}
                  onPress={toggleReading}
                  size={48}
                />
                <VoiceControl
                  icon="calls"
                  label="Calls"
                  testID="calls-button"
                  selected={drawerOpen}
                  onPress={openDrawer}
                  size={48}
                />
              </View>
              <View style={styles.toolbarStart}>
                <TasksButton
                  needs={counts.needs}
                  working={counts.working}
                  selected={tasksOpen}
                  onPress={openTasks}
                />
                <VoiceControl
                  icon="settings"
                  label="Voice and appearance settings"
                  testID="voice-settings-button"
                  onPress={() => setSettingsOpen(true)}
                  size={48}
                />
              </View>
            </>
          )}
        </View>
        <View
          pointerEvents="box-none"
          onLayout={({ nativeEvent }) => setFooter(nativeEvent.layout.height)}
          style={[styles.bottom, { paddingBottom: bottomInset }]}
        >
          {ending && wrapUp && (wrapUp.title || wrapUp.summary || wrapUp.waiting?.length) ? (
            <Animated.View entering={FadeIn.duration(motion.toolbar)} style={styles.wrapUp}>
              {wrapUp.title && (
                <Text numberOfLines={1} style={styles.wrapTitle}>
                  {wrapUp.title}
                </Text>
              )}
              <WrapUp center summary={wrapUp.summary} waiting={wrapUp.waiting?.slice(0, 3)} />
            </Animated.View>
          ) : null}
          {ending ? (
            <Text
              accessibilityRole="alert"
              style={[styles.ended, ending.bad && { color: theme.danger }]}
            >
              {session.ending === 'no-connect'
                ? ending.line
                : `${ending.line} · ${callLength(session.elapsedSeconds)}`}
            </Text>
          ) : session.interrupted ? (
            <Text accessibilityRole="alert" style={styles.ended}>
              Paused while your phone has the audio
            </Text>
          ) : (
            session.error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {session.error}
              </Text>
            )
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
        <Pressable
          pointerEvents={agent ? 'auto' : 'none'}
          onPress={openTasks}
          accessibilityRole="button"
          accessibilityHint="Opens Tasks"
          hitSlop={{ top: 8, bottom: 12 }}
          style={[styles.agent, { bottom: agentBottom }]}
        >
          <AgentLine line={agent} />
        </Pressable>
        <TasksSheet
          isPresented={tasksOpen}
          onDismiss={() => setTasksOpen(false)}
          onCall={voiceLocked}
          haptics={preferences.haptics}
          onTalk={talkAbout}
        />
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
        {!drawerOpen && (
          <GestureDetector gesture={edgeOpen}>
            <View style={styles.edge} />
          </GestureDetector>
        )}
        {drawerOpen && (
          <GestureDetector gesture={peekClose}>
            <View accessibilityLabel="Close calls" style={StyleSheet.absoluteFill} />
          </GestureDetector>
        )}
      </Animated.View>
    </View>
  );
}

// The call you just hung up on is at the top of Calls before hex's copy arrives.
function useEndedCall(
  session: ReturnType<typeof useLiveSession>,
  voice: string,
  add: (call: CallSummary) => void,
) {
  const started = useRef<string | null>(null);
  const { status, callId, transcript, elapsedSeconds } = session;
  useEffect(() => {
    if (status === 'connected') started.current ??= new Date().toISOString();
    if ((status !== 'idle' && status !== 'error') || !callId || !started.current) return;
    add({
      id: callId,
      started: started.current,
      ended: new Date().toISOString(),
      end: session.ending ?? undefined,
      from: 'app',
      voice,
      seconds: elapsedSeconds,
      tasks: 0,
      preview:
        transcript
          .find((entry) => entry.role === 'user')
          ?.text.trim()
          .slice(0, 160) ?? '',
    });
    started.current = null;
  }, [status]);
}

const FADE = [{ color: theme.background }, { color: 'transparent' }];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.sheet },
  screen: {
    flex: 1,
    backgroundColor: theme.background,
    overflow: 'hidden',
    borderColor: theme.edge,
    borderCurve: 'continuous',
  },
  sidebar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: SIDEBAR },
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 20 },
  toolbarStart: { flexDirection: 'row', gap: 12 },
  pastTitle: { position: 'absolute', left: 60, right: 60, top: 3, alignItems: 'center' },
  pastName: { color: theme.text, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  pastWhen: { color: theme.secondary, fontSize: 13, lineHeight: 18 },
  ended: { color: theme.secondary, textAlign: 'center', fontSize: 15, lineHeight: 20 },
  wrapUp: { gap: 10, alignItems: 'center' },
  wrapTitle: { color: theme.text, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  fill: { ...StyleSheet.absoluteFill },
  transcript: { position: 'absolute', left: metrics.gutter, right: metrics.gutter },
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    experimental_backgroundImage: [{ type: 'linear-gradient', colorStops: FADE }],
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
    experimental_backgroundImage: [
      { type: 'linear-gradient', direction: 'to top', colorStops: FADE },
    ],
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
  agent: { position: 'absolute', left: metrics.gutter, right: metrics.gutter, height: AGENT_ROW },
  backToCall: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.switchOn },
  backText: { color: theme.switchOn, fontSize: 13, lineHeight: 18, fontWeight: '500' },
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
