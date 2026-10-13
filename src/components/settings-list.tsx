import { Column, Icon, Row, Spacer, Text } from '@expo/ui';
import { Divider } from '@expo/ui/swift-ui';
import { accessibilityLabel, contentShape, padding, shapes } from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

import { metrics, theme } from '@/theme';

const ios = process.env.EXPO_OS === 'ios';

export const DIVIDER = 1 / 3;

export const groupHeight = (rows: number) => rows * metrics.row + (rows - 1) * DIVIDER;

export function Group({ width, children }: { width: number; children: ReactNode }) {
  return (
    <Column
      spacing={0}
      style={{ width, borderRadius: metrics.groupRadius, backgroundColor: theme.group }}
    >
      {children}
    </Column>
  );
}

export function Separator() {
  return (
    <Divider
      modifiers={[padding({ leading: metrics.rowInset + metrics.rowIcon + metrics.rowSpacing })]}
    />
  );
}

export function SettingRow({
  icon,
  title,
  width,
  label,
  onPress,
  testID,
  children,
}: {
  icon: SFSymbol;
  title: string;
  width: number;
  label?: string;
  onPress?: () => void;
  testID?: string;
  children: ReactNode;
}) {
  return (
    <Row
      alignment="center"
      spacing={metrics.rowSpacing}
      style={{ width, height: metrics.row, paddingHorizontal: metrics.rowInset }}
      onPress={onPress}
      testID={testID}
      modifiers={[
        contentShape(shapes.rectangle()),
        ...(label && ios ? [accessibilityLabel(label)] : []),
      ]}
    >
      {ios ? (
        <Icon name={icon} size={20} color={theme.text} style={{ width: metrics.rowIcon }} />
      ) : (
        <Spacer style={{ width: metrics.rowIcon }} />
      )}
      <Text textStyle={{ color: theme.text, fontSize: metrics.body }}>{title}</Text>
      <Spacer flexible />
      {children}
    </Row>
  );
}
