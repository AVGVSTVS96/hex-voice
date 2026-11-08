import type { CommonViewModifierProps } from "@expo/ui/swift-ui";
import { createViewModifierEventListener } from "@expo/ui/swift-ui/modifiers";
import { requireNativeView } from "expo";
import { processColor } from "react-native";
import type { ColorValue, NativeSyntheticEvent } from "react-native";

export type MarkdownProps = CommonViewModifierProps & {
  markdown: string;
  inline?: boolean;
  lines?: number;
  selectable?: boolean;
  size: number;
  leading: number;
  gap: number;
  radius: number;
  color: ColorValue;
  secondary: ColorValue;
  edge: ColorValue;
  surface: ColorValue;
  accent: ColorValue;
  onLink: (url: string) => void;
};

type NativeProps = Omit<MarkdownProps, keyof Colors | "onLink"> & {
  [Color in keyof Colors]: ReturnType<typeof processColor>;
} & { onLink: (event: NativeSyntheticEvent<{ url: string }>) => void };

type Colors = Pick<MarkdownProps, "color" | "secondary" | "edge" | "surface" | "accent">;

const Native =
  process.env.EXPO_OS === "ios" ? requireNativeView<NativeProps>("Markdown", "MarkdownView") : null;

export const MarkdownView = ({
  modifiers,
  color,
  secondary,
  edge,
  surface,
  accent,
  onLink,
  ...rest
}: MarkdownProps) => {
  if (!Native) {
    return null;
  }

  return (
    <Native
      modifiers={modifiers}
      {...(modifiers ? createViewModifierEventListener(modifiers) : undefined)}
      color={processColor(color)}
      secondary={processColor(secondary)}
      edge={processColor(edge)}
      surface={processColor(surface)}
      accent={processColor(accent)}
      onLink={({ nativeEvent }) => {
        onLink(nativeEvent.url);
      }}
      {...rest}
    />
  );
};
