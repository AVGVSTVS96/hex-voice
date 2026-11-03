import { Text as UniversalText, type TextProps } from '@expo/ui';
import { font, foregroundStyle, lineSpacing } from '@expo/ui/swift-ui/modifiers';

import { theme } from '@/theme';
import { type, type TextStyle, type TextVariant, type Tone, type Weight } from '@/ui/tokens';

// SwiftUI text in one of the app's text styles and colors. A `paragraph` spaces its lines by its
// style's lineSpacing; anything else is a label, on the font's own leading.
export function Text({
  variant = 'body',
  weight,
  tone = 'text',
  align,
  paragraph = false,
  modifiers = [],
  ...props
}: Omit<TextProps, 'textStyle'> & {
  variant?: TextVariant;
  weight?: Weight;
  tone?: Tone;
  align?: 'center';
  paragraph?: boolean;
}) {
  const style: TextStyle = type[variant];
  return (
    <UniversalText
      {...props}
      textStyle={align && { textAlign: align }}
      modifiers={[
        font({
          textStyle: style.textStyle,
          size: style.fontSize,
          weight: weight ?? style.weight,
        }),
        foregroundStyle(theme[tone]),
        ...(paragraph && style.lineSpacing !== undefined ? [lineSpacing(style.lineSpacing)] : []),
        ...modifiers,
      ]}
    />
  );
}
