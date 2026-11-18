import type { CommonViewModifierProps } from "@expo/ui/swift-ui";
import { createViewModifierEventListener } from "@expo/ui/swift-ui/modifiers";
import { requireNativeView } from "expo";
import type { ReactNode } from "react";
import type { ColorValue } from "react-native";

export type Shape = "one" | "columns" | "panes";

export interface Columns {
  from: number;
  share: number;
  least: number;
  most: number;
}

export type PagesProps = CommonViewModifierProps & {
  pages: string[];
  one: string[];
  two: string[];
  columns: string[];
  page: number;
  meet: number;
  column: Columns;
  behind: number;
  edge: ColorValue;
  onShape: (shape: Shape) => void;
  children: ReactNode;
};

type NativeProps = Omit<PagesProps, "onShape"> & {
  onShape: (event: { nativeEvent: { shape: Shape } }) => void;
};

const Native =
  process.env.EXPO_OS === "ios" ? requireNativeView<NativeProps>("Pages", "PagesView") : null;

export const PagesView = ({ modifiers, onShape, ...rest }: PagesProps) => {
  if (!Native) {
    return null;
  }

  return (
    <Native
      {...(modifiers && { modifiers, ...createViewModifierEventListener(modifiers) })}
      {...rest}
      onShape={({ nativeEvent }) => {
        onShape(nativeEvent.shape);
      }}
    />
  );
};
