import { Column, Icon, Row, Spacer } from "@expo/ui";
import { Divider } from "@expo/ui/swift-ui";
import { accessibilityLabel, padding } from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import type { SFSymbol } from "sf-symbols-typescript";

import { hairline, theme } from "@/theme";
import { Text } from "@/ui/text";
import { metrics, radius } from "@/ui/tokens";

export const groupHeight = (rows: number) => rows * metrics.row + (rows - 1) * hairline;

export const Group = ({ width, children }: { width: number; children: ReactNode }) => (
  <Column spacing={0} style={{ width, borderRadius: radius.group, backgroundColor: theme.card }}>
    {children}
  </Column>
);

export const Separator = () => (
  <Divider
    modifiers={[padding({ leading: metrics.rowInset + metrics.rowIcon + metrics.rowSpacing })]}
  />
);

export const SettingRow = ({
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
}) => (
  <Row
    alignment="center"
    spacing={metrics.rowSpacing}
    style={{ width, height: metrics.row, paddingHorizontal: metrics.rowInset }}
    onPress={onPress}
    testID={testID}
    modifiers={label === undefined || label === "" ? [] : [accessibilityLabel(label)]}
  >
    <Icon
      name={icon}
      size={metrics.symbol.row}
      color={theme.text}
      style={{ width: metrics.rowIcon }}
    />
    <Text>{title}</Text>
    <Spacer flexible />
    {children}
  </Row>
);
