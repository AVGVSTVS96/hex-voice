import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { TasksPane } from '@/components/tasks-pane';
import { TasksSheet } from '@/components/tasks-sheet';
import type { TasksAt } from '@/components/tasks/tasks-view';
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
import { useCallElsewhere } from '@/hooks/use-call-elsewhere';
import { useTaskCounts } from '@/hooks/use-tasks';
import { useLiveSession } from '@/hooks/use-live-session';
import { useWrapUp } from '@/hooks/use-wrap-up';
import { usePersonaPreference } from '@/hooks/use-persona-preference';
import { useVoicePreference } from '@/hooks/use-voice-preference';
import { useVoiceTone } from '@/hooks/use-voice-tone';
import { activityOrb } from '@/live/activity-orb';
import { asksAPI, tasksAPI } from '@/live/api';
import type { TaskRow } from '@/live/tasks';
import {
  ENDINGS,
  SOURCES,
  callLength,
  endedSeconds,
  liveEntries,
  transcriptText,
  type CallSummary,
} from '@/live/calls';
import { heard, motion } from '@/motion';
import { CONTROLS, DOCK, DOCKED, TOOL, screenLayout } from '@/screens/layout';
import { orbRest } from '@/screens/orb-rest';
import { theme } from '@/theme';
import { PoseView, type Pose } from '../../modules/pose';

