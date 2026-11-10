import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactElement } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  createAnimatedComponent,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { buttonsOf, callIdOf, showsWords, statusOf, voiceLocked, wordsOf } from "@/call/call";
import type { Call } from "@/call/call";
import { barOf, cardOf } from "@/call/card";
import { useDrawer } from "@/call/drawer";
import { CallFooter } from "@/call/footer";
import { useGlide } from "@/call/glide";
import { CallPersona, useOrbLife } from "@/call/orb";
import { PoseReport } from "@/call/pose-report";
import type { CallsPlacement } from "@/call/stage";
import { useCall } from "@/call/use-call";
import { AgentLine } from "@/components/agent-line";
import { CallControls } from "@/components/call-controls";
import { CallTranscript } from "@/components/call-transcript";
import { CallsSidebar } from "@/components/calls-sidebar";
import { CallAdd } from "@/components/media/call-add";
import { PastCallBar } from "@/components/past-call-bar";
import { opalPaletteInput } from "@/components/persona/variants";
import { ScreenToolbar } from "@/components/screen-toolbar";
import { TasksPane } from "@/components/tasks-pane";
import { TasksSheet } from "@/components/tasks-sheet";
import type { Move, TasksAt } from "@/components/tasks/pages";
import { ToolbarBackProvider, useToolbarBacks } from "@/components/toolbar-back";
import type { BackFrom } from "@/components/toolbar-back";
import { Transcript } from "@/components/transcript";
import { UpdateToast } from "@/components/update-toast";
import { VoiceSettings } from "@/components/voice-settings";
import type { SettingsSheet } from "@/components/voice-settings";
import { useAgentLine } from "@/hooks/use-agent-line";
import { useAppUpdates } from "@/hooks/use-app-updates";
import type { NativeBuild } from "@/hooks/use-app-updates";
import { answerAsk, raiseAsks } from "@/hooks/use-asks";
import { useCallActivity } from "@/hooks/use-call-activity";
import { useCallFeedback } from "@/hooks/use-call-feedback";
import { REACTIONS, useCallPreferences } from "@/hooks/use-call-preferences";
import type { Reaction } from "@/hooks/use-call-preferences";
import { useCalls, usePastCall } from "@/hooks/use-calls";
import { useEscape } from "@/hooks/use-escape";
import { failure } from "@/hooks/use-failures";
import { useNow } from "@/hooks/use-now";
import { usePersonaPreference } from "@/hooks/use-persona-preference";
import { useTalk } from "@/hooks/use-talk";
import { raiseTask, useTaskCounts } from "@/hooks/use-tasks";
import type { Counts } from "@/hooks/use-tasks";
import { Viewport } from "@/hooks/use-viewport";
import type { Size } from "@/hooks/use-viewport";
import { useVoicePreference } from "@/hooks/use-voice-preference";
import { activityOrb } from "@/live/activity-orb";
import type { CallCard } from "@/live/agents";
import { transcriptText } from "@/live/calls";
import type { CallId, CallSummary } from "@/live/calls";
import type { TaskId, TaskRow } from "@/live/tasks";
import type { CallAbout, TranscriptEntry } from "@/live/types";
import { heard, motion } from "@/motion";
import { DuoTasks, uncovered, useDuoTasks } from "@/screens/duo-tasks";
import { screenLayout } from "@/screens/layout";
import type { Layout } from "@/screens/layout";
import { orbRest } from "@/screens/orb-rest";
import { logPose } from "@/screens/pose-log";
import { SideColumn } from "@/screens/side-column";
import { roomOf } from "@/screens/window";
import type { Room } from "@/screens/window";
import { hairline, theme } from "@/theme";
import { AnimatedView } from "@/ui/animated-view";
import { HostedGlassButton } from "@/ui/glass-button";
import { metrics, stack } from "@/ui/tokens";

import { PoseView } from "../../modules/pose";
import type { Pose } from "../../modules/pose";
import { shown as inView, start as startScreen, step } from "./screen";
import type { Action, Screen } from "./screen";

const AGENT_ROW = 22;
const CONTROLS_BOX = stack("regular");

const ORB_OVER_SHEET = 96;
const AnimatedPressable = createAnimatedComponent(Pressable);

export interface Opening {
  tasks?: TasksAt | undefined;
  open?: "settings" | "calls" | undefined;
  reportPose: boolean;
  split?: boolean;
  update?: NativeBuild | undefined;
}

