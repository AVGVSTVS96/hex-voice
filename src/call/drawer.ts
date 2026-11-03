import { useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion } from '@/motion';

// Calls comes in from the leading edge and follows the finger: `drawer` runs 0 (shut) to 1 (open),
// and letting go settles it open or shut with a flick or past halfway. The pans open it from the
// screen's edge, close it from the list, and close it from the call it peeks over, where a tap
// closes it too.
export function useDrawer({
  open: initially,
  width,
  reducedMotion,
  onChange,
}: {
  open: boolean;
  width: number;
  reducedMotion: boolean;
  onChange: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(initially);
  const drawer = useSharedValue(initially ? 1 : 0);
  const from = useSharedValue(0);
  const opened = (now: boolean) => {
    setOpen(now);
    onChange(now);
  };
  const settle = (now: boolean, velocity = 0) => {
    'worklet';
    drawer.set(
      reducedMotion
        ? withTiming(now ? 1 : 0, motion.reduced)
        : withSpring(now ? 1 : 0, { ...motion.drawer, velocity: velocity / width }),
    );
    scheduleOnRN(opened, now);
  };
  const pan = (offset: number | [number, number]) =>
    Gesture.Pan()
      .activeOffsetX(offset)
      .failOffsetY([-14, 14])
      .onStart(() => {
        'worklet';
        cancelAnimation(drawer);
        from.set(drawer.get());
      })
      .onUpdate(({ translationX }) => {
        'worklet';
        drawer.set(Math.min(1, Math.max(0, from.get() + translationX / width)));
      })
      .onEnd(({ velocityX }) => {
        'worklet';
        settle(velocityX > 400 || (velocityX > -400 && drawer.get() > 0.5), velocityX);
      });
  return {
    drawer,
    open,
    settle,
    edgeOpen: pan(12),
    listClose: pan(-16),
    peekClose: Gesture.Race(
      pan([-10, 10]),
      Gesture.Tap().onEnd(() => {
        'worklet';
        settle(false);
      }),
    ),
  };
}
