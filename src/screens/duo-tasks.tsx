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
import { BAR_TIME } from '@/screens/layout';
import type { Duo } from '@/screens/layout';
import { theme } from '@/theme';
import { AnimatedView } from '@/ui/animated-view';
import { HostedGlassButton } from '@/ui/glass-button';
import { metrics } from '@/ui/tokens';

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
  const stacks = !!duo.beside && duo.beside.tasks.area.y > duo.tasks.area.y;

  return (
    <>
      <TasksPage {...tasks} page={pageOf(duo, state)} style={pageStyle} />
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

const pageOf = (duo: Duo, { above, beside }: { above: boolean; beside: boolean }) => {
  if (above && duo.beside?.typing) {
    return duo.beside.typing;
  }

  if (beside && duo.beside) {
    return duo.beside.tasks;
  }

  return duo.tasks;
};

const styles = StyleSheet.create({
  time: {
    position: 'absolute',
    height: BAR_TIME,
    color: theme.secondary,
    fontSize: 12,
    lineHeight: BAR_TIME,
    fontVariant: ['tabular-nums'],
  },
  button: { position: 'absolute' },
});
