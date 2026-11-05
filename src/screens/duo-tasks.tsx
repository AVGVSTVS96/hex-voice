import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, type KeyboardEvent } from 'react-native';
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
import { clock } from '@/live/calls';
import { motion } from '@/motion';
import { TIME, type Duo } from '@/screens/layout';
import { theme } from '@/theme';
import { HostedGlassButton } from '@/ui/glass-button';
import { metrics } from '@/ui/tokens';

// iPhone Duo's Tasks as the call screen sees it. While it's open on a call the call is docked in
// the bar, and open, the switch in the bar can give the call's words the page before the fold,
// beside Tasks, until the call ends. Folding changes none of it. `dock` settles from 0 to 1 as the
// call moves into the bar, `covers` as Tasks covers the call's pages, and `aside` as the words move
// to the page before the fold. While the keyboard is up there Tasks
// types on that page instead (`above`), and the call's own page steps aside for it.
export function useDuoTasks(
  duo: Duo | undefined,
  open: boolean,
  onCall: boolean,
  reducedMotion: boolean,
) {
  const [chosen, setChosen] = useState(false);
  const available = !!duo?.beside && onCall;
  if (chosen && !available) setChosen(false);
  const offered = available && open;
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
    toggleBeside: () => setChosen(!beside),
    dock,
    covers,
    aside,
    offer,
  };
}

// How much of the call's own page shows while Tasks covers it: gone by the time Tasks is halfway in.
export function uncovered(covers: number) {
  'worklet';
  return 1 - Math.min(1, 2 * covers);
}

// Whether this app's keyboard is up. iOS tells every app in Split View about the other's keyboard
// too, which sits over that app, not this one.
function useKeyboardUp() {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardWillShow', (event) => {
      if (ours(event)) setUp(true);
    });
    const hidden = Keyboard.addListener('keyboardWillHide', (event) => {
      if (ours(event)) setUp(false);
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return up;
}

function ours(event: KeyboardEvent) {
  return !('isEventFromThisApp' in event) || event.isEventFromThisApp;
}

function useSettle(on: boolean, reducedMotion: boolean) {
  const value = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    const to = on ? 1 : 0;
    value.set(reducedMotion ? withTiming(to, motion.reduced) : withSpring(to, motion.drawer));
  }, [on, reducedMotion, value]);
  return value;
}

// Tasks' pages, on a call the call's time by its docked orb, and the switch that gives the call's
// words their page beside Tasks, lit while they have it. Tasks fades in where it sits as `pane` opens it: moved by a
// transform, its Host would keep telling iOS accessibility where it started.
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
  // A fade only: a layer transform over the SwiftUI host leaves its controls' accessibility frames
  // where the slide began, so VoiceOver and taps by element miss ‹ Call.
  const pageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pane.get(), [0.25, 1], [0, 1], Extrapolation.CLAMP),
  }));
  const dockedStyle = useAnimatedStyle(() => ({ opacity: state.dock.get() }));
  const offerStyle = useAnimatedStyle(() => ({ opacity: state.offer.get() }));
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
            { left: button.x - metrics.tool / 2, top: button.y - metrics.tool / 2 },
            offerStyle,
          ]}
        >
          <HostedGlassButton
            icon={stacks ? 'beside-column' : 'beside-row'}
            label="Transcript beside Tasks"
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
