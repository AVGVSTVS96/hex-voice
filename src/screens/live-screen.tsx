import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  Settings,
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
import { usePastCall, useCalls } from '@/hooks/use-calls';
import { useCallElsewhere } from '@/hooks/use-call-elsewhere';
import { failure } from '@/hooks/use-failures';
import { useNow } from '@/hooks/use-now';
import { answerAsk, raiseAsks } from '@/hooks/use-asks';
import { raiseTask, useTaskCounts } from '@/hooks/use-tasks';
import { useLiveSession } from '@/hooks/use-live-session';
import { usePersonaPreference } from '@/hooks/use-persona-preference';
import { useVoicePreference } from '@/hooks/use-voice-preference';
import { useVoiceTone } from '@/hooks/use-voice-tone';
import { activityOrb } from '@/live/activity-orb';
import type { TaskRow } from '@/live/tasks';
import type { CallAbout } from '@/live/types';
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
import { DuoTasks, uncovered, useDuoTasks } from '@/screens/duo-tasks';
import { CONTROLS, DOCKED, GAP, TOOL, screenLayout } from '@/screens/layout';
import { orbRest } from '@/screens/orb-rest';
import { metrics, radius, theme } from '@/theme';
import { PoseView, type Pose } from '../../modules/pose';

const COMMIT = 0.35;
const FLICK = 500;
const RUBBER_BAND = 44;
const LANDED = 2;
const AGENT_ROW = 22;
const CONTROLS_BOX = 200;
// The orb over the phone's half-height Tasks sheet: enough to say the call goes on.
const OVER_SHEET = 96;
const PAD = Platform.OS === 'ios' && Platform.isPad;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type Opening = {
  tasks?: TasksAt;
  open?: 'settings' | 'calls';
  demoCall: boolean;
  reportPose: boolean;
};

// The screen lays itself out for the device's pose and the size it's drawn at, so it waits for the
// first of each. The size is the screen's own, as laid out: React Native's window size can report
// another screen's for a moment while iPhone Duo unfolds, and the call screen would lay out for the
// cover across the open screen. A phone stays upright as it always has; iPad and iPhone Duo turn
// to fit however they're held.
export default function LiveScreen({ opening }: { opening: Opening }) {
  const [pose, setPose] = useState<Pose | undefined>(PoseView ? undefined : { regular: false });
  const [size, setSize] = useState<Size>();
  const upright = pose && !PAD && !pose.bar && !pose.fold;
  useEffect(() => {
    if (upright === undefined) return;
    void (upright
      ? ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
      : ScreenOrientation.unlockAsync());
  }, [upright]);
  return (
    <View
      style={styles.root}
      onLayout={({ nativeEvent: { layout } }) =>
        setSize((was) =>
          was?.width === layout.width && was.height === layout.height
            ? was
            : { width: layout.width, height: layout.height },
        )
      }
    >
      {PoseView && (
        <PoseView
          style={StyleSheet.absoluteFill}
          onPoseChange={({ nativeEvent: { regular, bar, fold, occlusions } }) =>
            setPose({ regular, bar, fold, occlusions })
          }
        />
      )}
      {pose && size && opening.reportPose && <PoseReport pose={pose} size={size} />}
      {pose && size && <CallScreen pose={pose} size={size} opening={opening} />}
    </View>
  );
}

// Writes the window, the size the screen lays out at, the safe area and the pose to the app's
// defaults (HexPose), where scripts/duo reads them, and the last moments of them with their times
// (HexPoseLog), so a check can see what changed between two shots.
function PoseReport({ pose, size }: { pose: Pose; size: Size }) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const log = useRef<object[]>([]);
  useEffect(() => {
    const now = { at: Date.now(), window, size, insets, pose };
    log.current = [...log.current.slice(-(LOGGED - 1)), now];
    Settings.set({ HexPose: JSON.stringify(now), HexPoseLog: JSON.stringify(log.current) });
  }, [window, size, insets, pose]);
  return null;
}

const LOGGED = 40;

type Size = { width: number; height: number };

