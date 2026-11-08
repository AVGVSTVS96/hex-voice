import { useEffect, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  useAnimatedReaction,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { motion } from '@/motion';

const OMEGA = Math.sqrt(motion.drawer.stiffness / motion.drawer.mass);

// Calls comes in from the leading edge and follows the finger: `drawer` runs 0 (shut) to 1 (open),
// and letting go settles it open or shut with a flick or past halfway. Whether it's open belongs to
// the screen: the drawer settles wherever `open` says, and its pans only tell the screen where they
// let go (`onChange`). They open it from the screen's edge, close it from the list, and close it
// from the call it peeks over, where a tap closes it too. `out` is whether any of it is in view.
export const useDrawer = ({
  open,
  width,
  reducedMotion,
  onChange,
}: {
  open: boolean;
  width: number;
  reducedMotion: boolean;
  onChange: (open: boolean) => void;
}) => {
  const drawer = useSharedValue(open ? 1 : 0);
  const target = useSharedValue(open);
  const from = useSharedValue(0);
  const [out, setOut] = useState(open);
  useAnimatedReaction(
    () => drawer.get() > 0,
    (now, before) => {
      if (now !== before) scheduleOnRN(setOut, now);
    },
  );
  // The spring is critically damped, so it comes to rest without passing its end unless it starts
  // faster than its natural frequency times the way left. A faster fling is held to that.
  const settle = (now: boolean, velocity = 0) => {
    'worklet';
    target.set(now);
    const most = OMEGA * Math.abs((now ? 1 : 0) - drawer.get());
    drawer.set(
      reducedMotion
        ? withTiming(now ? 1 : 0, motion.reduced)
        : withSpring(now ? 1 : 0, {
            ...motion.drawer,
            velocity: Math.min(most, Math.max(-most, velocity / width)),
          }),
    );
  };
  const letGo = (now: boolean, velocity = 0) => {
    'worklet';
    settle(now, velocity);
    scheduleOnRN(onChange, now);
  };
  useEffect(() => {
    if (target.get() !== open) settle(open);
  }, [open]);
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
        letGo(velocityX > 400 || (velocityX > -400 && drawer.get() > 0.5), velocityX);
      });
  return {
    drawer,
    out,
    edgeOpen: pan(12),
    listClose: pan(-16),
    peekClose: Gesture.Race(
      pan([-10, 10]),
      Gesture.Tap().onEnd(() => {
        'worklet';
        letGo(false);
      }),
    ),
  };
};