const LiveScreen = ({ opening }: { opening: Opening }) => {
  const [pose, setPose] = useState<Pose | undefined>(PoseView ? undefined : { regular: false });
  const [size, setSize] = useState<Size>();
  const insets = useSafeAreaInsets();
  const room = pose && size && roomOf(pose, size, insets);

  return (
    <View
      style={styles.root}
      onLayout={({ nativeEvent: { layout } }) => {
        setSize((was) =>
          was?.width === layout.width && was.height === layout.height
            ? was
            : { width: layout.width, height: layout.height },
        );
      }}
    >
      {PoseView && (
        <PoseView
          style={StyleSheet.absoluteFill}
          onPoseChange={({ nativeEvent: { regular, bar, fold, occlusions } }) => {
            setPose({ regular: regular && opening.split !== true, bar, fold, occlusions });
          }}
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
};

export default LiveScreen;

const CallScreen = ({ room, opening }: { room: Room; opening: Opening }) => {
  const { voice, setVoice, loaded: voiceLoaded } = useVoicePreference();
  const { variant, setVariant, loaded: personaLoaded } = usePersonaPreference();
  const preferences = useCallPreferences();
  const [scene, setScene] = useState<Screen>(() => startScreen(opening));
  const [listed, setListed] = useState<Counts>();
  const counts = useTaskCounts(listed);
  const { insets, size: screen } = room;
  const { width, height } = screen;
  const viewing = scene.words.call;
  const calls = useCalls();

  const shown = pastOf(calls.calls, viewing);

  const past = usePastCall(shown?.id);
  const { call: held, line: agent, cards } = useAgentLine(preferences.haptics);
  const { call, start, end, toggleMute } = useCall(held);
  const onCall = call.kind !== "none";
  const showing = onCall || !!shown;
  const [called, setCalled] = useState(showing);
  const layout = screenLayout(room, { call: called });

  const {
    orb,
    words,
    besideCalls,
    besideTasks,
    calls: list,
    tasks: side,
    lift,
    add,
    duo,
    pulls,
  } = layout;

  const {
    split,
    moves,
    follows,
    panes,
    settingsPlace,
    inbox,
    paneWidth,
    before,
    controlsAt,
    controlsColumn,
    rowControls,
    footerControls,
  } = arrangementOf(layout, onCall);

  const shared = !!settingsPlace;

  const send = (action: Action) => {
    setScene((now) => step(now, action, { shared }));
  };

  const {
    calls: callsOpen,
    tasks: tasksOpen,
    settings: settingsOpen,
    place: placeOpen,
  } = inView(scene, shared);

  const talk = useTalk({ open: settingsOpen, voice, setVoice, voiceLoaded });

  const pullWords = (pulled: boolean) => {
    send({ to: "words", pulled });
  };

  const showCall = (id: string | null) => {
    send({ to: "call", id });
  };

  const reducedMotion = useReducedMotion();
  const live = call.kind === "here" && call.phase === "live";

  const reading = layout.pulls
    ? scene.words.pulled
    : showsWords(call, { viewing: !!shown, cards: cards.length });

  if (scene.words.beside && !(duo?.beside && onCall)) {
    send({ to: "beside", on: false });
  }

  const duoTasks = useDuoTasks(
    duo,
    { open: placeOpen, tasks: tasksOpen, chosen: scene.words.beside },
    onCall,
    reducedMotion,
    (on) => {
      send({ to: "beside", on });
    },
  );

  const inboxShown = !!inbox && tasksOpen;
  const status = statusOf(call);

  useCallFeedback(live, preferences);
  const update = useAppUpdates(onCall) ?? opening.update;
  const [notNow, setNotNow] = useState<number>();
  useEndedCall(call, voice, calls.add);
  useCallActivity(call, activityOrb(variant, preferences.personaColor, preferences.opalPalette), {
    toggleMute,
    end,
  });

  const haptic = (feedback: () => Promise<void>) => {
    if (process.env.EXPO_OS === "ios" && preferences.haptics) {
      void feedback();
    }
  };

  const tick = () => {
    haptic(Haptics.selectionAsync);
  };

  const land = () => {
    haptic(async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
    });
  };

  const { size } = orb;
  const reaction = amountOf(preferences.reaction);
  const { wake, breath, level, pitch, tone } = useOrbLife(call, { reducedMotion, reaction });

  const { rest, restY, restScale, footerHeight, setFooter } = useOrbRest({
    layout,
    moves,
    overSheet: tasksOpen && onCall && side.place === "sheet",
    height,
    reducedMotion,
  });

  const { docked, dock, covers, aside } = duoTasks;

  const adds =
    buttonsOf(call).add && !(orb.dock && (callsOpen || tasksOpen)) && (viewing ?? "") === "";

  const closeTasks = () => {
    tick();
    send({ to: "tasks", open: false });
  };

  useEscape(tasksOpen ? closeTasks : undefined);
  const now = useNow(docked && call.kind === "elsewhere");

  const callSeconds = secondsOf(call, now);

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

  const screenDrag = drag()
    .enabled(pulls && !reading)
    .failOffsetX([-20, 20]);

  // oxlint-disable-next-line typescript/no-deprecated -- Gesture Handler 3 deprecates its Gesture builder for hook gestures, whose timing needs a check on a device before this moves
  const orbGesture = Gesture.Race(
    drag().enabled(pulls && reading && !docked),
    // oxlint-disable-next-line typescript/no-deprecated -- Gesture Handler 3 deprecates its Gesture builder for hook gestures, whose timing needs a check on a device before this moves
    Gesture.Tap()
      .enabled(docked || (pulls ? reading : viewing !== null))
      .onEnd(() => {
        "worklet";

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

  const setCalls = (open: boolean) => {
    send({ to: "calls", open });
  };

  const {
    drawer,
    out: drawerOut,
    edgeOpen,
    listClose,
    peekClose,
  } = useDrawer({
    open: callsOpen,
    width: list.width,
    reducedMotion,
    onChange: setCalls,
  });

  if (!drawerOut && called !== showing) {
    setCalled(showing);
  }

  const toggleDrawer = () => {
    tick();
    setCalls(!callsOpen);
  };

  const openCall = (id: string, at?: CallsPlacement["place"]) => {
    const place = at ?? list.place;

    if (place !== "beside") {
      setCalls(false);
    }

    if (id === calls.live && onCall) {
      backToCall();

      return;
    }

    showCall(id);
  };

  const backToCall = () => {
    tick();
    showCall(null);
  };

  const leaveCall = () => {
    pullWords(false);
  };

  const { pane, paneW, wide } = usePaneMotion({
    panes,
    open: placeOpen,
    width: paneWidth,
    inbox: !!inbox,
    reducedMotion,
  });

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

  const over = list.place === "over";

  const sidebarStyle = useAnimatedStyle(() => ({
    left: layout.content.x + (drawer.get() - 1) * (over ? list.width : 48),
    opacity: drawer.get() > 0 ? 1 : 0,
  }));

  const paneFade = () => {
    "worklet";

    return { opacity: Math.min(1, pane.get() * 4) };
  };

  const { toolbar } = layout;

  const besidenessOfStyleReads = (drawn: number, paned: number) => {
    "worklet";

    return {
      d: list.place === "beside" ? drawn : 0,
      t: side.place === "beside" ? paned : 0,
    };
  };

  // Both branches write left, width and marginBottom: Reanimated keeps a value it wrote after the style stops writing it, https://docs.swmansion.com/react-native-reanimated/docs/core/useAnimatedStyle#remarks
  const columnOfStyleReads = (
    own: { x: number; width: number },
    drawn: number,
    paned: number,
    a: number,
  ) => {
    "worklet";

    if (!follows) {
      return { left: own.x, width: own.width, marginBottom: 0 };
    }

    const { d, t } = besidenessOfStyleReads(drawn, paned);

    return {
      left: toward(words.x, besideCalls.x, besideTasks.x, d, t) + (before.x - words.x) * a,
      width:
        toward(words.width, besideCalls.width, besideTasks.width, d, t) +
        (before.width - words.width) * a,
      marginBottom: lift.calls * d + lift.tasks * t + before.raise * a,
    };
  };

  const footerStyle = useAnimatedStyle(() =>
    columnOfStyleReads(layout.footer, drawer.get(), pane.get(), aside.get()),
  );

  const agentStyle = useAnimatedStyle(() =>
    columnOfStyleReads(layout.agent, drawer.get(), pane.get(), aside.get()),
  );

  const slides = list.place === "slide";

  const linesStyle = useAnimatedStyle(() => {
    const { t } = besidenessOfStyleReads(drawer.get(), pane.get());
    const slid = slides ? drawer.get() : 0;

    return { opacity: (1 - wide.get() * t) * (1 - slid) * uncovered(covers.get()) };
  });

  const wordsStyle = useAnimatedStyle(() => {
    const { d, t } = besidenessOfStyleReads(drawer.get(), pane.get());
    const a = aside.get();

    return {
      top: toward(words.top, besideCalls.top, besideTasks.top, d, t) + (before.top - words.top) * a,
      left: toward(words.x, besideCalls.x, besideTasks.x, d, t) + (before.x - words.x) * a,
      width:
        toward(words.width, besideCalls.width, besideTasks.width, d, t) +
        (before.width - words.width) * a,
    };
  });

  const rail = layout.inbox;

  const controlsPlace = () => {
    "worklet";

    if (!controlsAt) {
      return {};
    }

    const { d, t } = besidenessOfStyleReads(drawer.get(), pane.get());
    const w = rail ? wide.get() : 0;
    const tasksX = controlsAt.tasks.x + ((rail?.controls.x ?? 0) - controlsAt.tasks.x) * w;
    const tasksY = controlsAt.tasks.y + ((rail?.controls.y ?? 0) - controlsAt.tasks.y) * w;
    const { rest: resting, open } = controlsAt;
    const along = glide(progress.get());
    const x = resting.x + (open.x - resting.x) * Math.min(1, along.arc);
    const y = resting.y + (open.y - resting.y) * Math.min(1, Math.max(0, along.t));

    return {
      left: toward(x, controlsAt.calls.x, tasksX, d, t) - CONTROLS_BOX / 2,
      top: toward(y, controlsAt.calls.y, tasksY, d, t) - metrics.call / 2,
    };
  };

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
      const beside = besidenessOfStyleReads(drawer.get(), pane.get());
      const w = rail ? wide.get() : 0;

      const tasks = {
        x: orb.dock.tasks.x + ((rail?.orb.x ?? 0) - orb.dock.tasks.x) * w,
        y: orb.dock.tasks.y + ((rail?.orb.y ?? 0) - orb.dock.tasks.y) * w,
        size: orb.dock.tasks.size + ((rail?.orb.size ?? 0) - orb.dock.tasks.size) * w,
      };

      const nearCalls = orb.dock.calls;
      const read = orb.dock.read ?? nearCalls;

      const withCalls = {
        x: nearCalls.x + (read.x - nearCalls.x) * t,
        y: nearCalls.y + (read.y - nearCalls.y) * t,
        size: nearCalls.size + (read.size - nearCalls.size) * t,
      };

      x = toward(x, withCalls.x, tasks.x, beside.d, beside.t);
      at = toward(at, withCalls.y, tasks.y, beside.d, beside.t);
      visual = toward(visual, withCalls.size, tasks.size, beside.d, beside.t);
    }

    let seen = 1;

    if (duo) {
      const k = dock.get();
      const spot = duo.call.orb;
      x += (spot.x - layout.content.x - x) * k;
      at += (spot.y - at) * k;
      visual += (spot.size - visual) * k;
      const under = uncovered(covers.get());
      seen = under + (1 - under) * k;
    }

    visual *= 1 + 0.025 * breath.get();

    return {
      opacity:
        Math.min(1, 0.5 + 0.5 * awake + 0.1 * breath.get()) *
        (reducedMotion ? Math.abs(2 * p - 1) : 1) *
        (split && !orb.dock ? 1 - drawer.get() : 1) *
        (slides ? 1 - drawer.get() : 1) *
        seen,
      transform: [
        { translateX: x - size / 2 },
        { translateY: at - size / 2 },
        { scale: visual / size },
        ...heard(reaction, size, level.get(), pitch.get(), tone.get()),
      ],
    };
  });

  const dockFade = () => {
    "worklet";

    return {
      opacity:
        interpolate(progress.get(), [0.6, 1], [1, 0], Extrapolation.CLAMP) *
        (slides ? 1 - drawer.get() : 1) *
        uncovered(covers.get()),
    };
  };

  const addFade = () => {
    "worklet";

    return {
      opacity: (adds ? 1 : 0) * (slides ? 1 - drawer.get() : 1) * uncovered(covers.get()),
    };
  };

  const backdropFade = () => {
    "worklet";

    return { opacity: pane.get() };
  };

  const callColorStyle = useAnimatedStyle(() => ({ opacity: duo ? 1 - pane.get() : 1 }));

  const transcriptStyle = useAnimatedStyle(() => {
    const p = progress.get();

    const revealed = reducedMotion
      ? Math.min(1, Math.max(0, p))
      : interpolate(p, [0.12, 0.72], [0, 1], Extrapolation.CLAMP);

    const { d, t } = besidenessOfStyleReads(drawer.get(), pane.get());

    return {
      bottom:
        footerHeight.get() + 18 + lift.calls * d + lift.tasks * t + before.raise * aside.get(),
      opacity:
        revealed * (1 - wide.get() * t) * (slides ? 1 - drawer.get() : 1) * uncovered(covers.get()),
      transform: [{ translateY: reducedMotion ? 0 : (revealed - 1) * 28 }],
    };
  });

  const { tried, troubleNow } = useTrouble(callIdOf(call));

  const startCall = (about?: CallAbout) => {
    if ((viewing ?? "") !== "") {
      leaveCall();
    }

    void start(voice, about);
  };

  const onPrimaryPress = () => {
    if ((onCall && call.phase === "ending") || !voiceLoaded) {
      return;
    }

    haptic(async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });

    if (call.kind === "here") {
      void end();
    } else if (call.kind === "elsewhere") {
      void tried("Not ended", end());
    } else {
      if (list.place !== "beside") {
        setCalls(false);
      }

      startCall();
    }
  };

  const onMute = () => {
    haptic(Haptics.selectionAsync);
    toggleMute();
  };

  const openTasks = (at: TasksAt = {}) => {
    tick();
    send({ to: "tasks", open: true, at });
  };

  const toggleTasks = () => {
    if (tasksOpen) {
      closeTasks();
    } else {
      openTasks();
    }
  };

  const stepAside = () => {
    if (!panes) {
      send({ to: "tasks", open: false });
    }
  };

  const talkAbout = (task: TaskRow) => {
    stepAside();

    if (onCall) {
      void tried("Not sent", raiseTask(task.id));
    } else if (voiceLoaded) {
      startCall({ task: task.id });
    }
  };

  const openCallFromTasks = (id: string) => {
    stepAside();
    const { place } = screenLayout(room).calls;

    if (place === "beside") {
      setCalls(true);
    }

    openCall(id, place);
  };

  const removeCall = (id: CallId) => {
    if (id === viewing) {
      leaveCall();
    }

    calls.remove(id);
  };

  const goThrough = () => {
    stepAside();

    if (onCall) {
      void tried("Not sent", raiseAsks());
    } else if (voiceLoaded) {
      startCall("asks");
    }
  };

  const buttons = {
    call,
    ready: voiceLoaded,
    axis: "row" as const,
    mute: !inboxShown,
    onMute,
    onPrimary: onPrimaryPress,
    ...(controlsColumn && { axis: controlsColumn.axis, size: controlsColumn.size }),
  };

  const controls = <CallControls {...buttons} />;
  const { backs, publish } = useToolbarBacks();
  const back = backs[frontOf(settingsOpen, tasksOpen)];

  const screenToolbar = (style: ComponentProps<typeof ScreenToolbar>["style"]) => (
    <ScreenToolbar
      onLayout={({ nativeEvent }) => {
        logPose("toolbar", nativeEvent.layout);
      }}
      axis={toolbar.axis}
      gaps={"gaps" in toolbar ? toolbar.gaps : undefined}
      style={style}
      callsOpen={callsOpen}
      tasks={{ ...counts, open: tasksOpen }}
      settingsOpen={settingsOpen}
      holdsBack={!!duo}
      back={back}
      onCalls={toggleDrawer}
      onTasks={toggleTasks}
      onSettings={() => {
        send({ to: "settings", open: !settingsOpen });
      }}
    />
  );

  const tasks = {
    open: tasksOpen,
    stack: scene.pages,
    onMove: (move: Move) => {
      send({ to: "pages", move });
    },
    haptics: preferences.haptics,
    onTalk: talkAbout,
    onGoThrough: goThrough,
    onOpenCall: openCallFromTasks,
    onCounts: setListed,
  };

  return (
    <ToolbarBackProvider value={duo ? publish : null}>
      <CallsList
        gesture={listClose}
        list={list}
        style={sidebarStyle}
        top={insets.top}
        calls={calls}
        viewing={viewing}
        haptics={preferences.haptics}
        onOpen={openCall}
        onRemove={removeCall}
      />
      {panes && !duo && (
        <TasksPane
          {...tasks}
          top={inbox ? inbox.top : insets.top}
          foot={insets.bottom}
          width={paneWidth}
          animate={paneFade}
        />
      )}
      <Animated.View style={[styles.card, cardStyle]}>
        {duo && (
          <AnimatedView
            pointerEvents="none"
            style={[styles.fill, styles.backdrop]}
            animate={backdropFade}
          />
        )}
        <Animated.View style={[styles.stage, { width: layout.content.width }, stageStyle]}>
          <GestureDetector gesture={screenDrag}>
            <View style={styles.fill}>
              <CallWords
                reading={reading}
                style={[styles.transcript, wordsStyle, transcriptStyle]}
                shown={shown}
                live={calls.live}
                onCall={onCall}
                past={past}
                entries={wordsOf(call)}
                size={layout.text}
                pulls={pulls}
                cards={cards}
                fadeStyle={callColorStyle}
                onBackdrop={duo !== undefined}
                backdropFade={backdropFade}
                onBack={backToCall}
                onRemove={removeCall}
                onOpenTask={(task) => {
                  openTasks({ task });
                }}
              />
              {pulls && (
                <AnimatedView
                  {...reachable(!reading)}
                  style={[
                    styles.dock,
                    { left: orb.read.x - metrics.docked / 2, top: orb.read.y - metrics.docked / 2 },
                  ]}
                  animate={dockFade}
                >
                  <HostedGlassButton
                    icon="transcript"
                    label="Show transcript"
                    testID="transcript-button"
                    size="docked"
                    onPress={() => {
                      pullWords(true);
                    }}
                  />
                </AnimatedView>
              )}
              <AnimatedView
                animate={addFade}
                {...reachable(adds && !docked)}
                style={[
                  styles.dock,
                  { left: add.x - metrics.docked / 2, top: add.y - metrics.docked / 2 },
                ]}
              >
                <CallAdd call={call} />
              </AnimatedView>
              <GestureDetector gesture={orbGesture}>
                <Animated.View
                  accessible
                  accessibilityLabel={status}
                  accessibilityHint={docked ? "Closes Tasks for the call" : undefined}
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
            onLayout={({ nativeEvent }) => {
              setFooter(nativeEvent.layout.height);
            }}
            onOpen={showCall}
            onMore={() => {
              openTasks({ stage: "needs" });
            }}
          >
            {footerControls && controls}
          </CallFooter>
          <AnimatedPressable
            {...reachable(agent !== null)}
            onPress={() => {
              openTasks({ stage: "working" });
            }}
            accessibilityRole="button"
            accessibilityHint="Opens what hex is working on"
            hitSlop={{ top: 8, bottom: 12 }}
            style={[styles.agent, { bottom: layout.agent.bottom }, agentStyle, linesStyle]}
          >
            <AgentLine line={agent} />
          </AnimatedPressable>
          {controlsAt && (
            <AnimatedView pointerEvents="box-none" style={styles.controls} animate={controlsPlace}>
              {controls}
            </AnimatedView>
          )}
        </Animated.View>
        {!panes && (
          <TasksSheet
            {...tasks}
            onCall={onCall}
            onDismiss={() => {
              send({ to: "tasks", open: false });
            }}
          />
        )}
        <CallsEdges
          open={callsOpen}
          covered={duo !== undefined && tasksOpen}
          slides={slides}
          x={layout.content.x}
          edgeOpen={edgeOpen}
          peekClose={peekClose}
        />
      </Animated.View>
      {duo && (
        <DuoTasks
          duo={duo}
          tasks={{ ...tasks, onClose: closeTasks }}
          state={duoTasks}
          shown={!shared || scene.front === "tasks"}
          onCall={onCall}
          seconds={callSeconds}
          pane={pane}
        />
      )}
      <VoiceSettings
        sheet={sheetOf(split, room.regular)}
        place={
          settingsPlace
            ? { area: settingsPlace, shown: scene.front === "settings", pane }
            : undefined
        }
        isPresented={settingsOpen}
        onDismiss={() => {
          send({ to: "settings", open: false });
        }}
        voice={voice}
        onVoiceChange={talk.setVoice}
        talk={talk}
        voiceEnabled={voiceLoaded && !voiceLocked(call)}
        voiceLocked={voiceLocked(call)}
        persona={variant}
        onPersonaChange={setVariant}
        personaEnabled={personaLoaded}
        preferences={preferences}
      />
      {rowControls ? (
        <CallControls
          {...buttons}
          size="tool"
          style={{ position: "absolute", right: rowControls.right, top: rowControls.top }}
        />
      ) : null}
      {layout.column ? (
        <SideColumn
          column={layout.column}
          tools={screenToolbar({ position: "relative" })}
          controls={buttons}
        />
      ) : (
        <BarStyledWhenMounted
          layout={layout}
          width={width}
          drawer={drawer}
          toolbar={screenToolbar}
        />
      )}
      {update &&
        !onCall &&
        !(tasksOpen || callsOpen || settingsOpen) &&
        update.version !== notNow && (
          <UpdateToast
            build={update}
            top={insets.top}
            onDismiss={() => {
              setNotNow(update.version);
            }}
          />
        )}
    </ToolbarBackProvider>
  );
};

const arrangementOf = (layout: Layout, onCall: boolean) => {
  const split = layout.kind === "split";
  const moves = split || !!layout.orb.dock;
  const inbox = layout.inbox && !onCall ? layout.inbox : undefined;
  const { controls } = layout;
  const rowControls = layout.duo?.call.controls;

  return {
    split,
    moves,
    follows: moves || !!layout.duo?.beside,
    panes: layout.tasks.place !== "sheet",
    settingsPlace: layout.duo?.tasks.area,
    inbox,
    paneWidth: inbox ? inbox.width : layout.tasks.width,
    before: layout.duo?.beside?.words ?? { ...layout.words, raise: 0 },
    controlsAt: controls !== "inline" && "center" in controls ? controls.center : undefined,
    controlsColumn: controls !== "inline" && "axis" in controls ? controls : undefined,
    rowControls,
    footerControls: controls === "inline" && !rowControls,
  };
};

const settleTo = (to: number, reducedMotion: boolean) =>
  reducedMotion ? withTiming(to, motion.reduced) : withSpring(to, motion.drawer);

const usePaneMotion = ({
  panes,
  open,
  width,
  inbox,
  reducedMotion,
}: {
  panes: boolean;
  open: boolean;
  width: number;
  inbox: boolean;
  reducedMotion: boolean;
}) => {
  const pane = useSharedValue(panes && open ? 1 : 0);
  const paneW = useSharedValue(width);
  const wide = useSharedValue(inbox ? 1 : 0);
  useEffect(() => {
    if (!panes) {
      return;
    }

    if (open) {
      const closed = pane.get() < 0.01;
      const wideTo = inbox ? 1 : 0;
      paneW.set(closed ? width : settleTo(width, reducedMotion));
      wide.set(closed ? wideTo : settleTo(wideTo, reducedMotion));
    }

    pane.set(settleTo(open ? 1 : 0, reducedMotion));
  }, [open, panes, width, inbox, reducedMotion, pane, paneW, wide]);

  return { pane, paneW, wide };
};

const useOrbRest = ({
  layout,
  moves,
  overSheet,
  height,
  reducedMotion,
}: {
  layout: Layout;
  moves: boolean;
  overSheet: boolean;
  height: number;
  reducedMotion: boolean;
}) => {
  const { orb } = layout;

  const [footer, setFooter] = useState(
    layout.footer.bottom + (layout.controls === "inline" ? metrics.call : 0),
  );

  const rest = orbRest(
    {
      top: orb.room.top,
      bottom: Math.min(
        moves ? orb.room.bottom : layout.content.height - footer,
        overSheet ? height / 2 : height,
      ),
    },
    orb.rest.y,
    orb.size,
    overSheet ? ORB_OVER_SHEET : orb.size,
  );

  const restY = useSharedValue(rest.y);
  const restScale = useSharedValue(rest.scale);
  const footerHeight = useSharedValue(footer);
  useEffect(() => {
    restY.set(settleTo(rest.y, reducedMotion));
    restScale.set(settleTo(rest.scale, reducedMotion));
    footerHeight.set(settleTo(footer, reducedMotion));
  }, [rest.y, rest.scale, footer, reducedMotion, restY, restScale, footerHeight]);

  return { rest, restY, restScale, footerHeight, setFooter };
};

const useTrouble = (callNow: CallId | undefined) => {
  const [trouble, setTrouble] = useState<{ call?: string | undefined; why: string }>();

  const tried = async (what: string, action: Promise<unknown>) => {
    const on = callNow;
    setTrouble(undefined);

    try {
      await action;
    } catch (error) {
      setTrouble({ call: on, why: failure(what, error) });
    }
  };

  return { tried, troubleNow: trouble && trouble.call === callNow ? trouble.why : undefined };
};

type Drawer = ReturnType<typeof useDrawer>;

const pastOf = (calls: CallSummary[] | undefined, viewing: string | null) =>
  (viewing ?? "") === "" ? undefined : calls?.find((one) => one.id === viewing);

const CallsList = ({
  gesture,
  list,
  style,
  top,
  calls,
  viewing,
  haptics,
  onOpen,
  onRemove,
}: {
  gesture: Drawer["listClose"];
  list: CallsPlacement;
  style: ComponentProps<typeof Animated.View>["style"];
  top: number;
  calls: ReturnType<typeof useCalls>;
  viewing: string | null;
  haptics: boolean;
  onOpen: (id: string) => void;
  onRemove: (id: CallId) => void;
}) => (
  <GestureDetector gesture={gesture}>
    <Animated.View
      style={[
        styles.sidebar,
        { width: list.width, top: list.below ?? 0, zIndex: list.place === "over" ? 1 : 0 },
        style,
      ]}
    >
      <CallsSidebar
        top={list.below === undefined ? top : 0}
        width={list.width}
        calls={calls.calls}
        live={calls.live}
        viewing={viewing}
        offline={calls.offline}
        haptics={haptics}
        onOpen={(picked) => {
          onOpen(picked.id);
        }}
        onDelete={onRemove}
      />
    </Animated.View>
  </GestureDetector>
);

const CallWords = ({
  reading,
  style,
  shown,
  live,
  onCall,
  past,
  entries,
  size,
  pulls,
  cards,
  fadeStyle,
  onBackdrop,
  backdropFade,
  onBack,
  onRemove,
  onOpenTask,
}: {
  reading: boolean;
  style: ComponentProps<typeof Animated.View>["style"];
  shown: CallSummary | undefined;
  live: CallId | undefined;
  onCall: boolean;
  past: ReturnType<typeof usePastCall>;
  entries: TranscriptEntry[];
  size: ComponentProps<typeof Transcript>["size"];
  pulls: boolean;
  cards: CallCard[];
  fadeStyle: ComponentProps<typeof Animated.View>["style"];
  onBackdrop: boolean;
  backdropFade: ComponentProps<typeof AnimatedView>["animate"];
  onBack: () => void;
  onRemove: (id: CallId) => void;
  onOpenTask: (task: TaskId) => void;
}) => (
  <Animated.View {...reachable(reading)} style={style}>
    {shown && (
      <PastCallBar
        call={shown}
        live={shown.id === live}
        onCall={onCall}
        transcript={past.call && transcriptText(past.call)}
        onBack={onBack}
        onDelete={
          shown.id === live
            ? undefined
            : () => {
                onRemove(shown.id);
              }
        }
      />
    )}
    <View style={styles.words}>
      {shown ? (
        <CallTranscript
          summary={shown}
          call={past.call}
          failed={past.failed}
          live={shown.id === live}
        />
      ) : (
        <Transcript
          entries={entries}
          active={reading}
          size={size}
          emptyAt={pulls ? "end" : "center"}
          cards={cards}
          onAnswer={async (card, option) => await answerAsk(card.ask, option)}
          onOpenTask={onOpenTask}
        />
      )}
      <Animated.View pointerEvents="none" style={[styles.fade, fadeStyle]} />
      <Animated.View pointerEvents="none" style={[styles.fadeBottom, fadeStyle]} />
      {onBackdrop && (
        <>
          <AnimatedView
            pointerEvents="none"
            style={[styles.fade, styles.onBackdrop]}
            animate={backdropFade}
          />
          <AnimatedView
            pointerEvents="none"
            style={[styles.fadeBottom, styles.onBackdropBottom]}
            animate={backdropFade}
          />
        </>
      )}
    </View>
  </Animated.View>
);

const CallsEdges = ({
  open,
  covered,
  slides,
  x,
  edgeOpen,
  peekClose,
}: {
  open: boolean;
  covered: boolean;
  slides: boolean;
  x: number;
  edgeOpen: Drawer["edgeOpen"];
  peekClose: Drawer["peekClose"];
}) => (
  <>
    {!open && !covered && (
      <GestureDetector gesture={edgeOpen}>
        <View testID="calls-edge" style={[styles.edge, { left: x }]} />
      </GestureDetector>
    )}
    {open && slides && (
      <GestureDetector gesture={peekClose}>
        <View accessibilityLabel="Close calls" style={styles.fill} />
      </GestureDetector>
    )}
  </>
);

const BarStyledWhenMounted = ({
  layout,
  width,
  drawer,
  toolbar,
}: {
  layout: Layout;
  width: number;
  drawer: SharedValue<number>;
  toolbar: (style: ComponentProps<typeof ScreenToolbar>["style"]) => ReactElement;
}) => {
  const style = useAnimatedStyle(() => barOf(layout, width, drawer.get()));

  return toolbar([{ top: layout.toolbar.y }, style]);
};

const useEndedCall = (call: Call, voice: string, add: (call: CallSummary) => void) => {
  const started = useRef<string | null>(null);
  const live = call.kind === "here" && call.phase === "live";
  const ended = call.kind === "none" ? call.last : undefined;
  useEffect(() => {
    if (live && started.current === null) {
      started.current = new Date().toISOString();
    }

    if (!ended?.id || ended.from !== "app" || started.current === null) {
      return;
    }

    add({
      id: ended.id,
      started: started.current,
      ended: new Date().toISOString(),
      end: ended.ending,
      from: "app",
      voice,
      seconds: ended.seconds,
      tasks: 0,
      preview:
        ended.words
          .find((entry) => entry.role === "user")
          ?.text.trim()
          .slice(0, 160) ?? "",
    });
    started.current = null;
  }, [call.kind, live]);
};

const reachable = (on: boolean) =>
  ({
    pointerEvents: on ? "auto" : "none",
    accessibilityElementsHidden: !on,
    importantForAccessibility: on ? "auto" : "no-hide-descendants",
  }) as const;

const toward = (open: number, calls: number, tasks: number, d: number, t: number) => {
  "worklet";

  return open + (calls - open) * d + (tasks - open) * t;
};

const amountOf = (reaction: Reaction) => REACTIONS.find(({ id }) => id === reaction)?.amount ?? 0;

const secondsOf = (call: Call, now: Date) => {
  if (call.kind === "here") {
    return call.seconds;
  }

  return call.kind === "elsewhere"
    ? Math.max(0, Math.floor((now.getTime() - Date.parse(call.record.started)) / 1000))
    : 0;
};

const frontOf = (settings: boolean, tasks: boolean): BackFrom => {
  if (settings) {
    return "settings";
  }

  return tasks ? "tasks" : "call";
};

const sheetOf = (split: boolean, regular: boolean): SettingsSheet => {
  if (split) {
    return "page";
  }

  return regular ? "form" : "phone";
};

const FADE = [{ color: theme.background }, { color: "transparent" }];
const FADE_BACKDROP = [{ color: theme.sheet }, { color: "transparent" }];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.sheet },
  backdrop: { backgroundColor: theme.sheet },
  card: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.background,
    overflow: "hidden",
    borderColor: theme.edge,
    borderCurve: "continuous",
  },
  sidebar: { position: "absolute", top: 0, bottom: 0 },
  edge: { position: "absolute", top: 0, bottom: 0, width: 20 },
  fill: { ...StyleSheet.absoluteFill },
  stage: { position: "absolute", top: 0, bottom: 0 },
  transcript: { position: "absolute" },
  words: { flex: 1 },
  fade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: metrics.fade,
    experimental_backgroundImage: [{ type: "linear-gradient", colorStops: FADE }],
  },
  fadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: metrics.fade,
    experimental_backgroundImage: [
      { type: "linear-gradient", direction: "to top", colorStops: FADE },
    ],
  },
  onBackdrop: {
    experimental_backgroundImage: [{ type: "linear-gradient", colorStops: FADE_BACKDROP }],
  },
  onBackdropBottom: {
    experimental_backgroundImage: [
      { type: "linear-gradient", direction: "to top", colorStops: FADE_BACKDROP },
    ],
  },
  orb: { position: "absolute", left: 0, top: 0 },
  dock: { position: "absolute" },
  agent: { position: "absolute", height: AGENT_ROW },
  controls: {
    position: "absolute",
    width: CONTROLS_BOX,
    height: metrics.call,
    alignItems: "center",
    justifyContent: "center",
  },
});
