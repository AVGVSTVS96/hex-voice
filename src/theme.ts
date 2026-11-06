import { DynamicColorIOS, StyleSheet, type ColorValue } from 'react-native';

import { color, metrics, type Tone } from '@/ui/tokens';

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
  // A thread's composer, as round as a capsule while it holds one line.
  field: metrics.field / 2,
  // A tag or a block of code inside something else.
  inner: 12,
  // A photo or clip you sent, and one waiting to go.
  media: 18,
  waiting: 12,
} as const;

// The thinnest line the screen draws: a divider's.
export const hairline = StyleSheet.hairlineWidth;

// A photo's edge, as Photos draws one: no frame, only a bevel half a pixel wide that the picture
// seems to spill over, catching light along its top and falling into shade along its foot.
export const bevel = {
  width: hairline / 2,
  light: theme.bevelLight,
  side: theme.bevelSide,
  shade: theme.bevelShade,
  // The same edge as a SwiftUI gradient, top to foot.
  gradient: {
    type: 'linearGradient' as const,
    colors: [theme.bevelLight, theme.bevelSide, theme.bevelShade],
    startPoint: { x: 0.5, y: 0 },
    endPoint: { x: 0.5, y: 1 },
  },
};

// A circle is as round as half its size, whatever size it's drawn at.
export function circle(size: number) {
  return { width: size, height: size, borderRadius: size / 2 };
}
