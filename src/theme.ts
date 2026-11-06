import { DynamicColorIOS, StyleSheet, type ColorValue } from 'react-native';

import { color, type Tone } from '@/ui/tokens';

// iOS picks the side of each color that matches the system's appearance.
export const theme = Object.fromEntries(
  Object.entries(color).map(([tone, pair]) => [tone, DynamicColorIOS(pair)]),
) as Record<Tone, ColorValue>;

// The thinnest line the screen draws: a divider's.
export const hairline = StyleSheet.hairlineWidth;

// A circle is as round as half its size, whatever size it's drawn at.
export function circle(size: number) {
  return { width: size, height: size, borderRadius: size / 2 };
}
