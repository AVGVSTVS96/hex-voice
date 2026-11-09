import { Text as UniversalText } from "@expo/ui";
import type { TextProps } from "@expo/ui";
import { font, foregroundStyle, lineSpacing } from "@expo/ui/swift-ui/modifiers";

import { theme } from "@/theme";
import { type } from "@/ui/tokens";
import type { TextStyle, TextVariant, Tone, Weight } from "@/ui/tokens";

interface Look {
  variant?: TextVariant | undefined;
  weight?: Weight | undefined;
  tone?: Tone | undefined;
  paragraph?: boolean | undefined;
}

export const textLook = ({
  variant = "body",
  weight,
  tone = "text",
  paragraph = false,
}: Look = {}) => {
  const style: TextStyle = type[variant];
  const { textStyle, design } = style;
  const fontWeight = weight ?? style.weight;

  return [
    font({
      size: style.fontSize,
      ...(textStyle && { textStyle }),
      ...(fontWeight && { weight: fontWeight }),
      ...(design && { design }),
    }),
    foregroundStyle(theme[tone]),
    ...(paragraph && style.lineSpacing !== undefined ? [lineSpacing(style.lineSpacing)] : []),
  ];
};

export const Text = ({
  variant,
  weight,
  tone,
  paragraph,
  align,
  modifiers,
  ...props
}: Omit<TextProps, "textStyle"> & Look & { align?: "center" }) => (
  <UniversalText
    {...props}
    {...(align && { textStyle: { textAlign: align } })}
    modifiers={[...textLook({ variant, weight, tone, paragraph }), ...(modifiers ?? [])]}
  />
);
