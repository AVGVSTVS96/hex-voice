import { requireNativeView } from 'expo';
import type { CommonViewModifierProps } from '@expo/ui/swift-ui';
import { createViewModifierEventListener } from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';

// Pages laid out by SwiftUI from the width it gives them: two side by side where each side of the
// middle, moved `meet` along, has room for `page`, or else one at a time. `pages` names each child's
// level, and `one` and `two` the levels each way shows, the deepest last.
export type PagesProps = CommonViewModifierProps & {
  pages: string[];
  one: string[];
  two: string[];
  page: number;
  meet: number;
  children: ReactNode;
};

const Native =
  process.env.EXPO_OS === 'ios' ? requireNativeView<PagesProps>('Pages', 'PagesView') : null;

export function PagesView({ modifiers, ...rest }: PagesProps) {
  if (!Native) return null;
  return (
    <Native
      modifiers={modifiers}
      {...(modifiers ? createViewModifierEventListener(modifiers) : undefined)}
      {...rest}
    />
  );
}
