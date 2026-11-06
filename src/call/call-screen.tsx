import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { cardOf } from '@/call/card';
import { callIdOf, showsWords, statusOf, voiceLocked, wordsOf, type Call } from '@/call/call';
import { useDrawer } from '@/call/drawer';
import { CallFooter } from '@/call/footer';
import { useGlide } from '@/call/glide';
import { CallPersona, useOrbLife } from '@/call/orb';
import { PoseReport } from '@/call/pose-report';
import { useCall } from '@/call/use-call';
import { AgentLine } from '@/components/agent-line';
import { CallControls } from '@/components/call-controls';
import { CallTranscript } from '@/components/call-transcript';
import { CallsSidebar } from '@/components/calls-sidebar';
import { PastCallBar } from '@/components/past-call-bar';
import { ScreenToolbar } from '@/components/screen-toolbar';
import { TasksPane } from '@/components/tasks-pane';
import { TasksSheet } from '@/components/tasks-sheet';
import type { TasksAt } from '@/components/tasks/tasks-view';
import { opalPaletteInput } from '@/components/persona/variants';
import { Transcript } from '@/components/transcript';
import { VoiceSettings } from '@/components/voice-settings';
import { useCallActivity } from '@/hooks/use-call-activity';
import { REACTIONS, useCallPreferences } from '@/hooks/use-call-preferences';
import { useCallFeedback } from '@/hooks/use-call-feedback';
import { useAgentLine } from '@/hooks/use-agent-line';
import { useAppUpdates } from '@/hooks/use-app-updates';
import { useCalls, usePastCall } from '@/hooks/use-calls';
import { failure } from '@/hooks/use-failures';
import { useNow } from '@/hooks/use-now';
import { answerAsk, raiseAsks } from '@/hooks/use-asks';
import { raiseTask, useTaskCounts } from '@/hooks/use-tasks';
import { usePersonaPreference } from '@/hooks/use-persona-preference';
import { Viewport, type Size } from '@/hooks/use-viewport';
import { useVoicePreference } from '@/hooks/use-voice-preference';
import { activityOrb } from '@/live/activity-orb';
import type { TaskRow } from '@/live/tasks';
import type { CallAbout } from '@/live/types';
import { transcriptText, type CallSummary } from '@/live/calls';
import { heard, motion } from '@/motion';
import { DuoTasks, uncovered, useDuoTasks } from '@/screens/duo-tasks';
import { screenLayout } from '@/screens/layout';
import { logPose } from '@/screens/pose-log';
import { orbRest } from '@/screens/orb-rest';
import { hairline, theme } from '@/theme';
import { HostedGlassButton } from '@/ui/glass-button';
import { metrics } from '@/ui/tokens';
import { roomOf, turns, type Room } from '@/screens/window';
import { PoseView, type Pose } from '../../modules/pose';

const AGENT_ROW = 22;
const CONTROLS_BOX = 200;
// The orb over the phone's half-height Tasks sheet: enough to say the call goes on.
const OVER_SHEET = 96;
const PAD = Platform.OS === 'ios' && Platform.isPad;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type Opening = {
  tasks?: TasksAt;
  open?: 'settings' | 'calls';
  reportPose: boolean;
  // Laid out in half the screen for a check (src/screens/split-view.tsx). A half is compact, as iOS
  // makes a Split View window, though the screen around it is regular.
  split?: boolean;
};

