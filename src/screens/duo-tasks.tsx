import { useEffect } from 'react';
import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { TasksPage } from '@/components/tasks-pane';
import { useKeyboardUp } from '@/hooks/use-keyboard-up';
import type { TasksProps } from '@/components/tasks/tasks-view';
import { motion } from '@/motion';
import type { Duo } from '@/screens/layout';

// iPhone Duo's Tasks as the call screen sees it, in the place it shares with settings. Open on a
// call, the switch in the bar can give the call's words the page before the fold, beside Tasks,
// until the call ends. Folding changes none of it. `covers` settles from 0 to 1 as the place covers
// the call's pages, and `aside` as the words move to the page before the fold. While the keyboard
// is up there Tasks types on that page instead (`above`), and the call's own page steps aside for
// it.
export function useDuoTasks(
  duo: Duo | undefined,
  { open, tasks, chosen }: { open: boolean; tasks: boolean; chosen: boolean },
  onCall: boolean,
  reducedMotion: boolean,
  choose: (on: boolean) => void,
) {
  const offered = !!duo?.beside && onCall && tasks;
  const beside = offered && chosen;
  const above = useKeyboardUp() && beside && !!duo?.beside?.typing;
  const callBeside = beside && !above;
  const covers = useSettle(!!duo && open && !callBeside, reducedMotion);
  const aside = useSettle(callBeside, reducedMotion);
  return {
    beside,
    above,
    offered,
    toggleBeside: () => choose(!beside),
    covers,
    aside,
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

// Tasks' pages. Tasks fades in where it sits as `pane` opens the place, while the place shows it
// (`shown`): moved by a transform, its Host would keep telling iOS accessibility where it started.
export function DuoTasks({
  duo,
  tasks,
  state,
  shown,
  pane,
}: {
  duo: Duo;
  tasks: TasksProps & { onClose: () => void };
  state: ReturnType<typeof useDuoTasks>;
  shown: boolean;
  pane: SharedValue<number>;
}) {
  const pageStyle = useAnimatedStyle(() => ({
    opacity: shown ? interpolate(pane.get(), [0.25, 1], [0, 1], Extrapolation.CLAMP) : 0,
  }));
  // Tasks keeps one page of the fold while the call's words take the other, or while it types.
  const half =
    (state.above && duo.beside?.typing) || (state.beside && duo.beside?.tasks) || undefined;
  return <TasksPage {...tasks} page={half ?? duo.tasks} whole={!half} style={pageStyle} />;
}