const COMMIT = 0.35;
const FLICK = 500;
const RUBBER_BAND = 44;
const LANDED = 2;
const AGENT_ROW = 22;
const CONTROLS_BOX = 200;
const PAD = Platform.OS === 'ios' && Platform.isPad;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// The screen lays itself out for the device's pose, so it waits for the first one. A phone stays
// upright as it always has; iPad and iPhone Duo turn to fit however they're held.
export default function LiveScreen() {
  const [pose, setPose] = useState<Pose | undefined>(PoseView ? undefined : { regular: false });
  const upright = pose && !PAD && !pose.bar && !pose.fold;
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
  const [tasksAt, setTasksAt] = useState<TasksAt>({});
  const counts = useTaskCounts();
  const calls = useCalls(drawerOpen);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const layout = screenLayout({ width, height }, insets, pose);
  const { orb, words, besideCalls, besideTasks, calls: list, tasks: side, lift } = layout;
  const split = layout.kind === 'split';
  // Where the call moves with the room a pane leaves (iPad), and iPhone Duo's open pages: the
  // footer and agent line follow the words there instead of spanning the screen.
  const moves = split || !!orb.dock;
  // What the words show, in one place. Where the layout pulls the words down over the orb, they
  // show once pulled; everywhere else they always show. Opening a past call pulls them, and letting
  // them go goes back to the live call, so the two never disagree.
  const [showing, setShowing] = useState<{ pulled: boolean; call: string | null }>({
    pulled: false,
    call: null,
  });
  const reading = !layout.pulls || showing.pulled;
  const viewing = showing.call;
  const pullWords = (pulled: boolean) =>
    setShowing((now) => (pulled ? { ...now, pulled } : { pulled, call: null }));
  const showCall = (call: string | null) =>
    setShowing((now) => ({ pulled: now.pulled || call !== null, call }));
  const shown = viewing ? calls.calls?.find((call) => call.id === viewing) : undefined;
  const past = useCall(shown);
  // On iPad, Tasks is a pane like Calls, and one of the two is open at a time.
  const panes = side.place !== 'sheet';
  const reducedMotion = useReducedMotion();
  const connected = session.status === 'connected';
  const connecting = session.status === 'connecting';
  const disconnecting = session.status === 'disconnecting';
  const voiceLocked = connecting || connected || disconnecting;
  const { call: hexCall, line: agent, cards } = useAgentLine(preferences.haptics);
  // A call hex holds that this app isn't on (a phone call, the web page) shows here as a call too:
  // its words, its agents and asks, and Tasks talking to it, with End hanging it up.
  const elsewhere = useCallElsewhere(
    hexCall && !voiceLocked && hexCall !== session.callId ? hexCall : undefined,
    voiceLocked,
  );
  const away = elsewhere.call;
  const onCall = voiceLocked || elsewhere.live;
  const awake = connected || (elsewhere.live && !elsewhere.leaving);
  // Before a call on a wide iPad, Tasks takes the screen as a two-column inbox and the call waits
  // in a rail; once a call starts, Tasks narrows to its pane beside it.
  const inbox = layout.inbox && !onCall ? layout.inbox : undefined;
  const inboxShown = !!inbox && tasksOpen;
  const asleep = !awake && !connecting && !disconnecting && !elsewhere.leaving;
  const speaking = connected && session.outputLevel > 0.035;
  const personaState: PersonaState =
    connecting || disconnecting || elsewhere.leaving
      ? 'thinking'
      : speaking
        ? 'speaking'
        : awake && !(connected && session.muted)
          ? 'listening'
          : 'idle';
  const status = connecting
    ? 'Connecting'
    : disconnecting || elsewhere.leaving
      ? 'Ending conversation'
      : connected
        ? session.muted
          ? 'Microphone muted'
          : 'Conversation active'
        : elsewhere.live && away
          ? `${SOURCES[away.from].started}, ${SOURCES[away.from].where.toLowerCase()}`
          : 'Ready to start a conversation';

  useCallFeedback(session.status, preferences);
  useAppUpdates(onCall);
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
    const target = awake ? 1 : asleep ? 0 : 0.5;
    if (reducedMotion) {
      wake.set(target);
      breath.set(0);
      return;
    }
    wake.set(
      awake
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
  }, [awake, asleep, reducedMotion, wake, breath]);
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
        moves ? orb.room.bottom : height - footer,
        tasksOpen && onCall && !pose.regular ? height / 2 : height,
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
  const progress = useSharedValue(reading ? 1 : 0);
  const goal = useSharedValue(reading ? 1 : 0);
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

  // The orb and the words follow what shows: a drag or a tap has already sent them on their way, so
  // this only moves them when something else changed it, like turning the device or opening a call.
  useEffect(() => {
    const target = reading ? 1 : 0;
    if (goal.get() !== target) animateTo(target);
  }, [reading]);

  const pulls = layout.pulls;
  const transcriptButton = pulls;
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
        scheduleOnRN(pullWords, target === 1);
      });
  const screenDrag = drag()
    .enabled(pulls && !reading)
    .failOffsetX([-20, 20]);
  // On the phone the transcript button waits where the orb docks, and tapping it sends the orb down
  // into its place. Tapping the orb comes back to it: from the words on the phone, from a past call
  // beside it.
  const orbGesture = Gesture.Race(
    drag().enabled(pulls && reading),
    Gesture.Tap()
      .enabled(pulls ? reading : viewing !== null)
      .onEnd(() => {
        'worklet';
        if (!pulls) {
          scheduleOnRN(showCall, null);
          return;
        }
        animateTo(0);
        scheduleOnRN(pullWords, false);
      }),
  );

  const drawer = useSharedValue(0);
  const drawerFrom = useSharedValue(0);
  const onDrawer = (open: boolean) => {
    setDrawerOpen(open);
    if (open && panes) setTasksOpen(false);
  };
  const settleDrawer = (open: boolean, velocity = 0) => {
    'worklet';
    drawer.set(
      reducedMotion
        ? withTiming(open ? 1 : 0, motion.reduced)
        : withSpring(open ? 1 : 0, { ...motion.drawer, velocity: velocity / list.width }),
    );
    scheduleOnRN(onDrawer, open);
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
    if (list.place !== 'beside') settleDrawer(false);
    if (call.id === calls.live && onCall) return backToCall();
    showCall(call.id);
  };
  // A past call opened mid-call only changes what's on screen; the live call goes on underneath.
  const backToCall = () => {
    tick();
    showCall(null);
  };
  const leaveCall = () => setShowing({ pulled: false, call: null });

  const pane = useSharedValue(0);
  const paneWidth = inbox ? inbox.width : side.width;
  const paneW = useSharedValue(paneWidth);
  const wide = useSharedValue(inbox ? 1 : 0);
  useEffect(() => {
    if (!panes) return;
    const settle = (to: number) =>
      reducedMotion ? withTiming(to, motion.reduced) : withSpring(to, motion.drawer);
    // A pane that opens from closed takes its width at once; one already open moves to it.
    if (tasksOpen) {
      const closed = pane.get() < 0.01;
      paneW.set(closed ? paneWidth : settle(paneWidth));
      wide.set(closed ? (inbox ? 1 : 0) : settle(inbox ? 1 : 0));
    }
    pane.set(settle(tasksOpen ? 1 : 0));
  }, [tasksOpen, panes, paneWidth, !!inbox, reducedMotion, pane, paneW, wide]);
  // The call is a card. Calls and Tasks either slide it aside or take an edge of it, and while
  // either is open its corners round off against them. Where they take an edge, what's on the call
  // stays put in the window, so only the words move over into what's left.
  const cardStyle = useAnimatedStyle(() => {
    const d = drawer.get();
    const t = pane.get();
    const open = Math.max(list.place === 'over' ? 0 : d, side.place === 'sheet' ? 0 : t);
    return {
      left: list.place === 'beside' ? d * list.width : 0,
      right: side.place === 'beside' ? t * paneW.get() : 0,
      transform: [
        {
          translateX:
            (list.place === 'slide' ? d * list.width : 0) -
            (side.place === 'slide' ? t * side.width : 0),
        },
      ],
      borderRadius: 44 * Math.min(1, open * 4),
      borderWidth: open > 0 ? StyleSheet.hairlineWidth : 0,
    };
  });
  const stageStyle = useAnimatedStyle(() => ({
    left: list.place === 'beside' ? -drawer.get() * list.width : 0,
  }));
  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (drawer.get() - 1) * (list.place === 'over' ? list.width : 48) }],
  }));
  // A closing pane fades on its way out, so the inbox's width never shows past Calls coming in.
  const paneStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pane.get() * 4),
    transform: [{ translateX: (1 - pane.get()) * 48 }],
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: drawer.get() }));
  // Over a full-width screen the list covers the toolbar's leading end, so the toolbar makes way.
  const makesWay = list.place === 'over' && layout.toolbar.axis === 'row';
  const toolbar = inboxShown ? layout.inbox!.toolbar : layout.toolbar;
  const toolbarStyle = useAnimatedStyle(() => ({
    left: toolbar.x + (makesWay ? drawer.get() * list.width : 0),
  }));
  // How far Calls and Tasks have each come in beside the call; in the inbox the call's words make
  // way for the rail. Each style reads drawer and pane itself and hands them in: Reanimated reruns a
  // style only for the shared values it reads directly, not ones a helper worklet reads for it.
  const besideness = (drawn: number, paned: number) => {
    'worklet';
    return {
      d: list.place === 'slide' ? 0 : drawn,
      t: side.place === 'beside' ? paned : 0,
    };
  };
  const toward = (open: number, calls: number, tasks: number, d: number, t: number) => {
    'worklet';
    return open + (calls - open) * d + (tasks - open) * t;
  };
  const columnStyle = useAnimatedStyle(() => {
    const { d, t } = besideness(drawer.get(), pane.get());
    return {
      left: toward(words.x, besideCalls.x, besideTasks.x, d, t),
      width: toward(words.width, besideCalls.width, besideTasks.width, d, t),
      opacity: 1 - wide.get() * t,
      transform: [{ translateY: -(lift.calls * d + lift.tasks * t) }],
    };
  });
  const wordsStyle = useAnimatedStyle(() => {
    const { d, t } = besideness(drawer.get(), pane.get());
    return {
      top: toward(words.top, besideCalls.top, besideTasks.top, d, t),
      left: toward(words.x, besideCalls.x, besideTasks.x, d, t),
      width: toward(words.width, besideCalls.width, besideTasks.width, d, t),
    };
  });
  const controlsAt =
    layout.controls !== 'inline' && 'center' in layout.controls
      ? layout.controls.center
      : undefined;
  const controlsColumn =
    layout.controls !== 'inline' && 'axis' in layout.controls ? layout.controls : undefined;
  const rail = layout.inbox;
  const controlsStyle = useAnimatedStyle(() => {
    if (!controlsAt) return {};
    const { d, t } = besideness(drawer.get(), pane.get());
    const w = rail ? wide.get() : 0;
    const tasksX = controlsAt.tasks.x + ((rail?.controls.x ?? 0) - controlsAt.tasks.x) * w;
    const tasksY = controlsAt.tasks.y + ((rail?.controls.y ?? 0) - controlsAt.tasks.y) * w;
    return {
      left: toward(controlsAt.open.x, controlsAt.calls.x, tasksX, d, t) - CONTROLS_BOX / 2,
      top: toward(controlsAt.open.y, controlsAt.calls.y, tasksY, d, t) - CONTROLS / 2,
    };
  });

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

  // The orb glides from where it rests to where it reads: docked small in the corner on the phone,
  // at full size on its own page beside the words. Side by side, the list covers it.
  const orbStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const t = reducedMotion ? (p < 0.5 ? 0 : 1) : p;
    const arc = t <= 0 ? 0 : t <= 1 ? t * t : 2 * t - 1;
    const awake = wake.get();
    const resting = size * (0.86 + 0.14 * awake);
    const fitted = resting * restScale.get();
    const y = restY.get();
    let visual = fitted + ((orb.read.size ?? fitted) - fitted) * t;
    let x = orb.rest.x + (orb.read.x - orb.rest.x) * arc;
    let at = y + (orb.read.y - y) * t;
    if (orb.dock) {
      const beside = besideness(drawer.get(), pane.get());
      const w = rail ? wide.get() : 0;
      const tasks = {
        x: orb.dock.tasks.x + ((rail?.orb.x ?? 0) - orb.dock.tasks.x) * w,
        y: orb.dock.tasks.y + ((rail?.orb.y ?? 0) - orb.dock.tasks.y) * w,
        size: DOCK + ((rail?.orb.size ?? DOCK) - DOCK) * w,
      };
      x = toward(x, orb.dock.calls.x, tasks.x, beside.d, beside.t);
      at = toward(at, orb.dock.calls.y, tasks.y, beside.d, beside.t);
      visual = toward(visual, DOCK, tasks.size, beside.d, beside.t);
    }
    visual *= 1 + 0.025 * breath.get();
    return {
      opacity:
        Math.min(1, 0.5 + 0.5 * awake + 0.1 * breath.get()) *
        (reducedMotion ? Math.abs(2 * p - 1) : 1) *
        (split && !orb.dock ? 1 - Math.max(drawer.get(), pane.get()) : 1),
      transform: [
        { translateX: x - size / 2 },
        { translateY: at - size / 2 },
        { scale: visual / size },
        ...heard(reaction, size, level.get(), pitch.get(), tone.get()),
      ],
    };
  });
  const dockStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0.6, 1], [1, 0], Extrapolation.CLAMP),
  }));
  const transcriptStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const shown = reducedMotion
      ? Math.min(1, Math.max(0, p))
      : interpolate(p, [0.12, 0.72], [0, 1], Extrapolation.CLAMP);
    const { d, t } = besideness(drawer.get(), pane.get());
    return {
      bottom: footerHeight.get() + 18 + lift.calls * d + lift.tasks * t,
      opacity: shown * (1 - wide.get() * t),
      transform: [{ translateY: reducedMotion ? 0 : (shown - 1) * 28 }],
    };
  });

  const startCall = (about?: string) => {
    if (viewing) leaveCall();
    void session.start(voice, about);
  };
  const onPrimaryPress = () => {
    if (disconnecting || elsewhere.leaving || !voiceLoaded) return;
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    if (connected || connecting) void session.stop();
    else if (elsewhere.live) elsewhere.hangUp();
    else startCall();
  };
  const onMute = () => {
    haptic(Haptics.selectionAsync);
    session.toggleMute();
  };
  const openTasks = (at: TasksAt = {}) => {
    tick();
    setTasksAt(at);
    setTasksOpen(true);
    if (panes && drawerOpen) settleDrawer(false);
  };
  const toggleTasks = () => {
    if (!tasksOpen) return openTasks();
    tick();
    setTasksOpen(false);
  };
  // A sheet steps aside for the call it starts; a pane stays open beside it.
  const stepAside = () => {
    if (!panes) setTasksOpen(false);
  };
  // Talk it through: on a call, the voice brings the task up; before one, it starts a call about it.
  const talkAbout = (task: TaskRow) => {
    stepAside();
    if (onCall) void tasksAPI.talk(task.id).catch(() => {});
    else if (voiceLoaded) startCall(task.id);
  };
  const removeShown =
    shown && shown.id !== calls.live
      ? () => {
          leaveCall();
          calls.remove(shown.id);
        }
      : undefined;

  // Go through them with hex: on a call, hex starts walking your asks; before one, it starts a call for it.
  const goThrough = () => {
    stepAside();
    if (onCall) void asksAPI.talk().catch(() => {});
    else if (voiceLoaded) startCall('asks');
  };

  // How the last call ended, whichever it was: one held elsewhere only stays while it's the latest.
  const last = away
    ? { id: away.id, end: away.end ?? null, seconds: endedSeconds(away) }
    : { id: session.callId, end: session.ending, seconds: session.elapsedSeconds };
  const ending = last.end && !onCall && !viewing ? ENDINGS[last.end] : undefined;
  const wrapUp = useWrapUp(last.id, !!ending && last.end !== 'no-connect');
  const controls = (
    <CallControls
      status={elsewhere.live ? (elsewhere.leaving ? 'disconnecting' : 'connected') : session.status}
      canMute={!elsewhere.live}
      muted={session.muted}
      failed={!!session.error}
      ready={voiceLoaded}
      axis={controlsColumn?.axis ?? 'row'}
      mute={!inboxShown}
      style={
        controlsColumn && {
          position: 'absolute',
          right: controlsColumn.right,
          bottom: controlsColumn.bottom,
        }
      }
      onMute={onMute}
      onPrimary={onPrimaryPress}
    />
  );
  const toolbarPlace =
    toolbar.axis === 'row'
      ? { top: toolbar.y, right: width - toolbar.x - toolbar.width }
      : { top: toolbar.y };
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
            if (id === viewing) leaveCall();
            calls.remove(id);
          }}
        />
      </Animated.View>
    </GestureDetector>
  );

  const tasks = {
    open: tasksOpen,
    at: tasksAt,
    haptics: preferences.haptics,
    onTalk: talkAbout,
    onGoThrough: goThrough,
  };

  return (
    <>
      {list.place !== 'over' && sidebar}
      {panes && (
        <TasksPane
          {...tasks}
          top={insets.top}
          toolbar={layout.toolbar.y + TOOL / 2}
          width={paneWidth}
          style={paneStyle}
        />
      )}
      <Animated.View style={[styles.card, cardStyle]}>
        <Animated.View style={[styles.stage, { width }, stageStyle]}>
          <GestureDetector gesture={screenDrag}>
            <View style={styles.fill}>
              <Animated.View
                pointerEvents={reading ? 'auto' : 'none'}
                accessibilityElementsHidden={!reading}
                importantForAccessibility={reading ? 'auto' : 'no-hide-descendants'}
                style={[styles.transcript, wordsStyle, transcriptStyle]}
              >
                {shown && (
                  <PastCallBar
                    call={shown}
                    live={shown.id === calls.live}
                    onCall={onCall}
                    transcript={past.call && transcriptText(past.call)}
                    onBack={backToCall}
                    onDelete={removeShown}
                  />
                )}
                <View style={styles.words}>
                  {shown ? (
                    <CallTranscript
                      summary={shown}
                      call={past.call}
                      failed={past.failed}
                      live={shown.id === calls.live}
                    />
                  ) : (
                    <Transcript
                      entries={away ? liveEntries(away.turns) : session.transcript}
                      active={reading}
                      size={layout.text}
                      emptyAt={pulls ? 'end' : 'center'}
                      cards={cards}
                      onAnswer={(card, option) =>
                        void asksAPI.answer(card.ask.id, option.label).catch(() => {})
                      }
                      onOpenTask={(task) => openTasks({ task })}
                    />
                  )}
                  <View pointerEvents="none" style={styles.fade} />
                  <View pointerEvents="none" style={styles.fadeBottom} />
                </View>
              </Animated.View>
              {transcriptButton && (
                <Animated.View
                  pointerEvents={reading ? 'none' : 'auto'}
                  accessibilityElementsHidden={reading}
                  importantForAccessibility={reading ? 'no-hide-descendants' : 'auto'}
                  style={[
                    styles.dock,
                    { left: orb.read.x - DOCKED / 2, top: orb.read.y - DOCKED / 2 },
                    dockStyle,
                  ]}
                >
                  <VoiceControl
                    icon="transcript"
                    label="Show transcript"
                    testID="transcript-button"
                    size={DOCKED}
                    onPress={() => pullWords(true)}
                  />
                </Animated.View>
              )}
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
          <Animated.View
            pointerEvents="box-none"
            onLayout={({ nativeEvent }) => setFooter(nativeEvent.layout.height)}
            style={[
              styles.footer,
              { left: layout.footer.x, width: layout.footer.width },
              moves && columnStyle,
              { paddingBottom: layout.footer.bottom },
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
                {last.end === 'no-connect'
                  ? ending.line
                  : `${ending.line} · ${callLength(last.seconds)}`}
              </Text>
            ) : elsewhere.live && away ? (
              <Text style={[styles.ended, split && styles.leadingText]}>
                {`${SOURCES[away.from].where} · ${SOURCES[away.from].started}`}
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
          </Animated.View>
          <AnimatedPressable
            pointerEvents={agent ? 'auto' : 'none'}
            onPress={() => openTasks({ tab: 'working' })}
            accessibilityRole="button"
            accessibilityHint="Opens what hex is working on"
            hitSlop={{ top: 8, bottom: 12 }}
            style={[
              styles.agent,
              { left: layout.agent.x, width: layout.agent.width, bottom: layout.agent.bottom },
              moves && columnStyle,
            ]}
          >
            <AgentLine line={agent} />
          </AnimatedPressable>
          {controlsAt && (
            <Animated.View pointerEvents="box-none" style={[styles.controls, controlsStyle]}>
              {controls}
            </Animated.View>
          )}
        </Animated.View>
        <ScreenToolbar
          axis={toolbar.axis}
          style={[toolbarPlace, toolbarStyle]}
          callsOpen={drawerOpen}
          tasks={{ ...counts, open: tasksOpen }}
          onCalls={toggleDrawer}
          onTasks={toggleTasks}
          onSettings={() => setSettingsOpen(true)}
        />
        {controlsColumn && controls}
        {!panes && <TasksSheet {...tasks} onCall={onCall} onDismiss={() => setTasksOpen(false)} />}
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
        {list.place === 'over' && !split && (
          <Animated.View
            pointerEvents="none"
            style={[styles.dim, { left: layout.content.x, width: layout.content.width }, dimStyle]}
          />
        )}
        {drawerOpen && list.place !== 'beside' && (
          <GestureDetector gesture={peekClose}>
            <View
              accessibilityLabel="Close calls"
              style={[styles.fill, { left: layout.content.x, width: layout.content.width }]}
            />
          </GestureDetector>
        )}
        {tasksOpen && side.place === 'slide' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close tasks"
            onPress={toggleTasks}
            style={styles.fill}
          />
        )}
      </Animated.View>
      {list.place === 'over' && sidebar}
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
  card: {
    ...StyleSheet.absoluteFill,
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
  stage: { position: 'absolute', top: 0, bottom: 0 },
  transcript: { position: 'absolute' },
  words: { flex: 1 },
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
  dock: { position: 'absolute' },
  footer: { position: 'absolute', bottom: 0, gap: 22 },
  agent: { position: 'absolute', height: AGENT_ROW },
  controls: {
    position: 'absolute',
    width: CONTROLS_BOX,
    height: CONTROLS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: theme.danger,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
});
