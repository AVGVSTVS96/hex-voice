import { requireNativeView } from 'expo';
import type { CommonViewModifierProps } from '@expo/ui/swift-ui';
import type { ReactNode } from 'react';

// iPhone Duo's side column, laid out by SwiftUI from what covers the screen: its first child at
// the top, at least `top` down, and its last at the foot, `clear` above what covers it.
export type ColumnProps = CommonViewModifierProps & {
  top: number;
  clear: number;
  children: ReactNode;
};

export const ColumnView =
  process.env.EXPO_OS === 'ios' ? requireNativeView<ColumnProps>('Column', 'ColumnView') : null;
