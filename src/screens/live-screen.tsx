import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
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
import { CallControls } from '@/components/call-controls';
import { CallTranscript } from '@/components/call-transcript';
import { CallsSidebar } from '@/components/calls-sidebar';
import { PastCallBar } from '@/components/past-call-bar';
import { Persona, type PersonaState } from '@/components/persona';
import { ScreenToolbar } from '@/components/screen-toolbar';
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
import { useAppUpdates } from '@/hooks/use-app-updates';
import { useCall, useCalls } from '@/hooks/use-calls';
import { useTaskCounts } from '@/hooks/use-tasks';
import { useLiveSession } from '@/hooks/use-live-session';
import { usePhoneCall } from '@/hooks/use-phone-call';
import { useWrapUp } from '@/hooks/use-wrap-up';
import { usePersonaPreference } from '@/hooks/use-persona-preference';
import { useVoicePreference } from '@/hooks/use-voice-preference';
import { useVoiceTone } from '@/hooks/use-voice-tone';
import { activityOrb } from '@/live/activity-orb';
import { asksAPI, tasksAPI } from '@/live/api';
import type { TaskRow } from '@/live/tasks';
import { ENDINGS, callLength, transcriptText, type CallSummary } from '@/live/calls';
import { heard, motion } from '@/motion';
import { CONTROLS, screenLayout } from '@/screens/layout';
import { orbRest } from '@/screens/orb-rest';
import { theme } from '@/theme';
import { PoseView, type Pose } from '../../modules/pose';

const COMMIT = 0.35;
const FLICK = 500;
const RUBBER_BAND = 44;
const LANDED = 2;
const AGENT_ROW = 22;

// The screen lays itself out for the device's pose, so it waits for the first one. A phone stays
// upright as it always has; iPad and iPhone Duo turn to fit however they're held.
export default function LiveScreen() {
  const [pose, setPose] = useState<Pose | undefined>(PoseView ? undefined : { regular: false });
  const pad = Platform.OS === 'ios' && Platform.isPad;
  const upright = pose && !pad && !pose.bar && !pose.fold;
  useEffect(() => {
    if (upright === undefined) return;
    void (upright
      ? ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
      : ScreenOrientation.unlockAsync());
  }, [upright]);
  return (
    <View style={styles.root}>
      {PoseView && (
        <PoseView
          style={StyleSheet.absoluteFill}
          onPoseChange={({ nativeEvent: { regular, bar, fold, occlusions } }) =>
            setPose({ regular, bar, fold, occlusions })
          }
        />
      )}
      {pose && <CallScreen pose={pose} />}
    </View>
  );
}

