import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { TasksPage } from '@/components/tasks-pane';
import type { TasksProps } from '@/components/tasks/tasks-view';
import { VoiceControl } from '@/components/voice-control';
import { clock } from '@/live/calls';
import { motion } from '@/motion';
import { TIME, TOOL, type Duo } from '@/screens/layout';
import { theme } from '@/theme';

// iPhone Duo's Tasks as the call screen sees it. While it's open on a call the call is docked in
// the bar. Open, the call can take the page before the fold, beside Tasks: on a call, or before one
// while the Duo is partly open, where it starts that way. The switch in the bar picks otherwise
// until the call ends or the Duo folds or flattens. `dock` settles from 0 to 1 as the call moves
// into the bar, `covers` as Tasks covers the orb's page, `hides` as it covers the words, and
// `aside` as the words move to the page before the fold.
export function useDuoTasks(
  duo: Duo | undefined,
  open: boolean,
  onCall: boolean,
  reducedMotion: boolean,
) {
  const partlyOpen = !!duo?.partlyOpen;
  const [chosen, setChosen] = useState<{ partlyOpen: boolean; beside: boolean }>();
  const available = !!duo?.beside && (onCall || partlyOpen);
  if (chosen && (chosen.partlyOpen !== partlyOpen || !available)) setChosen(undefined);
  const offered = available && open;
  const docked = !!duo && open && onCall;
  const beside = offered && (chosen?.beside ?? partlyOpen);
  const dock = useSettle(docked, reducedMotion);
  const covers = useSettle(!!duo && open && !beside, reducedMotion);
  const hides = useSettle(!!duo && open && !(beside && docked), reducedMotion);
  const aside = useSettle(beside && docked, reducedMotion);
  const offer = useSettle(offered, reducedMotion);
  return {
    docked,
    beside,
    offered,
    toggleBeside: () => setChosen({ partlyOpen, beside: !beside }),
    dock,
    covers,
    hides,
    aside,
    offer,
  };
}

// How much of the call's own page shows while Tasks covers it: gone by the time Tasks is halfway in.
export function uncovered(covers: number) {
  'worklet';
  return 1 - Math.min(1, 2 * covers);
}

function useSettle(on: boolean, reducedMotion: boolean) {
  const value = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    const to = on ? 1 : 0;
    value.set(reducedMotion ? withTiming(to, motion.reduced) : withSpring(to, motion.drawer));
  }, [on, reducedMotion, value]);
  return value;
}

// Tasks' pages, on a call the call's time by its docked orb, and the switch that gives the call its
// page beside Tasks, lit while it has it. Tasks slides in as `pane` opens it.
export function DuoTasks({
  duo,
  tasks,
  state,
  onCall,
  seconds,
  pane,
}: {
  duo: Duo;
  tasks: TasksProps & { onClose: () => void };
  state: ReturnType<typeof useDuoTasks>;
  onCall: boolean;
  seconds: number;
  pane: SharedValue<number>;
}) {
  const pageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pane.get(), [0.25, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: (1 - pane.get()) * 48 }],
  }));
  const dockedStyle = useAnimatedStyle(() => ({ opacity: state.dock.get() }));
  const offerStyle = useAnimatedStyle(() => ({ opacity: state.offer.get() }));
  const { time } = duo.call;
  const button = duo.beside?.button;
  return (
    <>
      <TasksPage
        {...tasks}
        page={(state.beside && duo.beside?.tasks) || duo.tasks}
        style={pageStyle}
      />
      {onCall && (
        <Animated.Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.time,
            { left: time.x, top: time.y, width: time.width, textAlign: time.align },
            dockedStyle,
          ]}
        >
          {clock(seconds * 1000)}
        </Animated.Text>
      )}
      {button && (
        <Animated.View
          pointerEvents={state.offered ? 'box-none' : 'none'}
          accessibilityElementsHidden={!state.offered}
          importantForAccessibility={state.offered ? 'auto' : 'no-hide-descendants'}
          style={[
            styles.button,
            { left: button.x - TOOL / 2, top: button.y - TOOL / 2 },
            offerStyle,
          ]}
        >
          <VoiceControl
            icon="transcript"
            label={onCall ? 'Transcript beside Tasks' : 'Call beside Tasks'}
            testID="transcript-beside-button"
            selected={state.beside}
            onPress={state.toggleBeside}
          />
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  time: {
    position: 'absolute',
    height: TIME,
    color: theme.secondary,
    fontSize: 12,
    lineHeight: TIME,
    fontVariant: ['tabular-nums'],
  },
  button: { position: 'absolute' },
});
