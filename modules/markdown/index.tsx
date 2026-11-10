import type { CommonViewModifierProps } from "@expo/ui/swift-ui";
import { createViewModifierEventListener } from "@expo/ui/swift-ui/modifiers";
import { requireNativeView } from "expo";
import { processColor } from "react-native";
import type { ColorValue, NativeSyntheticEvent } from "react-native";

export type MarkdownProps = CommonViewModifierProps & {
  markdown: string;
  inline?: boolean | undefined;
  lines?: number | undefined;
  selectable?: boolean | undefined;
  size: number;
  leading: number;
  gap: number;
  radius: number;
  color: ColorValue;
  secondary: ColorValue;
  edge: ColorValue;
  surface: ColorValue;
  accent: ColorValue;
  progress: ColorValue;
  ask: ColorValue;
  danger: ColorValue;
  onLink: (url: string) => void;
};

type NativeProps = Omit<MarkdownProps, keyof Colors | "onLink"> & {
  [Color in keyof Colors]: ReturnType<typeof processColor>;
} & { onLink: (event: NativeSyntheticEvent<{ url: string }>) => void };

type Colors = Pick<
  MarkdownProps,
  "color" | "secondary" | "edge" | "surface" | "accent" | "progress" | "ask" | "danger"
>;

const Native =
  process.env.EXPO_OS === "ios" ? requireNativeView<NativeProps>("Markdown", "MarkdownView") : null;

export const MarkdownView = ({
  modifiers,
  color,
  secondary,
  edge,
  surface,
  accent,
  progress,
  ask,
  danger,
  onLink,
  ...rest
}: MarkdownProps) => {
  if (!Native) {
    return null;
  }

  return (
    <Native
      {...(modifiers && { modifiers, ...createViewModifierEventListener(modifiers) })}
      color={processColor(color)}
      secondary={processColor(secondary)}
      edge={processColor(edge)}
      surface={processColor(surface)}
      accent={processColor(accent)}
      progress={processColor(progress)}
      ask={processColor(ask)}
      danger={processColor(danger)}
      onLink={({ nativeEvent }) => {
        onLink(nativeEvent.url);
      }}
      {...rest}
    />
  );
};
