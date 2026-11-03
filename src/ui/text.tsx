import { Text as UniversalText, type TextProps } from '@expo/ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import { theme } from '@/theme';
import { type, type TextStyle, type TextVariant, type Tone, type Weight } from '@/ui/tokens';

// SwiftUI text in one of the app's text styles and colors.
export function Text({
  variant = 'body',
  weight,
  tone = 'text',
  align,
  modifiers = [],
  ...props
}: Omit<TextProps, 'textStyle'> & {
  variant?: TextVariant;
  weight?: Weight;
  tone?: Tone;
  align?: 'center';
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
        ...modifiers,
      ]}
    />
  );
}
