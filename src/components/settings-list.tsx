import { Column, Icon, Row, Spacer } from "@expo/ui";
import { Divider, Menu, Picker, Text as NativeText } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  disabled,
  fixedSize,
  lineLimit,
  padding,
  tag,
} from "@expo/ui/swift-ui/modifiers";
import type { ReactNode } from "react";
import type { SFSymbol } from "sf-symbols-typescript";

import { hairline, theme } from "@/theme";
import { Text } from "@/ui/text";
import { metrics, radius, space } from "@/ui/tokens";

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
    {...(onPress && { onPress })}
    {...(testID !== undefined && { testID })}
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

export const PickerRow = <Id extends string>({
  icon,
  title,
  width,
  choices,
  selection,
  onChange,
  enabled = true,
  label,
  testID,
}: {
  icon: SFSymbol;
  title: string;
  width: number;
  choices: readonly { id: Id; label: string }[];
  selection: Id;
  onChange: (next: Id) => void;
  enabled?: boolean;
  label: string;
  testID: string;
}) => (
  <SettingRow icon={icon} title={title} width={width}>
    <Menu
      label={
        <Row alignment="center" spacing={space[1]}>
          <Text tone="secondary" modifiers={[lineLimit(1)]}>
            {choices.find(({ id }) => id === selection)?.label ?? "…"}
          </Text>
          <Icon
            name="chevron.up.chevron.down"
            size={metrics.symbol.small}
            color={theme.secondary}
          />
        </Row>
      }
      testID={testID}
      modifiers={[
        fixedSize({ horizontal: true, vertical: false }),
        disabled(!enabled),
        accessibilityLabel(label),
      ]}
    >
      <Picker label={title} selection={selection} onSelectionChange={onChange}>
        {choices.map((choice) => (
          <NativeText key={choice.id} modifiers={[tag(choice.id)]}>
            {choice.label}
          </NativeText>
        ))}
      </Picker>
    </Menu>
  </SettingRow>
);
