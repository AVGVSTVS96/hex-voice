import type { CommonViewModifierProps } from "@expo/ui/swift-ui";
import { requireNativeView } from "expo";
import type { ReactNode } from "react";

export type ColumnProps = CommonViewModifierProps & {
  top: number;
  clear: number;
  children: ReactNode;
};

export const ColumnView =
  process.env.EXPO_OS === "ios" ? requireNativeView<ColumnProps>("Column", "ColumnView") : null;