function CallScreen({ pose }: { pose: Pose }) {
  const session = useLiveSession();
  const { voice, setVoice, loaded: voiceLoaded } = useVoicePreference();
  const { variant, setVariant, loaded: personaLoaded } = usePersonaPreference();
  const preferences = useCallPreferences();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [tasksAt, setTasksAt] = useState<string>();
  const counts = useTaskCounts();
  const calls = useCalls(drawerOpen);
  const phoneCall = usePhoneCall(calls.live, calls.calls);
  const [viewing, setViewing] = useState<string | null>(null);
  const shown = viewing ? calls.calls?.find((call) => call.id === viewing) : undefined;
  const past = useCall(shown);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const layout = screenLayout({ width, height }, insets, pose);
  const { orb, words, besideList, calls: list } = layout;
  const split = layout.kind === 'split';
  const [reading, setReading] = useState(layout.reading);
  const [captionsOn, setCaptionsOn] = useState(layout.reading);
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
  useAppUpdates(!asleep);
  const { line: agent, cards } = useAgentLine(connected, preferences.haptics);
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

  const size = orb.size;
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

  // The footer (how the call ended, hex's wrap-up, and on the phone the call buttons) is measured,
  // and what sits above it (the resting orb, or the words) keeps clear of it. On a call Tasks opens
  // half height over a compact screen, and the resting orb keeps clear of it too, still listening.
  // Where the words have a page of their own, the footer sits on that page, away from the orb.
  const [footer, setFooter] = useState(
    layout.footer.bottom + (layout.controls === 'inline' ? CONTROLS : 0),
  );
  const rest = orbRest(
    {
      top: orb.room.top,
      bottom: Math.min(
        split ? orb.room.bottom : height - footer,
        tasksOpen && voiceLocked && !pose.regular ? height / 2 : height,
      ),
    },
    orb.rest.y,
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
  const travel = orb.read.y - rest.y;
  const reach = Math.hypot(orb.read.x - orb.rest.x, travel);
  const progress = useSharedValue(layout.reading ? 1 : 0);
  const goal = useSharedValue(layout.reading ? 1 : 0);
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

  // Turning the device into another arrangement shows the words where that arrangement starts
  // them: on their own page, or behind the orb's pull-down on the phone.
  const kind = useRef(layout.kind);
  useEffect(() => {
    if (kind.current === layout.kind) return;
    kind.current = layout.kind;
    goal.set(layout.reading ? 1 : 0);
    progress.set(withTiming(layout.reading ? 1 : 0, motion.reduced));
    setReading(layout.reading);
  }, [layout.kind, layout.reading, goal, progress]);

  // Only the phone's arrangement pulls the words down over the orb; elsewhere they have a page.
  const pulls = layout.kind === 'single';
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
  const screenDrag = drag()
    .enabled(pulls && !reading)
    .failOffsetX([-20, 20]);
  // Tapping the orb comes back to it: from the words on the phone, from a past call beside it.
  const orbGesture = Gesture.Race(
    drag().enabled(pulls && reading),
    Gesture.Tap()
      .enabled(pulls ? reading : viewing !== null)
      .onEnd(() => {
        'worklet';
        if (!pulls) {
          scheduleOnRN(setViewing, null);
          return;
        }
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
        : withSpring(open ? 1 : 0, { ...motion.drawer, velocity: velocity / list.width }),
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
        drawer.set(Math.min(1, Math.max(0, drawerFrom.get() + translationX / list.width)));
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
  const toggleDrawer = () => {
    tick();
    settleDrawer(!drawerOpen);
  };
  // Side by side, the list stays open beside the call you picked; otherwise it steps aside for it.
  const openCall = (call: CallSummary) => {
    if (!split) settleDrawer(false);
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
    const d = list.over ? 0 : drawer.get();
    return {
      transform: [{ translateX: d * list.width }],
      borderRadius: 44 * Math.min(1, d * 4),
      borderWidth: d > 0 ? StyleSheet.hairlineWidth : 0,
    };
  });
  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (drawer.get() - 1) * (list.over ? list.width : 48) }],
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: drawer.get() }));
  // Over a full-width screen the list covers the toolbar's leading end, so the toolbar makes way.
  const makesWay = list.over && layout.toolbar.axis === 'row';
  const toolbarStyle = useAnimatedStyle(() => ({
    left: layout.toolbar.x + (makesWay ? drawer.get() * list.width : 0),
  }));
  const besideStyle = useAnimatedStyle(() => {
    const d = list.over ? drawer.get() : 0;
    return {
      left: words.x + (besideList.x - words.x) * d,
      width: words.width + (besideList.width - words.width) * d,
    };
  });

  const toggleReading = () => {
    const target = goal.get() === 0 ? 1 : 0;
    animateTo(target);
    setReading(target === 1);
  };

  useAnimatedReaction(
    () => progress.get(),
    (now) => {
      const target = landing.get();
      if (target >= 0 && Math.abs(now - target) * reach <= LANDED) {
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

  // The orb glides from where it rests to where it reads: docked small in the corner on the phone,
  // at full size on its own page beside the words. Side by side, the list covers it.
  const orbStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const t = reducedMotion ? (p < 0.5 ? 0 : 1) : p;
    const arc = t <= 0 ? 0 : t <= 1 ? t * t : 2 * t - 1;
    const awake = wake.get();
    const resting = size * (0.86 + 0.14 * awake);
    const fitted = resting * restScale.get();
    const visual = (fitted + ((orb.read.size ?? fitted) - fitted) * t) * (1 + 0.025 * breath.get());
    const y = restY.get();
    return {
      opacity:
        Math.min(1, 0.5 + 0.5 * awake + 0.1 * breath.get()) *
        (reducedMotion ? Math.abs(2 * p - 1) : 1) *
        (split ? 1 - drawer.get() : 1),
      transform: [
        { translateX: orb.rest.x - size / 2 + (orb.read.x - orb.rest.x) * arc },
        { translateY: y - size / 2 + (orb.read.y - y) * t },
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
        animateTo(layout.reading ? 1 : 0);
        setReading(layout.reading);
        setViewing(null);
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
  const onMute = () => {
    haptic(Haptics.selectionAsync);
    session.toggleMute();
  };
  const openTasks = (task?: string) => {
    tick();
    setTasksAt(task);
    setTasksOpen(true);
  };
  // Talk it through: on a call, the voice brings the task up; before one, it starts a call about it.
  const talkAbout = (task: TaskRow) => {
    setTasksOpen(false);
    if (voiceLocked) void tasksAPI.talk(task.id).catch(() => {});
    else if (voiceLoaded) startCall(task.id);
  };
  const removeShown =
    shown && shown.id !== calls.live
      ? () => {
          setReading(layout.reading);
          animateTo(layout.reading ? 1 : 0);
          setViewing(null);
          calls.remove(shown.id);
        }
      : undefined;

  // Go through them with hex: on a call, hex starts walking your asks; before one, it starts a call for it.
  const goThrough = () => {
    setTasksOpen(false);
    if (voiceLocked) void asksAPI.talk().catch(() => {});
    else if (voiceLoaded) startCall('asks');
  };

  const ending = session.ending && !voiceLocked && !viewing ? ENDINGS[session.ending] : undefined;
  const wrapUp = useWrapUp(session.callId, !!ending && session.ending !== 'no-connect');
  const controls = (
    <CallControls
      status={session.status}
      muted={session.muted}
      failed={!!session.error}
      ready={voiceLoaded}
      axis={layout.controls === 'inline' ? 'row' : layout.controls.axis}
      style={
        layout.controls === 'inline'
          ? undefined
          : { position: 'absolute', right: layout.controls.right, bottom: layout.controls.bottom }
      }
      onMute={onMute}
      onPrimary={onPrimaryPress}
    />
  );
  const toolbarPlace = {
    top: layout.toolbar.y,
    right: width - layout.toolbar.x - layout.toolbar.width,
  };
  const sidebar = (
    <GestureDetector gesture={sidebarClose}>
      <Animated.View
        style={[styles.sidebar, { left: layout.content.x, width: list.width }, sidebarStyle]}
      >
        <CallsSidebar
          top={insets.top}
          width={list.width}
          calls={calls.calls}
          live={calls.live}
          viewing={viewing}
          offline={calls.offline}
          haptics={preferences.haptics}
          onOpen={openCall}
          onDelete={(id) => {
            if (id === viewing) setReading(layout.reading);
            calls.remove(id);
          }}
        />
      </Animated.View>
    </GestureDetector>
  );

  return (
    <>
      {!list.over && sidebar}
      <Animated.View style={[styles.screen, screenStyle]}>
        <GestureDetector gesture={screenDrag}>
          <View style={styles.fill}>
            <Animated.View
              pointerEvents={reading ? 'auto' : 'none'}
              accessibilityElementsHidden={!reading}
              importantForAccessibility={reading ? 'auto' : 'no-hide-descendants'}
              style={[styles.transcript, { top: words.top }, besideStyle, transcriptStyle]}
            >
              {shown ? (
                <CallTranscript
                  summary={shown}
                  call={past.call}
                  failed={past.failed}
                  live={shown.id === calls.live}
                />
              ) : (
                <Transcript
                  entries={session.transcript}
                  active={reading}
                  cards={cards}
                  onAnswer={(card, option) =>
                    void asksAPI.answer(card.ask.id, option.label).catch(() => {})
                  }
                  onOpenTask={openTasks}
                />
              )}
              <View pointerEvents="none" style={styles.fade} />
              <View pointerEvents="none" style={styles.fadeBottom} />
            </Animated.View>
            <GestureDetector gesture={orbGesture}>
              <Animated.View
                accessible
                accessibilityLabel={status}
                style={[styles.orb, { width: size, height: size }, orbStyle]}
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
        {shown && layout.toolbar.axis === 'row' ? (
          <PastCallBar
            call={shown}
            live={shown.id === calls.live}
            onCall={voiceLocked}
            transcript={past.call && transcriptText(past.call)}
            leading={
              <VoiceControl
                icon="calls"
                label="Calls"
                testID="calls-button"
                selected={drawerOpen}
                onPress={toggleDrawer}
              />
            }
            style={[toolbarPlace, toolbarStyle]}
            onBack={backToCall}
            onDelete={removeShown}
          />
        ) : (
          <ScreenToolbar
            axis={layout.toolbar.axis}
            style={[toolbarPlace, toolbarStyle]}
            reading={captionsOn}
            callsOpen={drawerOpen}
            tasks={{ ...counts, open: tasksOpen }}
            onReading={toggleReading}
            onCalls={toggleDrawer}
            onTasks={() => openTasks()}
            onSettings={() => setSettingsOpen(true)}
          />
        )}
        {shown && layout.toolbar.axis === 'column' && (
          <PastCallBar
            call={shown}
            live={shown.id === calls.live}
            onCall={voiceLocked}
            transcript={past.call && transcriptText(past.call)}
            style={[{ top: insets.top + 8 }, besideStyle]}
            onBack={backToCall}
            onDelete={removeShown}
          />
        )}
        <View
          pointerEvents="box-none"
          onLayout={({ nativeEvent }) => setFooter(nativeEvent.layout.height)}
          style={[
            styles.footer,
            {
              left: layout.footer.x,
              width: layout.footer.width,
              paddingBottom: layout.footer.bottom,
            },
          ]}
        >
          {ending && wrapUp && (wrapUp.title || wrapUp.summary || wrapUp.waiting?.length) ? (
            <Animated.View
              entering={FadeIn.duration(motion.toolbar)}
              style={[styles.wrapUp, split && styles.leading]}
            >
              {wrapUp.title && (
                <Text numberOfLines={1} style={styles.wrapTitle}>
                  {wrapUp.title}
                </Text>
              )}
              <WrapUp
                center={!split}
                summary={wrapUp.summary}
                waiting={wrapUp.waiting?.slice(0, 3)}
              />
            </Animated.View>
          ) : null}
          {ending ? (
            <Text
              accessibilityRole="alert"
              style={[styles.ended, split && styles.leadingText, ending.bad && styles.bad]}
            >
              {session.ending === 'no-connect'
                ? ending.line
                : `${ending.line} · ${callLength(session.elapsedSeconds)}`}
            </Text>
          ) : session.interrupted ? (
            <Text accessibilityRole="alert" style={[styles.ended, split && styles.leadingText]}>
              Paused while your phone has the audio
            </Text>
          ) : (
            session.error && (
              <Text accessibilityRole="alert" style={[styles.error, split && styles.leadingText]}>
                {session.error}
              </Text>
            )
          )}
          {layout.controls === 'inline' && controls}
        </View>
        {layout.controls !== 'inline' && controls}
        <Pressable
          pointerEvents={agent ? 'auto' : 'none'}
          onPress={() => openTasks()}
          accessibilityRole="button"
          accessibilityHint="Opens Tasks"
          hitSlop={{ top: 8, bottom: 12 }}
          style={[
            styles.agent,
            { left: layout.agent.x, width: layout.agent.width, bottom: layout.agent.bottom },
          ]}
        >
          <AgentLine line={agent} />
        </Pressable>
        <TasksSheet
          isPresented={tasksOpen}
          onDismiss={() => setTasksOpen(false)}
          onCall={voiceLocked}
          haptics={preferences.haptics}
          onTalk={talkAbout}
          onGoThrough={goThrough}
          task={tasksAt}
        />
        <VoiceSettings
          fit={split ? 'beside' : pose.regular ? 'centered' : 'phone'}
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
            <View style={[styles.edge, { left: layout.content.x }]} />
          </GestureDetector>
        )}
        {list.over && !split && (
          <Animated.View
            pointerEvents="none"
            style={[styles.dim, { left: layout.content.x, width: layout.content.width }, dimStyle]}
          />
        )}
        {drawerOpen && !split && (
          <GestureDetector gesture={peekClose}>
            <View
              accessibilityLabel="Close calls"
              style={[styles.fill, { left: layout.content.x, width: layout.content.width }]}
            />
          </GestureDetector>
        )}
      </Animated.View>
      {list.over && sidebar}
    </>
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
  sidebar: { position: 'absolute', top: 0, bottom: 0 },
  edge: { position: 'absolute', top: 0, bottom: 0, width: 20 },
  dim: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  ended: { color: theme.secondary, textAlign: 'center', fontSize: 15, lineHeight: 20 },
  bad: { color: theme.danger },
  wrapUp: { gap: 10, alignItems: 'center' },
  leading: { alignItems: 'flex-start' },
  leadingText: { textAlign: 'left', paddingHorizontal: 0 },
  wrapTitle: { color: theme.text, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  fill: { ...StyleSheet.absoluteFill },
  transcript: { position: 'absolute' },
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
  orb: { position: 'absolute', left: 0, top: 0 },
  footer: { position: 'absolute', bottom: 0, gap: 22 },
  agent: { position: 'absolute', height: AGENT_ROW },
  error: {
    color: theme.danger,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
});
