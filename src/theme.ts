import { DynamicColorIOS, StyleSheet, type ColorValue } from 'react-native';

import { color, film, type Tone } from '@/ui/tokens';

// iOS picks the side of each color that matches the system's appearance.
export const theme = Object.fromEntries(
  Object.entries(color).map(([tone, pair]) => [tone, DynamicColorIOS(pair)]),
) as Record<Tone, ColorValue>;

// The thinnest line the screen draws: a divider's.
export const hairline = StyleSheet.hairlineWidth;

// A photo's edge, as Photos draws one: no frame, only a bevel the picture seems to spill over,
// catching light along its top and falling into shade along its foot. It's one pixel at under half
// strength, which reads as half a pixel: a thinner line iOS rounds away.
export const bevel = {
  width: hairline,
  ...film.edge,
  // The same edge as a SwiftUI gradient, top to foot.
  gradient: {
    type: 'linearGradient' as const,
    colors: [film.edge.light, film.edge.side, film.edge.shade],
    startPoint: { x: 0.5, y: 0 },
    endPoint: { x: 0.5, y: 1 },
  },
};

// A circle is as round as half its size, whatever size it's drawn at.
export const circle = (size: number) => ({ width: size, height: size, borderRadius: size / 2 });
