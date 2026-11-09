import type { CommonViewModifierProps } from "@expo/ui/swift-ui";
import { createViewModifierEventListener } from "@expo/ui/swift-ui/modifiers";
import { requireNativeView } from "expo";
import type { ComponentType, ReactNode } from "react";
import type { ColorValue } from "react-native";

export type FitsProps = CommonViewModifierProps & { children: ReactNode };

export type EvenRowProps = CommonViewModifierProps & { spacing: number; children: ReactNode };

export type LaneProps = CommonViewModifierProps & {
  spans: { from: number; to: number }[];
  failures: number[];
  line: ColorValue;
  work: ColorValue;
  failure: ColorValue;
};

export type ProseProps = CommonViewModifierProps & {
  runs: { text: string; strong: boolean }[];
  style: "body" | "subheadline" | "footnote";
  size: number;
  medium: boolean;
  color: ColorValue;
  lineSpacing: number;
  lines: number;
};

const view = <Props extends CommonViewModifierProps>(name: string): ComponentType<Props> => {
  const Native = process.env.EXPO_OS === "ios" ? requireNativeView<Props>("Rows", name) : null;

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

export const Fits = view<FitsProps>("FitsView");
export const EvenRow = view<EvenRowProps>("EvenRowView");
export const Lane = view<LaneProps>("LaneView");
export const ProseText = view<ProseProps>("ProseView");
