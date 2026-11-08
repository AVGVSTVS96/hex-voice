import { requireNativeView } from 'expo';
import type { CommonViewModifierProps } from '@expo/ui/swift-ui';
import { createViewModifierEventListener } from '@expo/ui/swift-ui/modifiers';
import { processColor, type ColorValue } from 'react-native';

// An ask's screenshots as SwiftUI, one tile per option, in the tree Expo UI builds.
// A tap opens them full screen in Quick Look. Each is read from hex with `headers`; the look comes
// from the caller: the tiles' height, gap and corners in points, and the colors.
export type ShotsProps = CommonViewModifierProps & {
  uris: string[];
  shapes: number[];
  labels: string[];
  headers: Record<string, string>;
  height: number;
  gap: number;
  radius: number;
  secondary: ColorValue;
  surface: ColorValue;
  edge: ColorValue;
};

type Colors = Pick<ShotsProps, 'secondary' | 'surface' | 'edge'>;
type NativeProps = Omit<ShotsProps, keyof Colors> & {
  [Color in keyof Colors]: ReturnType<typeof processColor>;
};

const Native =
  process.env.EXPO_OS === 'ios' ? requireNativeView<NativeProps>('Shots', 'ShotsView') : null;

export const ShotsView = ({ modifiers, secondary, surface, edge, ...rest }: ShotsProps) => {
  if (!Native) return null;
  return (
    <Native
      modifiers={modifiers}
      {...(modifiers ? createViewModifierEventListener(modifiers) : undefined)}
      secondary={processColor(secondary)}
      surface={processColor(surface)}
      edge={processColor(edge)}
      {...rest}
    />
  );
};
