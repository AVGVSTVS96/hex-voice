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
      if (now !== before) {
        scheduleOnRN(setOut, now);
      }
    },
  );

  const settle = (now: boolean, velocity = 0) => {
    'worklet';
    target.set(now);
    const noOvershoot = OMEGA * Math.abs((now ? 1 : 0) - drawer.get());
    drawer.set(
      reducedMotion
        ? withTiming(now ? 1 : 0, motion.reduced)
        : withSpring(now ? 1 : 0, {
            ...motion.drawer,
            velocity: Math.min(noOvershoot, Math.max(-noOvershoot, velocity / width)),
          }),
    );
  };

  const letGo = (now: boolean, velocity = 0) => {
    'worklet';
    settle(now, velocity);
    scheduleOnRN(onChange, now);
  };

  useEffect(() => {
    if (target.get() !== open) {
      settle(open);
    }
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
