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
  tone: { dampingRatio: 1, duration: ms(220) },
  caption: { warm: ms(120), settled: ms(240) },
  // An agent's line: each step rises in over the last, and a finished task holds its line
  // long enough to read before it fades.
  agent: { step: ms(250), turn: 900, hold: 2400, rise: 6 },
  toolbar: ms(220),
  // The sidebar and a row's swipe settle with critically damped springs: no overshoot.
  drawer: { mass: 1, stiffness: 380, damping: 39 },
  row: { mass: 1, stiffness: 420, damping: 41 },
  rowOut: ms(220),
  page: Animation.smooth({ duration: ms(400) / 1000 }),
} as const;

// How the orb answers your voice at the reaction setting's `amount`: louder swells it, a higher
// pitch lifts it, and a brighter tone draws it a little taller and narrower.
export function heard(amount: number, size: number, level: number, pitch: number, tone: number) {
  'worklet';
  return [
    { translateY: -0.4 * amount * size * pitch },
    { scale: 1 + amount * level },
    { scaleX: 1 - 0.3 * amount * tone },
    { scaleY: 1 + 0.3 * amount * tone },
  ];
}
