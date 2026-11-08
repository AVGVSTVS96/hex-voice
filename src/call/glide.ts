import { useEffect } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  useAnimatedReaction,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { motion } from "@/motion";

const COMMIT = 0.35;
const FLICK = 500;
const RUBBER_BAND = 44;
const LANDED = 2;

const bandOf = (over: number, limit: number) => {
  "worklet";

  return limit * (1 - 1 / ((over * 0.55) / limit + 1));
};

const rubberBanded = (raw: number, limit: number) => {
  "worklet";

  if (raw < 0) {
    return -bandOf(-raw, limit);
  }

  return raw > 1 ? 1 + bandOf(raw - 1, limit) : raw;
};

const landingOf = (velocity: number, from: number, crossed: boolean) => {
  "worklet";

  if (velocity > FLICK) {
    return 1;
  }

  if (velocity < -FLICK) {
    return 0;
  }

  return crossed ? 1 - from : from;
};

const snapped = (p: number) => {
  "worklet";

  return p < 0.5 ? 0 : 1;
};

const arcOf = (t: number) => {
  "worklet";

  if (t <= 0) {
    return 0;
  }

  return t <= 1 ? t * t : 2 * t - 1;
};

interface Glide {
  reading: boolean;
  travel: number;
  reach: number;
  reducedMotion: boolean;
  onCross: () => void;
  onLand: () => void;
  onRelease: (reading: boolean) => void;
}

export const useGlide = ({
  reading,
  travel,
  reach,
  reducedMotion,
  onCross,
  onLand,
  onRelease,
}: Glide) => {
  const progress = useSharedValue(reading ? 1 : 0);
  const goal = useSharedValue(reading ? 1 : 0);
  const grab = useSharedValue({ offset: 0, line: COMMIT, crossed: false });
  const landing = useSharedValue(-1);

  const glideTo = (target: number, velocity = 0) => {
    "worklet";
    goal.set(target);
    landing.set(target);

    if (reducedMotion) {
      progress.set(withTiming(target, motion.reduced));

      return;
    }

    const distance = Math.abs(target - progress.get());
    const direction = Math.sign(target - progress.get());
    const toward = Math.max(0, direction * velocity);

    const omega = Math.min(
      Math.max(motion.glide.ease, toward / (distance || 1)),
      motion.glide.snap,
    );

    progress.set(
      withSpring(target, {
        mass: 1,
        stiffness: omega * omega,
        damping: 2 * omega,
        velocity: direction * Math.min(toward, omega * distance),
      }),
    );
  };

  useEffect(() => {
    const target = reading ? 1 : 0;

    if (goal.get() !== target) {
      glideTo(target);
    }
  }, [reading]);

  useAnimatedReaction(
    () => progress.get(),
    (now) => {
      const target = landing.get();

      if (target >= 0 && Math.abs(now - target) * reach <= LANDED) {
        landing.set(-1);
        scheduleOnRN(onLand);
      }
    },
  );

  const drag = () =>
    // oxlint-disable-next-line typescript/no-deprecated -- Gesture Handler 3 deprecates its Gesture builder for hook gestures, whose timing needs a check on a device before this moves
    Gesture.Pan()
      .activeOffsetY([-12, 12])
      .onStart(({ translationY }) => {
        "worklet";
        cancelAnimation(progress);
        landing.set(-1);
        const now = progress.get();
        grab.set({
          offset: now - translationY / travel,
          line: goal.get() === 0 ? now + COMMIT : now - COMMIT,
          crossed: false,
        });
      })
      .onUpdate(({ translationY }) => {
        "worklet";
        const { offset, line, crossed } = grab.get();
        const raw = offset + translationY / travel;
        progress.set(rubberBanded(raw, RUBBER_BAND / travel));
        const past = goal.get() === 0 ? raw >= line : raw <= line;

        if (past !== crossed) {
          grab.set({ offset, line, crossed: past });
          scheduleOnRN(onCross);
        }
      })
      .onEnd(({ velocityY }) => {
        "worklet";
        const target = landingOf(velocityY, goal.get(), grab.get().crossed);

        glideTo(target, velocityY / travel);
        scheduleOnRN(onRelease, target === 1);
      });

  const glide = (p: number) => {
    "worklet";
    const t = reducedMotion ? snapped(p) : p;

    return { t, arc: arcOf(t) };
  };

  return { progress, glideTo, drag, glide };
};
