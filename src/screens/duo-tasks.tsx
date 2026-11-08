import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { TasksPage } from '@/components/tasks-pane';
import { useKeyboardUp } from '@/hooks/use-keyboard-up';
import type { TasksProps } from '@/components/tasks/tasks-view';
import { clock } from '@/live/calls';
import { motion } from '@/motion';
import { TIME } from '@/screens/layout';
import type { Duo } from '@/screens/layout';
import { theme } from '@/theme';
import { AnimatedView } from '@/ui/animated-view';
import { HostedGlassButton } from '@/ui/glass-button';
import { metrics } from '@/ui/tokens';

// iPhone Duo's Tasks as the call screen sees it, in the place it shares with settings. While the
// place is open on a call the call is docked in the bar, and open, the switch in the bar can give
// the call's words the page before the fold, beside Tasks, until the call ends. Folding changes none
// of it. `dock` settles from 0 to 1 as the call moves into the bar, `covers` as the place covers the
// call's pages, and `aside` as the words move to the page before the fold. While the keyboard is up
// there Tasks types on that page instead (`above`), and the call's own page steps aside for it.
export const useDuoTasks = (
  duo: Duo | undefined,
  { open, tasks, chosen }: { open: boolean; tasks: boolean; chosen: boolean },
  onCall: boolean,
  reducedMotion: boolean,
  choose: (on: boolean) => void,
) => {
  const offered = !!duo?.beside && onCall && tasks;
  const docked = !!duo && open && onCall;
  const beside = offered && chosen;
  const above = useKeyboardUp() && beside && !!duo?.beside?.typing;
  const callBeside = beside && !above;
  const dock = useSettle(docked, reducedMotion);
  const covers = useSettle(!!duo && open && !callBeside, reducedMotion);
  const aside = useSettle(callBeside, reducedMotion);
  const offer = useSettle(offered, reducedMotion);
  return {
    docked,
    beside,
    above,
    offered,
    toggleBeside: () => {
      choose(!beside);
    },
    dock,
    covers,
    aside,
    offer,
  };
};

// How much of the call's own page shows while Tasks covers it: gone by the time Tasks is halfway in.
export const uncovered = (covers: number) => {
  'worklet';
  return 1 - Math.min(1, 2 * covers);
};

const useSettle = (on: boolean, reducedMotion: boolean) => {
  const value = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    const to = on ? 1 : 0;
    value.set(reducedMotion ? withTiming(to, motion.reduced) : withSpring(to, motion.drawer));
  }, [on, reducedMotion, value]);
  return value;
};

// Tasks' pages, on a call the call's time by its docked orb, and the switch that gives the call's
// words their page beside Tasks, lit while they have it. Tasks fades in where it sits as `pane` opens
// the place, while the place shows it (`shown`): moved by a transform, its Host would keep telling iOS
// accessibility where it started.
export const DuoTasks = ({
  duo,
  tasks,
  state,
  shown,
  onCall,
  seconds,
  pane,
}: {
  duo: Duo;
  tasks: TasksProps & { onClose: () => void };
  state: ReturnType<typeof useDuoTasks>;
  shown: boolean;
  onCall: boolean;
  seconds: number;
  pane: SharedValue<number>;
}) => {
  // A fade only: a layer transform over the SwiftUI host leaves its controls' accessibility frames
  // where the slide began, so VoiceOver and taps by element miss ‹ Call.
  const pageStyle = useAnimatedStyle(() => ({
    opacity: shown ? interpolate(pane.get(), [0.25, 1], [0, 1], Extrapolation.CLAMP) : 0,
  }));
  const dockedStyle = useAnimatedStyle(() => ({ opacity: state.dock.get() }));
  const offerFade = () => {
    'worklet';
    return { opacity: state.offer.get() };
  };
  const { time } = duo.call;
  const button = duo.beside?.button;
  // The switch shows what it does: the call and Tasks side by side, or one over the other.
  const stacks = !!duo.beside && duo.beside.tasks.area.y > duo.tasks.area.y;
  return (
    <>
      <TasksPage
        {...tasks}
        page={
          (state.above && duo.beside?.typing) || (state.beside && duo.beside?.tasks) || duo.tasks
        }
        style={pageStyle}
      />
      <Animated.Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.time,
          { left: time.x, top: time.y, width: time.width, textAlign: time.align },
          dockedStyle,
        ]}
      >
        {onCall ? clock(seconds * 1000) : ''}
      </Animated.Text>
      {button && (
        <AnimatedView
          pointerEvents={state.offered ? 'box-none' : 'none'}
          accessibilityElementsHidden={!state.offered}
          importantForAccessibility={state.offered ? 'auto' : 'no-hide-descendants'}
          style={[
            styles.button,
            { left: button.x - metrics.tool / 2, top: button.y - metrics.tool / 2 },
          ]}
          animate={offerFade}
        >
          <HostedGlassButton
            icon={stacks ? 'beside-column' : 'beside-row'}
            label="Transcript beside Tasks"
            testID="transcript-beside-button"
            selected={state.beside}
            onPress={state.toggleBeside}
          />
        </AnimatedView>
      )}
    </>
  );
};

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
