import { DynamicColorIOS, StyleSheet, type ColorValue } from 'react-native';

import { color, type Tone } from '@/ui/tokens';

// iOS picks the side of each color that matches the system's appearance.
export const theme = Object.fromEntries(
  Object.entries(color).map(([tone, pair]) => [tone, DynamicColorIOS(pair)]),
) as Record<Tone, ColorValue>;

// One corner per kind of shape, the same in every pose and screen. Where something sits never
// changes how it's drawn.
export const radius = {
  // The call, rounding off against Calls or Tasks beside it.
  card: 44,
  // A grouped panel: settings, an ask on the call, the last check.
  group: 26,
  // What you said.
  bubble: 20,
  // A row or button you press, and a field you type in.
  control: 14,
  // A tag or a block of code inside something else.
  inner: 12,
} as const;

// The thinnest line the screen draws: a divider's.
export const hairline = StyleSheet.hairlineWidth;

// A circle is as round as half its size, whatever size it's drawn at.
export function circle(size: number) {
  return { width: size, height: size, borderRadius: size / 2 };
}
