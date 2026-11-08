import { DynamicColorIOS, StyleSheet } from 'react-native';
import type { ColorValue } from 'react-native';

import { color, film } from '@/ui/tokens';
import type { Tone } from '@/ui/tokens';

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: fromEntries maps every entry of color, so it holds each Tone
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