function CallScreen({ pose, size: screen, opening }: { pose: Pose; size: Size; opening: Opening }) {
  const session = useLiveSession(opening.demoCall);
  const { voice, setVoice, loaded: voiceLoaded } = useVoicePreference();
  const { variant, setVariant, loaded: personaLoaded } = usePersonaPreference();
  const preferences = useCallPreferences();
  const [settingsOpen, setSettingsOpen] = useState(opening.open === 'settings');
  const [drawerOpen, setDrawerOpen] = useState(opening.open === 'calls');
  const [tasksOpen, setTasksOpen] = useState(opening.tasks !== undefined);
  const [tasksAt, setTasksAt] = useState<TasksAt>(opening.tasks ?? {});
  const counts = useTaskCounts();
  const insets = useSafeAreaInsets();
  const { width, height } = screen;
  const layout = screenLayout(screen, insets, pose);
  const { orb, words, besideCalls, besideTasks, calls: list, tasks: side, lift } = layout;
  const split = layout.kind === 'split';
  // Where the call moves with the room a pane leaves (iPad), and iPhone Duo's open pages: the
  // footer and agent line follow the words there instead of spanning the screen.
  const moves = split || !!orb.dock;
  // What the words show, in one place. Where the layout pulls the words down over the orb, they
  // show once pulled; everywhere else they take their own page once there's a call or words to show,
  // and before that the orb rests alone in the middle. Opening a past call pulls them, and letting
  // them go goes back to the live call, so the two never disagree.
  const [showing, setShowing] = useState<{ pulled: boolean; call: string | null }>({
    pulled: false,
    call: null,
  });
  const viewing = showing.call;
  const calls = useCalls();
  const pullWords = (pulled: boolean) =>
    setShowing((now) => (pulled ? { ...now, pulled } : { pulled, call: null }));
  const showCall = (call: string | null) =>
    setShowing((now) => ({ pulled: now.pulled || call !== null, call }));
  const shown = viewing ? calls.calls?.find((call) => call.id === viewing) : undefined;
  const past = usePastCall(shown?.id);
  // On iPad, Tasks is a pane like Calls, and one of the two is open at a time. On iPhone Duo it's a
  // place of its own over the call, and the call goes on in the bar.
  const panes = side.place !== 'sheet';
  const duo = layout.duo;
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
  const reading = layout.pulls
    ? showing.pulled
    : !!shown || onCall || !!away || session.transcript.length > 0 || cards.length > 0;
  const awake = connected || (elsewhere.live && !elsewhere.leaving);
  const duoTasks = useDuoTasks(duo, tasksOpen, onCall, reducedMotion);
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
  // and what sits above it (the resting orb, or the words) keeps clear of it; where the words have a
  // page of their own, the footer sits on that page, away from the orb. On a call Tasks opens half
  // height over a compact screen, and the resting orb keeps clear of it too, small, still listening.
  const [footer, setFooter] = useState(
    layout.footer.bottom + (layout.controls === 'inline' ? CONTROLS : 0),
  );
  const overSheet = tasksOpen && onCall && side.place === 'sheet';
  const rest = orbRest(
    {
      top: orb.room.top,
      bottom: Math.min(moves ? orb.room.bottom : height - footer, overSheet ? height / 2 : height),
    },
    orb.rest.y,
    size,
    overSheet ? OVER_SHEET : size,
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
  // With Tasks open on iPhone Duo during a call, the orb moves into the bar, small, still answering
  // the voice, with the call's time by it; tapping it closes Tasks for the call.
  const { docked, dock, covers, aside } = duoTasks;
  // Where the call's words and the lines under them go when they take the page before the fold.
  const before = duo?.beside?.words ?? { ...words, raise: 0 };
  const closeTasks = () => {
    tick();
    setTasksOpen(false);
  };
  const now = useNow(docked && !connected && !!away);
  const callSeconds = connected
    ? session.elapsedSeconds
    : away
      ? Math.max(0, Math.floor((now.getTime() - Date.parse(away.started)) / 1000))
      : 0;
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
    drag().enabled(pulls && reading && !docked),
    Gesture.Tap()
      .enabled(docked || (pulls ? reading : viewing !== null))
      .onEnd(() => {
        'worklet';
        if (docked) {
          scheduleOnRN(closeTasks);
          return;
        }
        if (!pulls) {
          scheduleOnRN(showCall, null);
          return;
        }
        animateTo(0);
        scheduleOnRN(pullWords, false);
      }),
  );

  const drawer = useSharedValue(drawerOpen ? 1 : 0);
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
  const openCall = (id: string) => {
    if (list.place !== 'beside') settleDrawer(false);
    if (id === calls.live && onCall) return backToCall();
    showCall(id);
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
  // The call is a card, and while a pane sits beside it its corners round off against that pane.
  // Calls always sits beside it, sliding it aside or taking its leading edge, and its top too where
  // Calls starts below a band, so the band stays whole over both; Tasks does where it takes its
  // trailing edge, and as a sheet or a page it covers the call instead, which leaves no edge to
  // round. Where a pane takes an edge, what's on the call stays put in the window, so only the words
  // move over into what's left. It moves by layout, never a transform, since it holds SwiftUI views.
  // A card that still reaches the screen's top and foot wears no hairline: there it would only line
  // the screen's edges, which reads as a 1px gap along the top and bottom of the app.
  const lined = list.place === 'slide' || list.below !== undefined;
  const cardStyle = useAnimatedStyle(() => {
    const d = drawer.get();
    const t = pane.get();
    const slid = list.place === 'slide' ? d * list.width : 0;
    const yielded = Math.min(1, Math.max(d, side.place === 'beside' ? t : 0) * 4);
    return {
      top: (list.below ?? 0) * d,
      left: (list.place === 'beside' ? d * list.width : 0) + slid,
      right: (side.place === 'beside' ? t * paneW.get() : 0) - slid,
      borderRadius: radius.card * yielded,
      borderWidth: lined && yielded > 0 ? StyleSheet.hairlineWidth : 0,
    };
  });
  const stageStyle = useAnimatedStyle(() => ({
    top: -(list.below ?? 0) * drawer.get(),
    left: list.place === 'beside' ? -drawer.get() * list.width : 0,
  }));
  const sidebarStyle = useAnimatedStyle(() => ({
    left: layout.content.x + (drawer.get() - 1) * 48,
  }));
  // A closing pane fades on its way out, so the inbox's width never shows past Calls coming in.
  const paneStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pane.get() * 4) }));
  // The bar sits in the window. A column down the side never moves. A bar along the top spans the
  // card's top edge: it rides a card that slides aside, and ends where a pane beside the card
  // begins, unless Calls starts below it, which leaves the band whole.
  const toolbar = inboxShown ? layout.inbox!.toolbar : layout.toolbar;
  // In iPhone Duo's side column the toolbar stays put, so it's placed outright; across the top it
  // moves with Calls and Tasks.
  const toolbarStyle = useAnimatedStyle(() => {
    const d = drawer.get();
    const slid = list.place === 'slide' ? d * list.width : 0;
    const calls = list.place === 'beside' && list.below === undefined ? d * list.width : 0;
    const tasks = side.place === 'beside' ? pane.get() * paneW.get() : 0;
    return {
      left: toolbar.x + calls + slid,
      right: width - toolbar.x - toolbar.width + tasks - slid,
    };
  });
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
    const a = aside.get();
    return {
      left: toward(words.x, besideCalls.x, besideTasks.x, d, t) + (before.x - words.x) * a,
      width:
        toward(words.width, besideCalls.width, besideTasks.width, d, t) +
        (before.width - words.width) * a,
      marginBottom: lift.calls * d + lift.tasks * t + before.raise * a,
    };
  });
  // The call's own lines make way for the iPad inbox, and for iPhone Duo's Tasks where it covers them.
  const linesStyle = useAnimatedStyle(() => {
    const { t } = besideness(drawer.get(), pane.get());
    return { opacity: (1 - wide.get() * t) * uncovered(covers.get()) };
  });
  const wordsStyle = useAnimatedStyle(() => {
    const { d, t } = besideness(drawer.get(), pane.get());
    const a = aside.get();
    return {
      top: toward(words.top, besideCalls.top, besideTasks.top, d, t) + (before.top - words.top) * a,
      left: toward(words.x, besideCalls.x, besideTasks.x, d, t) + (before.x - words.x) * a,
      width:
        toward(words.width, besideCalls.width, besideTasks.width, d, t) +
        (before.width - words.width) * a,
    };
  });
  // How far along its way from resting to reading the orb is (`t`), and its sideways share of that
  // (`arc`), which starts slow so it drops before it slides. What travels with it uses the same two.
  const glide = (p: number) => {
    'worklet';
    const t = reducedMotion ? (p < 0.5 ? 0 : 1) : p;
    return { t, arc: t <= 0 ? 0 : t <= 1 ? t * t : 2 * t - 1 };
  };
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
    const { rest, open } = controlsAt;
    const along = glide(progress.get());
    const x = rest.x + (open.x - rest.x) * Math.min(1, along.arc);
    const y = rest.y + (open.y - rest.y) * Math.min(1, Math.max(0, along.t));
    return {
      left: toward(x, controlsAt.calls.x, tasksX, d, t) - CONTROLS_BOX / 2,
      top: toward(y, controlsAt.calls.y, tasksY, d, t) - CONTROLS / 2,
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
  // at full size on its own page beside the words. On iPad it glides down beside the call buttons
  // as Calls or Tasks comes in. Side by side, the list covers it.
  const orbStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const { t, arc } = glide(p);
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
        size: orb.dock.tasks.size + ((rail?.orb.size ?? 0) - orb.dock.tasks.size) * w,
      };
      const room = orb.dock.calls;
      const read = orb.dock.read ?? room;
      const calls = {
        x: room.x + (read.x - room.x) * t,
        y: room.y + (read.y - room.y) * t,
        size: room.size + (read.size - room.size) * t,
      };
      x = toward(x, calls.x, tasks.x, beside.d, beside.t);
      at = toward(at, calls.y, tasks.y, beside.d, beside.t);
      visual = toward(visual, calls.size, tasks.size, beside.d, beside.t);
    }
    let shown = 1;
    if (duo) {
      const k = dock.get();
      const spot = duo.call.orb;
      x += (spot.x - x) * k;
      at += (spot.y - at) * k;
      visual += (spot.size - visual) * k;
      const under = uncovered(covers.get());
      shown = under + (1 - under) * k;
    }
    visual *= 1 + 0.025 * breath.get();
    return {
      opacity:
        Math.min(1, 0.5 + 0.5 * awake + 0.1 * breath.get()) *
        (reducedMotion ? Math.abs(2 * p - 1) : 1) *
        (split && !orb.dock ? 1 - drawer.get() : 1) *
        shown,
      transform: [
        { translateX: x - size / 2 },
        { translateY: at - size / 2 },
        { scale: visual / size },
        ...heard(reaction, size, level.get(), pitch.get(), tone.get()),
      ],
    };
  });
  const dockStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(progress.get(), [0.6, 1], [1, 0], Extrapolation.CLAMP) * uncovered(covers.get()),
  }));
  // iPhone Duo's Tasks lays one backdrop across the whole screen, the column and the fold too, and
  // the words' fades trade the call's color for the backdrop's as it comes in.
  const backdropStyle = useAnimatedStyle(() => ({ opacity: pane.get() }));
  const callColorStyle = useAnimatedStyle(() => ({ opacity: 1 - pane.get() }));
  const transcriptStyle = useAnimatedStyle(() => {
    const p = progress.get();
    const shown = reducedMotion
      ? Math.min(1, Math.max(0, p))
      : interpolate(p, [0.12, 0.72], [0, 1], Extrapolation.CLAMP);
    const { d, t } = besideness(drawer.get(), pane.get());
    return {
      bottom:
        footerHeight.get() + 18 + lift.calls * d + lift.tasks * t + before.raise * aside.get(),
      opacity: shown * (1 - wide.get() * t) * uncovered(covers.get()),
      transform: [{ translateY: reducedMotion ? 0 : (shown - 1) * 28 }],
    };
  });

  // What an action on a call couldn't do shows in the footer's error line while that call lasts.
  const callNow = voiceLocked
    ? (session.callId ?? undefined)
    : elsewhere.live
      ? away?.id
      : undefined;
  const [trouble, setTrouble] = useState<{ call?: string; why: string }>();
  const tried = (what: string, action: Promise<unknown>) => {
    const call = callNow;
    setTrouble(undefined);
    action.catch((error: unknown) => setTrouble({ call, why: failure(what, error) }));
  };
  const troubleNow = trouble && trouble.call === callNow ? trouble.why : undefined;
  const startCall = (about?: CallAbout) => {
    if (viewing) leaveCall();
    void session.start(voice, about);
  };
  const onPrimaryPress = () => {
    if (disconnecting || elsewhere.leaving || !voiceLoaded) return;
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    if (connected || connecting) void session.stop();
    else if (elsewhere.live) tried('Not ended', elsewhere.hangUp());
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
  const toggleTasks = () => (tasksOpen ? closeTasks() : openTasks());
  // A sheet steps aside for the call it starts; a pane stays open beside it.
  const stepAside = () => {
    if (!panes) setTasksOpen(false);
  };
  // Talk it through: on a call, the voice brings the task up; before one, it starts a call about it.
  const talkAbout = (task: TaskRow) => {
    stepAside();
    if (onCall) tried('Not sent', raiseTask(task.id));
    else if (voiceLoaded) startCall({ task: task.id });
  };
  // A call an ask was asked on opens from Tasks in Calls, the way picking it there does.
  const openCallFromTasks = (id: string) => {
    stepAside();
    if (list.place === 'beside') settleDrawer(true);
    openCall(id);
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
    if (onCall) tried('Not sent', raiseAsks());
    else if (voiceLoaded) startCall('asks');
  };

  // How the last call ended, whichever it was: one held elsewhere only stays while it's the latest.
  const last = away
    ? { id: away.id, end: away.end ?? null, seconds: endedSeconds(away) }
    : { id: session.callId, end: session.ending, seconds: session.elapsedSeconds };
  const ending = last.end && !onCall && !viewing ? ENDINGS[last.end] : undefined;
  const wrapUp = calls.calls?.find(({ id }) => id === last.id);
  const callControls = (place: Partial<Parameters<typeof CallControls>[0]>) => (
    <CallControls
      status={elsewhere.live ? (elsewhere.leaving ? 'disconnecting' : 'connected') : session.status}
      canMute={!elsewhere.live}
      muted={session.muted || session.interrupted}
      failed={!!session.error}
      ready={voiceLoaded}
      axis="row"
      mute={!inboxShown}
      onMute={onMute}
      onPrimary={onPrimaryPress}
      {...place}
    />
  );
  const controls = callControls(
    controlsColumn
      ? {
          axis: controlsColumn.axis,
          sizes: controlsColumn.sizes,
          style: {
            position: 'absolute',
            right: controlsColumn.right,
            bottom: controlsColumn.bottom,
          },
        }
      : {},
  );
  // Open on its side, the toolbar runs across the top and the call buttons sit in it, at one spot
  // whether Tasks is open or not.
  const inRow = !!duo?.call.controls;
  const sidebar = (
    <GestureDetector gesture={sidebarClose}>
      <Animated.View
        style={[styles.sidebar, { width: list.width, top: list.below ?? 0 }, sidebarStyle]}
      >
        <CallsSidebar
          top={list.below === undefined ? insets.top : 0}
          width={list.width}
          calls={calls.calls}
          live={calls.live}
          viewing={viewing}
          offline={calls.offline}
          haptics={preferences.haptics}
          onOpen={(call) => openCall(call.id)}
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
    onOpenCall: openCallFromTasks,
  };

  return (
    <>
      {sidebar}
      {panes && !duo && (
        <TasksPane
          {...tasks}
          top={insets.top}
          foot={insets.bottom}
          width={paneWidth}
          style={paneStyle}
        />
      )}
      <Animated.View style={[styles.card, cardStyle]}>
        {duo && (
          <Animated.View
            pointerEvents="none"
            style={[styles.fill, styles.backdrop, backdropStyle]}
          />
        )}
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
                      onAnswer={(card, option) => answerAsk(card.ask, option)}
                      onOpenTask={(task) => openTasks({ task })}
                    />
                  )}
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.fade, duo && callColorStyle]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.fadeBottom, duo && callColorStyle]}
                  />
                  {duo && (
                    <>
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.fade, styles.onBackdrop, backdropStyle]}
                      />
                      <Animated.View
                        pointerEvents="none"
                        style={[styles.fadeBottom, styles.onBackdropBottom, backdropStyle]}
                      />
                    </>
                  )}
                </View>
              </Animated.View>
              {pulls && (
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
                  accessibilityHint={docked ? 'Closes Tasks for the call' : undefined}
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
              (moves || duo?.beside) && columnStyle,
              linesStyle,
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
                  onOpen={last.id ? () => showCall(last.id!) : undefined}
                  summary={wrapUp.summary}
                  waiting={wrapUp.waiting}
                  onMore={() => openTasks({ stage: 'needs' })}
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
                Paused while another app has the audio
              </Text>
            ) : null}
            {troubleNow || (session.error && !away) ? (
              <Text accessibilityRole="alert" style={[styles.error, split && styles.leadingText]}>
                {troubleNow ?? session.error}
              </Text>
            ) : null}
            {layout.controls === 'inline' && !inRow && controls}
          </Animated.View>
          <AnimatedPressable
            pointerEvents={agent ? 'auto' : 'none'}
            accessibilityElementsHidden={!agent}
            importantForAccessibility={agent ? 'auto' : 'no-hide-descendants'}
            onPress={() => openTasks({ stage: 'working' })}
            accessibilityRole="button"
            accessibilityHint="Opens what hex is working on"
            hitSlop={{ top: 8, bottom: 12 }}
            style={[
              styles.agent,
              { left: layout.agent.x, width: layout.agent.width, bottom: layout.agent.bottom },
              (moves || duo?.beside) && columnStyle,
              linesStyle,
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
        {!panes && <TasksSheet {...tasks} onCall={onCall} onDismiss={() => setTasksOpen(false)} />}
        {!drawerOpen && !(duo && tasksOpen) && (
          <GestureDetector gesture={edgeOpen}>
            <View style={[styles.edge, { left: layout.content.x }]} />
          </GestureDetector>
        )}
        {drawerOpen && list.place !== 'beside' && (
          <GestureDetector gesture={peekClose}>
            <View
              accessibilityLabel="Close calls"
              style={[styles.fill, { left: layout.content.x, width: layout.content.width }]}
            />
          </GestureDetector>
        )}
      </Animated.View>
      {duo && (
        <DuoTasks
          duo={duo}
          tasks={{ ...tasks, onClose: closeTasks }}
          state={duoTasks}
          onCall={onCall}
          seconds={callSeconds}
          pane={pane}
        />
      )}
      <VoiceSettings
        sheet={split ? 'page' : pose.regular ? 'form' : 'phone'}
        place={duo?.settings}
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
      {duo?.call.controls && inRow
        ? callControls({
            sizes: { mute: TOOL, call: TOOL, gap: GAP },
            style: {
              position: 'absolute',
              right: duo.call.controls.right,
              top: duo.call.controls.top,
            },
          })
        : null}
      <ScreenToolbar
        axis={toolbar.axis}
        gaps={'gaps' in toolbar ? toolbar.gaps : undefined}
        style={[
          { top: toolbar.y },
          toolbar.axis === 'column'
            ? { left: toolbar.x, right: width - toolbar.x - toolbar.width }
            : toolbarStyle,
        ]}
        callsOpen={drawerOpen}
        tasks={{ ...counts, open: tasksOpen }}
        settingsOpen={!!duo?.settings && settingsOpen}
        onCalls={() => {
          setSettingsOpen(false);
          toggleDrawer();
        }}
        onTasks={() => {
          setSettingsOpen(false);
          toggleTasks();
        }}
        // On the open Duo settings is a place like Tasks, so its button opens and closes it.
        onSettings={() => setSettingsOpen((open) => (duo?.settings ? !open : true))}
      />
      {controlsColumn && controls}
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
const FADE_BACKDROP = [{ color: theme.sheet }, { color: 'transparent' }];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.sheet },
  backdrop: { backgroundColor: theme.sheet },
  card: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.background,
    overflow: 'hidden',
    borderColor: theme.edge,
    borderCurve: 'continuous',
  },
  sidebar: { position: 'absolute', top: 0, bottom: 0 },
  edge: { position: 'absolute', top: 0, bottom: 0, width: 20 },
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
    height: metrics.fade,
    experimental_backgroundImage: [{ type: 'linear-gradient', colorStops: FADE }],
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: metrics.fade,
    experimental_backgroundImage: [
      { type: 'linear-gradient', direction: 'to top', colorStops: FADE },
    ],
  },
  onBackdrop: {
    experimental_backgroundImage: [{ type: 'linear-gradient', colorStops: FADE_BACKDROP }],
  },
  onBackdropBottom: {
    experimental_backgroundImage: [
      { type: 'linear-gradient', direction: 'to top', colorStops: FADE_BACKDROP },
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
