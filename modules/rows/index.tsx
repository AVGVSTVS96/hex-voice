import { requireNativeView } from 'expo';
import type { CommonViewModifierProps } from '@expo/ui/swift-ui';
import { createViewModifierEventListener } from '@expo/ui/swift-ui/modifiers';
import type { ComponentType, ReactNode } from 'react';
import type { ColorValue } from 'react-native';

// SwiftUI views Tasks' rows lay out with from the width SwiftUI gives them, so a row's shape is
// settled in the layout pass a turn, a fold or Split View makes, never by a width read in JS.

// The first child whose own width fits, else the last; a lone child only where it fits.
export type FitsProps = CommonViewModifierProps & { children: ReactNode };

// Children side by side, as wide as each other, fitting only where each fits its share.
export type EvenRowProps = CommonViewModifierProps & { spacing: number; children: ReactNode };

// A lane across the width it's given, its marks at shares of that width.
export type LaneProps = CommonViewModifierProps & {
  spans: { from: number; to: number }[];
  failures: number[];
  line: ColorValue;
  work: ColorValue;
  failure: ColorValue;
};

const view = <Props extends CommonViewModifierProps>(name: string): ComponentType<Props> => {
  const Native = process.env.EXPO_OS === 'ios' ? requireNativeView<Props>('Rows', name) : null;

  const Rows = (props: Props) => {
    if (!Native) {
      return null;
    }

    return (
      <Native
        {...props}
        {...(props.modifiers ? createViewModifierEventListener(props.modifiers) : undefined)}
      />
    );
  };

  return Rows;
};

export const Fits = view<FitsProps>('FitsView');
export const EvenRow = view<EvenRowProps>('EvenRowView');
export const Lane = view<LaneProps>('LaneView');
