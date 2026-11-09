import type { CommonViewModifierProps } from "@expo/ui/swift-ui";
import { createViewModifierEventListener } from "@expo/ui/swift-ui/modifiers";
import { requireNativeView } from "expo";
import type { ReactNode } from "react";

export type PagesProps = CommonViewModifierProps & {
  pages: string[];
  one: string[];
  two: string[];
  page: number;
  meet: number;
  onPaired: (paired: boolean) => void;
  children: ReactNode;
};

type NativeProps = Omit<PagesProps, "onPaired"> & {
  onPaired: (event: { nativeEvent: { paired: boolean } }) => void;
};

const Native =
  process.env.EXPO_OS === "ios" ? requireNativeView<NativeProps>("Pages", "PagesView") : null;

export const PagesView = ({ modifiers, onPaired, ...rest }: PagesProps) => {
  if (!Native) {
    return null;
  }

  return (
    <Native
      {...(modifiers && { modifiers, ...createViewModifierEventListener(modifiers) })}
      {...rest}
      onPaired={({ nativeEvent }) => {
        onPaired(nativeEvent.paired);
      }}
    />
  );
};