// The screen lays itself out for the room its window has: the size it's drawn at and what of the
// device's pose falls inside it (`roomOf`), so it waits for the first of each. The size is the
// screen's own, as laid out: React Native's window size can report another screen's for a moment
// while iPhone Duo unfolds, and the call screen would lay out for the cover across the open screen.
// A phone stays upright as it always has; iPad and iPhone Duo turn to fit however they're held.
export default function LiveScreen({ opening }: { opening: Opening }) {
  const [pose, setPose] = useState<Pose | undefined>(PoseView ? undefined : { regular: false });
  const [size, setSize] = useState<Size>();
  const insets = useSafeAreaInsets();
  const room = pose && size && roomOf(pose, size, insets);
  const upright = pose && !turns(pose, PAD);
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
            setPose({ regular: regular && !opening.split, bar, fold, occlusions })
          }
        />
      )}
      {pose && room && (
        <Viewport value={room.size}>
          {opening.reportPose && <PoseReport pose={pose} room={room} />}
          <CallScreen room={room} opening={opening} />
        </Viewport>
      )}
    </View>
  );
}

function CallScreen({ room, opening }: { room: Room; opening: Opening }) {
  const { voice, setVoice, loaded: voiceLoaded } = useVoicePreference();
  const { variant, setVariant, loaded: personaLoaded } = usePersonaPreference();
  const preferences = useCallPreferences();
  const [settingsOpen, setSettingsOpen] = useState(opening.open === 'settings');
  const [tasksOpen, setTasksOpen] = useState(opening.tasks !== undefined);
  const [tasksAt, setTasksAt] = useState<TasksAt>(opening.tasks ?? {});
  const counts = useTaskCounts();
  const { insets, size: screen } = room;
  const { width, height } = screen;
  const layout = screenLayout(room);
  const { orb, words, besideCalls, besideTasks, calls: list, tasks: side, lift } = layout;
  const split = layout.kind === 'split';
  // Where the call moves with the room a pane leaves (iPad), and iPhone Duo's open pages: the
  // footer and agent line follow the words there instead of spanning the screen.
  const moves = split || !!orb.dock;
  // The footer and agent line follow the words there and beside iPhone Duo's Tasks.
  const follows = moves || !!layout.duo?.beside;
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
  // Open, iPhone Duo shows settings as a place of its own where Tasks goes.
  const settingsPlace = room.fold && duo?.tasks.area;
  const reducedMotion = useReducedMotion();
  const { call: held, line: agent, cards } = useAgentLine(preferences.haptics);
  // A call hex holds that this app isn't on (a phone call, the web page) shows here as a call too:
  // its words, its agents and asks, and Tasks talking to it, with End hanging it up.
  const { call, start, end, toggleMute } = useCall(held);
  const onCall = call.kind !== 'none';
  const live = call.kind === 'here' && call.phase === 'live';
  const reading = layout.pulls
    ? showing.pulled
    : showsWords(call, { viewing: !!shown, cards: cards.length });
  const duoTasks = useDuoTasks(duo, tasksOpen, onCall, reducedMotion);
  // Before a call on a wide iPad, Tasks takes the screen as a two-column inbox and the call waits
  // in a rail; once a call starts, Tasks narrows to its pane beside it.
  const inbox = layout.inbox && !onCall ? layout.inbox : undefined;
  const inboxShown = !!inbox && tasksOpen;
  const status = statusOf(call);

  useCallFeedback(live, preferences);
  useAppUpdates(onCall);
  useEndedCall(call, voice, calls.add);
  useCallActivity(call, activityOrb(variant, preferences.personaColor, preferences.opalPalette), {
    toggleMute,
    end,
  });
  const haptic = (feedback: () => Promise<void>) => {
    if (process.env.EXPO_OS === 'ios' && preferences.haptics) void feedback();
  };
  const tick = () => haptic(Haptics.selectionAsync);
  const land = () => haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));

  const size = orb.size;
  const reaction = REACTIONS.find(({ id }) => id === preferences.reaction)!.amount;
  const { wake, breath, level, pitch, tone } = useOrbLife(call, { reducedMotion, reaction });
  // The footer (how the call ended, hex's wrap-up, and on the phone the call buttons) is measured,
  // and what sits above it (the resting orb, or the words) keeps clear of it; where the words have a
  // page of their own, the footer sits on that page, away from the orb. On a call Tasks opens half
  // height over a compact screen, and the resting orb keeps clear of it too, small, still listening.
  const [footer, setFooter] = useState(
    layout.footer.bottom + (layout.controls === 'inline' ? metrics.call : 0),
  );
  const overSheet = tasksOpen && onCall && side.place === 'sheet';
  const rest = orbRest(
    {
      top: orb.room.top,
      bottom: Math.min(
        moves ? orb.room.bottom : layout.content.height - footer,
        overSheet ? height / 2 : height,
      ),
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
  const now = useNow(docked && call.kind === 'elsewhere');
  const callSeconds =
    call.kind === 'here'
      ? call.seconds
      : call.kind === 'elsewhere'
        ? Math.max(0, Math.floor((now.getTime() - Date.parse(call.record.started)) / 1000))
        : 0;
  const travel = orb.read.y - rest.y;
  const reach = Math.hypot(orb.read.x - orb.rest.x, travel);
  const { progress, glideTo, drag, glide } = useGlide({
    reading,
    travel,
    reach,
    reducedMotion,
    onCross: tick,
    onLand: land,
    onRelease: pullWords,
  });

  const pulls = layout.pulls;
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
        glideTo(0);
        scheduleOnRN(pullWords, false);
      }),
  );

  const {
    drawer,
    open: drawerOpen,
    settle: settleDrawer,
    edgeOpen,
    listClose,
    peekClose,
  } = useDrawer({
    open: opening.open === 'calls',
    width: list.width,
    reducedMotion,
    onChange: (open) => {
      if (open && panes) setTasksOpen(false);
    },
  });
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

  // Tasks open at launch shows from the first frame, as Calls does, never waiting on a fade in.
  const pane = useSharedValue(panes && tasksOpen ? 1 : 0);
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
  // The card's place and corners, and what keeps the stage on it put, all come from cardOf.
  const cardStyle = useAnimatedStyle(() => {
    const card = cardOf(layout, drawer.get(), pane.get(), paneW.get());
    return {
      top: card.top,
      left: card.left,
      right: card.right,
      borderRadius: card.borderRadius,
      borderWidth: card.lined ? hairline : 0,
    };
  });
  const stageStyle = useAnimatedStyle(
    () => cardOf(layout, drawer.get(), pane.get(), paneW.get()).stage,
  );
  const sidebarStyle = useAnimatedStyle(() => ({
    left: layout.content.x + (drawer.get() - 1) * 48,
  }));
  // A closing pane fades on its way out, so the inbox's width never shows past Calls coming in.
  const paneStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, pane.get() * 4) }));
  // The bar sits in the window. A column down the side never moves. A bar along the top rides the
  // card's top edge, unless Calls starts below it, which leaves the band whole.
  const toolbar = inboxShown ? layout.inbox!.toolbar : layout.toolbar;
  // Its place is all in this one style, whichever way it runs: a prop Reanimated has written stays
  // on the view after a style React passes stops naming it, so a row's `left` would hold the side
  // column at the screen's leading edge, over Tasks.
  const toolbarStyle = useAnimatedStyle(() => {
    if (toolbar.axis === 'column') {
      // The column keeps its width at its own edge: iOS grows the screen before the call screen
      // lays out again as the Duo opens, so a column held by both edges would stretch across it.
      const leading = toolbar.x < width / 2;
      return {
        left: leading ? toolbar.x : 'auto',
        right: leading ? 'auto' : width - toolbar.x - toolbar.width,
        width: toolbar.width,
      };
    }
    const card = cardOf(layout, drawer.get(), pane.get(), paneW.get());
    const banded = list.below !== undefined;
    return {
      left: toolbar.x + (banded ? 0 : card.left),
      right: width - toolbar.x - toolbar.width + (banded ? 0 : card.right),
      width: 'auto',
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
  // The footer and agent line each hold their own span, or where the call moves, follow the words.
  // One style writes their place either way: a prop Reanimated has written stays on the view after
  // it stops writing it, so a span React passes beside it would never come back.
  const column = (own: { x: number; width: number }, drawn: number, paned: number, a: number) => {
    'worklet';
    if (!follows) return { left: own.x, width: own.width, marginBottom: 0 };
    const { d, t } = besideness(drawn, paned);
    return {
      left: toward(words.x, besideCalls.x, besideTasks.x, d, t) + (before.x - words.x) * a,
      width:
        toward(words.width, besideCalls.width, besideTasks.width, d, t) +
        (before.width - words.width) * a,
      marginBottom: lift.calls * d + lift.tasks * t + before.raise * a,
    };
  };
  const footerStyle = useAnimatedStyle(() =>
    column(layout.footer, drawer.get(), pane.get(), aside.get()),
  );
  const agentStyle = useAnimatedStyle(() =>
    column(layout.agent, drawer.get(), pane.get(), aside.get()),
  );
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
      top: toward(y, controlsAt.calls.y, tasksY, d, t) - metrics.call / 2,
    };
  });

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
      x += (spot.x - layout.content.x - x) * k;
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
  // the words' fades trade the call's color for the backdrop's as it comes in. They wear that style
  // off the Duo too, so its last opacity can't stay behind when a window loses the Duo's layout.
  const backdropStyle = useAnimatedStyle(() => ({ opacity: pane.get() }));
  const callColorStyle = useAnimatedStyle(() => ({ opacity: duo ? 1 - pane.get() : 1 }));
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
  const callNow = callIdOf(call);
  const [trouble, setTrouble] = useState<{ call?: string; why: string }>();
  const tried = (what: string, action: Promise<unknown>) => {
    const on = callNow;
    setTrouble(undefined);
    action.catch((error: unknown) => setTrouble({ call: on, why: failure(what, error) }));
  };
  const troubleNow = trouble && trouble.call === callNow ? trouble.why : undefined;
  const startCall = (about?: CallAbout) => {
    if (viewing) leaveCall();
    void start(voice, about);
  };
  const onPrimaryPress = () => {
    if ((onCall && call.phase === 'ending') || !voiceLoaded) return;
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    if (call.kind === 'here') void end();
    else if (call.kind === 'elsewhere') tried('Not ended', end());
    else startCall();
  };
  const onMute = () => {
    haptic(Haptics.selectionAsync);
    toggleMute();
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

  const callControls = (place: Partial<Parameters<typeof CallControls>[0]>) => (
    <CallControls
      call={call}
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
          size: controlsColumn.size,
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
    <GestureDetector gesture={listClose}>
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
        <Animated.View style={[styles.stage, { width: layout.content.width }, stageStyle]}>
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
                      entries={wordsOf(call)}
                      active={reading}
                      size={layout.text}
                      emptyAt={pulls ? 'end' : 'center'}
                      cards={cards}
                      onAnswer={(card, option) => answerAsk(card.ask, option)}
                      onOpenTask={(task) => openTasks({ task })}
                    />
                  )}
                  <Animated.View pointerEvents="none" style={[styles.fade, callColorStyle]} />
                  <Animated.View pointerEvents="none" style={[styles.fadeBottom, callColorStyle]} />
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
                    { left: orb.read.x - metrics.docked / 2, top: orb.read.y - metrics.docked / 2 },
                    dockStyle,
                  ]}
                >
                  <HostedGlassButton
                    icon="transcript"
                    label="Show transcript"
                    testID="transcript-button"
                    size="docked"
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
                  <CallPersona
                    call={call}
                    variant={variant}
                    size={size}
                    color={preferences.personaColor}
                    palette={opalPaletteInput(preferences.opalPalette)}
                  />
                </Animated.View>
              </GestureDetector>
            </View>
          </GestureDetector>
          <CallFooter
            call={call}
            viewing={viewing !== null}
            calls={calls.calls}
            trouble={troubleNow}
            leading={split}
            style={[footerStyle, linesStyle, { paddingBottom: layout.footer.bottom }]}
            onLayout={({ nativeEvent }) => setFooter(nativeEvent.layout.height)}
            onOpen={showCall}
            onMore={() => openTasks({ stage: 'needs' })}
          >
            {layout.controls === 'inline' && !inRow && controls}
          </CallFooter>
          <AnimatedPressable
            pointerEvents={agent ? 'auto' : 'none'}
            accessibilityElementsHidden={!agent}
            importantForAccessibility={agent ? 'auto' : 'no-hide-descendants'}
            onPress={() => openTasks({ stage: 'working' })}
            accessibilityRole="button"
            accessibilityHint="Opens what hex is working on"
            hitSlop={{ top: 8, bottom: 12 }}
            style={[styles.agent, { bottom: layout.agent.bottom }, agentStyle, linesStyle]}
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
            <View testID="calls-edge" style={[styles.edge, { left: layout.content.x }]} />
          </GestureDetector>
        )}
        {drawerOpen && list.place !== 'beside' && (
          <GestureDetector gesture={peekClose}>
            <View accessibilityLabel="Close calls" style={styles.fill} />
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
        sheet={split ? 'page' : room.regular ? 'form' : 'phone'}
        place={settingsPlace}
        isPresented={settingsOpen}
        onDismiss={() => setSettingsOpen(false)}
        voice={voice}
        onVoiceChange={setVoice}
        voiceEnabled={voiceLoaded && !voiceLocked(call)}
        voiceLocked={voiceLocked(call)}
        persona={variant}
        onPersonaChange={setVariant}
        personaEnabled={personaLoaded}
        preferences={preferences}
      />
      {duo?.call.controls && inRow
        ? callControls({
            size: 'tool',
            style: {
              position: 'absolute',
              right: duo.call.controls.right,
              top: duo.call.controls.top,
            },
          })
        : null}
      <ScreenToolbar
        onLayout={({ nativeEvent: { layout } }) => logPose('toolbar', layout)}
        axis={toolbar.axis}
        gaps={'gaps' in toolbar ? toolbar.gaps : undefined}
        style={[{ top: toolbar.y }, toolbarStyle]}
        callsOpen={drawerOpen}
        tasks={{ ...counts, open: tasksOpen }}
        settingsOpen={!!settingsPlace && settingsOpen}
        onCalls={() => {
          setSettingsOpen(false);
          toggleDrawer();
        }}
        onTasks={() => {
          setSettingsOpen(false);
          toggleTasks();
        }}
        // On the open Duo settings is a place like Tasks, so its button opens and closes it.
        onSettings={() => setSettingsOpen((open) => (settingsPlace ? !open : true))}
      />
      {controlsColumn && controls}
    </>
  );
}

// The call you just hung up on is at the top of Calls before hex's copy arrives.
function useEndedCall(call: Call, voice: string, add: (call: CallSummary) => void) {
  const started = useRef<string | null>(null);
  const live = call.kind === 'here' && call.phase === 'live';
  const ended = call.kind === 'none' ? call.last : undefined;
  useEffect(() => {
    if (live) started.current ??= new Date().toISOString();
    if (!ended?.id || ended.from !== 'app' || !started.current) return;
    add({
      id: ended.id,
      started: started.current,
      ended: new Date().toISOString(),
      end: ended.ending,
      from: 'app',
      voice,
      seconds: ended.seconds,
      tasks: 0,
      preview:
        ended.words
          .find((entry) => entry.role === 'user')
          ?.text.trim()
          .slice(0, 160) ?? '',
    });
    started.current = null;
  }, [call.kind, live]);
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
  agent: { position: 'absolute', height: AGENT_ROW },
  controls: {
    position: 'absolute',
    width: CONTROLS_BOX,
    height: metrics.call,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
