import { Text as UniversalText } from "@expo/ui";
import type { TextProps } from "@expo/ui";
import { font, foregroundStyle, lineSpacing } from "@expo/ui/swift-ui/modifiers";

import { theme } from "@/theme";
import { type } from "@/ui/tokens";
import type { TextStyle, TextVariant, Tone, Weight } from "@/ui/tokens";

interface Look {
  variant?: TextVariant;
  weight?: Weight;
  tone?: Tone;
  paragraph?: boolean;
}

export const textLook = ({
  variant = "body",
  weight,
  tone = "text",
  paragraph = false,
}: Look = {}) => {
  const style: TextStyle = type[variant];

  return [
    font({
      textStyle: style.textStyle,
      size: style.fontSize,
      weight: weight ?? style.weight,
      design: style.design,
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
    textStyle={align && { textAlign: align }}
    modifiers={[...textLook({ variant, weight, tone, paragraph }), ...(modifiers ?? [])]}
  />
);
