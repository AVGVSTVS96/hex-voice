import { Animation } from "@expo/ui/swift-ui/modifiers";
import { Easing } from "react-native-reanimated";

const TEMPO = 1.1;
const ms = (duration: number) => Math.round(duration / TEMPO);

export const motion = {
  glide: { ease: 18 * TEMPO, snap: 60 * TEMPO },
  reduced: { duration: ms(200) },
  wake: { dampingRatio: 0.45, duration: ms(700) },
  settle: { easing: Easing.inOut(Easing.quad), connecting: ms(450), asleep: ms(900) },
  breath: { duration: 2600, easing: Easing.inOut(Easing.sin), out: ms(400) },
  reaction: { dampingRatio: 0.55, duration: ms(220) },
  tone: { dampingRatio: 1, duration: ms(220) },
  caption: { warm: ms(120), settled: ms(240) },
  agent: { step: ms(250), turn: 900, hold: 2400, rise: 6 },
  toolbar: ms(220),
  drawer: { mass: 1, stiffness: 380, damping: 39 },
  row: { mass: 1, stiffness: 420, damping: 41 },
  rowOut: ms(220),
  page: Animation.smooth({ duration: ms(400) / 1000 }),
  list: Animation.smooth({ duration: ms(380) / 1000 }),
} as const;

export const heard = (amount: number, size: number, level: number, pitch: number, tone: number) => {
  "worklet";

  return [
    { translateY: -0.4 * amount * size * pitch },
    { scale: 1 + amount * level },
    { scaleX: 1 - 0.3 * amount * tone },
    { scaleY: 1 + 0.3 * amount * tone },
  ];
};

export const rowsKey = (rows: string[]) => {
  let key = 0;

  for (const char of rows.join("\n")) {
    // oxlint-disable-next-line no-bitwise, unicorn/prefer-math-trunc, unicorn/prefer-code-point -- Java's String.hashCode: | 0 wraps to 32 bits, which Math.trunc doesn't, over UTF-16 units
    key = (Math.imul(key, 31) + char.charCodeAt(0)) | 0;
  }

  return key;
};
