import { Animation } from '@expo/ui/swift-ui/modifiers';
import { Easing } from 'react-native-reanimated';

// The app's pace: every transition below gets faster as this goes up. Durations divide by it and
// the orb's glide speed multiplies by it. Ambient loops like the sleeping breath stay calm.
const TEMPO = 1.1;
const ms = (duration: number) => Math.round(duration / TEMPO);

export const motion = {
  // The orb's pull-down glide is a critically damped spring: `ease` is its slowest natural
  // frequency, and a fast flick can raise it as far as `snap`.
  glide: { ease: 18 * TEMPO, snap: 60 * TEMPO },
  reduced: { duration: ms(200) },
  wake: { dampingRatio: 0.45, duration: ms(700) },
  settle: { easing: Easing.inOut(Easing.quad), connecting: ms(450), asleep: ms(900) },
  breath: { duration: 2600, easing: Easing.inOut(Easing.sin), out: ms(400) },
  reaction: { dampingRatio: 0.55, duration: ms(220) },
  caption: { warm: ms(120), settled: ms(240) },
  page: Animation.smooth({ duration: ms(400) / 1000 }),
} as const;
