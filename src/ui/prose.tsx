import type { ModifierConfig } from "@expo/ui/swift-ui/modifiers";

import { theme } from "@/theme";
import { type } from "@/ui/tokens";
import type { TextStyle, TextVariant, Tone } from "@/ui/tokens";

import { ProseText } from "../../modules/rows";

interface Run {
  text: string;
  strong?: boolean;
}

export const Prose = ({
  children,
  variant = "body",
  tone = "text",
  lines,
  modifiers,
}: {
  children: Run[];
  variant?: Extract<TextVariant, "body" | "detail" | "caption">;
  tone?: Tone;
  lines: number;
  modifiers?: ModifierConfig[];
}) => {
  const style: TextStyle = type[variant];

  return (
    <ProseText
      runs={children.map(({ text, strong = false }) => ({ text, strong }))}
      style={
        style.textStyle === "subheadline" || style.textStyle === "footnote"
          ? style.textStyle
          : "body"
      }
      size={style.fontSize}
      medium={style.weight === "medium"}
      color={theme[tone]}
      lineSpacing={style.lineSpacing ?? 0}
      lines={lines}
      {...(modifiers && { modifiers })}
    />
  );
};
