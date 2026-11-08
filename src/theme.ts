import { DynamicColorIOS, StyleSheet } from 'react-native';
import type { ColorValue } from 'react-native';

import { color, film } from '@/ui/tokens';
import type { Tone } from '@/ui/tokens';

// SAFETY: fromEntries maps every entry of color, so it holds each Tone.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.entries drops color's keys, so the Tone record needs this assertion
export const theme = Object.fromEntries(
  Object.entries(color).map(([tone, pair]) => [tone, DynamicColorIOS(pair)]),
) as Record<Tone, ColorValue>;

export const hairline = StyleSheet.hairlineWidth;

export const bevel = {
  width: hairline,
  ...film.edge,
  gradient: {
    type: 'linearGradient' as const,
    colors: [film.edge.light, film.edge.side, film.edge.shade],
    startPoint: { x: 0.5, y: 0 },
    endPoint: { x: 0.5, y: 1 },
  },
};

export const circle = (size: number) => ({ width: size, height: size, borderRadius: size / 2 });
