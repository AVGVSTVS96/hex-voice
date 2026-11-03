import { Icon, Row, Spacer, Text } from '@expo/ui';
import { Rectangle } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  alignmentGuide,
  background,
  clipShape,
  contentShape,
  foregroundStyle,
  fixedSize,
  frame,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  listRowSeparatorTint,
  padding,
  shapes,
  type ModifierConfig,
} from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { PixelRatio } from 'react-native';

import { theme } from '@/theme';

export const ios = process.env.EXPO_OS === 'ios';
export const INSET = 20;
export const MARK = 16;
export const GAP = 10;
const HAIRLINE = 1 / PixelRatio.get();

export function feel(haptics: boolean) {
  const on = ios && haptics;
  return {
    tick: () => {
      if (on) void Haptics.selectionAsync();
    },
    tap: () => {
      if (on) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  };
}

export type Feel = ReturnType<typeof feel>;

// No inset or fill of its own, so the list's ground shows behind it.
export function listRow(width: number, { top = true, bottom = true } = {}): ModifierConfig[] {
  return [
    listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }),
    listRowBackground('transparent'),
    listRowSeparatorTint(theme.edge),
    alignmentGuide('listRowSeparatorLeading', 0),
    alignmentGuide('listRowSeparatorTrailing', width),
    ...(top ? [] : [listRowSeparator('hidden', 'top')]),
    ...(bottom ? [] : [listRowSeparator('hidden', 'bottom')]),
  ];
}

export function SectionHead({
  title,
  count,
  opens = false,
}: {
  title: string;
  count?: string | number;
  opens?: boolean;
}) {
  return (
    <Row
      alignment="center"
      spacing={0}
      modifiers={[
        padding({ leading: INSET, trailing: INSET, top: 22, bottom: 6 }),
        frame({ maxWidth: Infinity }),
      ]}
    >
      <Text
        textStyle={{ fontSize: 13, fontWeight: '600' }}
        modifiers={[foregroundStyle(theme.secondary)]}
      >
        {title}
      </Text>
      <Spacer flexible />
      {count !== undefined ? (
        <Text textStyle={{ fontSize: 13 }} modifiers={[foregroundStyle(theme.tertiary)]}>
          {String(count)}
        </Text>
      ) : null}
      {opens ? (
        <Icon
          name="chevron.right"
          size={11}
          color={theme.tertiary}
          modifiers={[padding({ leading: 8 })]}
        />
      ) : null}
    </Row>
  );
}

export function Hairline() {
  return (
    <Rectangle
      modifiers={[
        frame({ height: HAIRLINE }),
        frame({ maxWidth: Infinity }),
        foregroundStyle(theme.edge),
      ]}
    />
  );
}

export function Pill({
  label,
  icon,
  prominent = false,
  onPress,
}: {
  label: string;
  icon?: 'waveform';
  prominent?: boolean;
  onPress: () => void;
}) {
  return (
    <Row
      alignment="center"
      spacing={8}
      onPress={onPress}
      modifiers={[
        frame({ height: 50 }),
        frame({ maxWidth: Infinity }),
        background(prominent ? theme.prominent : theme.surface),
        clipShape('capsule'),
        contentShape(shapes.capsule()),
        ...(ios ? [accessibilityLabel(label)] : []),
      ]}
    >
      <Spacer flexible />
      {icon ? (
        <Icon name={icon} size={16} color={prominent ? theme.onProminent : theme.text} />
      ) : null}
      <Text
        numberOfLines={1}
        textStyle={{ fontSize: 16, fontWeight: '600' }}
        modifiers={[
          foregroundStyle(prominent ? theme.onProminent : theme.text),
          fixedSize({ horizontal: true, vertical: false }),
        ]}
      >
        {label}
      </Text>
      <Spacer flexible />
    </Row>
  );
}

export function Empty({ text, width }: { text: string; width: number }) {
  return (
    <Text
      textStyle={{ fontSize: 15 }}
      modifiers={[
        foregroundStyle(theme.tertiary),
        padding({ top: 48, bottom: 48 }),
        frame({ maxWidth: Infinity }),
        ...listRow(width, { top: false, bottom: false }),
      ]}
    >
      {text}
    </Text>
  );
}
