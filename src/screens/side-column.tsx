import { RNHostView } from "@expo/ui";
import { Button, Spacer, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  accessibilityHint,
  accessibilityLabel,
  animation,
  Animation,
  buttonStyle,
  contentShape,
  disabled,
  frame,
  opacity,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CallButtons } from "@/components/call-controls";
import { useKeyboardUp } from "@/hooks/use-keyboard-up";
import { motion } from "@/motion";
import { COLUMN } from "@/screens/layout";
import type { Layout } from "@/screens/layout";
import { GlassButton } from "@/ui/glass-button";
import { Host } from "@/ui/host";
import { metrics } from "@/ui/tokens";

import { ColumnView } from "../../modules/column";

export interface BackToCall {
  label: string;
  onPress: () => void;
}

export interface BesideSwitch {
  offered: boolean;
  selected: boolean;
  stacks: boolean;
  onPress: () => void;
}

const shown = (on: boolean) => [
  opacity(on ? 1 : 0),
  disabled(!on),
  accessibilityHidden(!on),
  animation(Animation.easeInOut({ duration: motion.toolbar / 1000 }), on),
];

export const SideColumn = ({
  column: { bar },
  tools,
  controls,
  beside,
  back,
}: {
  column: NonNullable<Layout["column"]>;
  tools: ReactNode;
  controls: Omit<ComponentProps<typeof CallButtons>, "modifiers">;
  beside?: BesideSwitch | undefined;
  back?: BackToCall | undefined;
}) => {
  const keyboard = useKeyboardUp();

  if (!ColumnView) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={[styles.row, bar === "left" && styles.reversed]}>
      <View pointerEvents="none" style={styles.content} />
      <SafeAreaView mode="padding" edges={[bar]} pointerEvents="box-none">
        <Host avoids="system" style={styles.column}>
          <ColumnView top={COLUMN.top} clear={COLUMN.clear}>
            <RNHostView matchContents>
              <View>{tools}</View>
            </RNHostView>
            <Button
              testID="column-back-to-call"
              onPress={() => {
                back?.onPress();
              }}
              modifiers={[
                buttonStyle("plain"),
                disabled(!back),
                ...(back
                  ? [accessibilityLabel(back.label), accessibilityHint("Closes Tasks for the call")]
                  : [accessibilityHidden(true)]),
              ]}
            >
              <Spacer
                modifiers={[
                  frame({ maxWidth: Infinity, maxHeight: Infinity }),
                  contentShape(shapes.rectangle()),
                ]}
              />
            </Button>
            <VStack
              spacing={metrics.controls[controls.size ?? "regular"].gap}
              modifiers={shown(!keyboard)}
            >
              {beside && (
                <VStack modifiers={shown(beside.offered)}>
                  <GlassButton
                    icon={beside.stacks ? "beside-column" : "beside-row"}
                    label="Transcript beside Tasks"
                    testID="transcript-beside-button"
                    selected={beside.selected}
                    onPress={beside.onPress}
                  />
                </VStack>
              )}
              <CallButtons {...controls} />
            </VStack>
          </ColumnView>
        </Host>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { ...StyleSheet.absoluteFill, flexDirection: "row" },
  reversed: { flexDirection: "row-reverse" },
  content: { flex: 1 },
  column: { ...StyleSheet.absoluteFill },
});
