import { HStack, Overlay, VStack } from "@expo/ui/swift-ui";
import { StyleSheet, View } from "react-native";
import type { StyleProp, ViewProps, ViewStyle } from "react-native";
import Animated, { withTiming } from "react-native-reanimated";
import type { AnimatedStyle } from "react-native-reanimated";

import { NeedsDot, TasksButton } from "@/components/tasks-button";
import type { Back } from "@/components/tasks/bar";
import { motion } from "@/motion";
import { AnimatedView } from "@/ui/animated-view";
import { GlassButton, HostedGlassButton, glass } from "@/ui/glass-button";
import { Host } from "@/ui/host";
import { metrics } from "@/ui/tokens";
import type { ToolbarGaps } from "@/ui/tokens";

interface Props {
  axis: "row" | "column";
  onLayout?: ViewProps["onLayout"];
  gaps?: ToolbarGaps;
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
  callsOpen: boolean;
  tasks: { needs: number; working: number; open: boolean };
  settingsOpen?: boolean;
  holdsBack?: boolean;
  back?: Back;
  onCalls: () => void;
  onTasks: () => void;
  onSettings: () => void;
}

export const ScreenToolbar = ({
  axis,
  onLayout,
  gaps = "regular",
  style,
  callsOpen,
  tasks,
  settingsOpen = false,
  holdsBack = false,
  back,
  onCalls,
  onTasks,
  onSettings,
}: Props) => {
  const column = metrics.toolbar[gaps];
  const gap = axis === "row" ? metrics.toolbar.row : column.group;
  const Group = axis === "row" ? HStack : VStack;
  const long = 2 * metrics.tool + gap;

  const backFade = () => {
    "worklet";

    return { opacity: withTiming(back ? 1 : 0, { duration: motion.toolbar }) };
  };

  const backButton = holdsBack ? (
    <AnimatedView
      pointerEvents={back ? "auto" : "none"}
      accessibilityElementsHidden={!back}
      importantForAccessibility={back ? "auto" : "no-hide-descendants"}
      animate={backFade}
    >
      <HostedGlassButton
        icon="back"
        label={back ? `Back to ${back.to}` : "Back"}
        testID="back"
        onPress={() => back?.onPress()}
      />
    </AnimatedView>
  ) : null;

  const calls = (
    <HostedGlassButton
      icon="calls"
      label="Calls"
      testID="calls-button"
      selected={callsOpen}
      onPress={onCalls}
    />
  );

  const pair = (
    <Host
      matchContents
      style={
        axis === "row"
          ? { width: long, height: metrics.tool }
          : { width: metrics.tool, height: long }
      }
    >
      <Overlay alignment="topLeading">
        <Group spacing={gap} modifiers={[glass("capsule")]}>
          <TasksButton
            needs={tasks.needs}
            working={tasks.working}
            selected={tasks.open}
            onPress={onTasks}
          />
          <GlassButton
            bare
            icon="settings"
            label="Voice and appearance settings"
            testID="voice-settings-button"
            selected={settingsOpen}
            onPress={onSettings}
          />
        </Group>
        <Overlay.Content>
          <NeedsDot needs={tasks.open ? 0 : tasks.needs} />
        </Overlay.Content>
      </Overlay>
    </Host>
  );

  return (
    <Animated.View
      pointerEvents="box-none"
      onLayout={onLayout}
      style={[styles[axis], axis === "column" && { gap: column.tools }, style]}
    >
      {axis === "column" ? (
        <View pointerEvents="box-none" style={[styles.columnGroup, { gap: column.group }]}>
          {backButton}
          {calls}
        </View>
      ) : (
        calls
      )}
      {axis === "row" ? (
        <View pointerEvents="box-none" style={[styles.rowGroup, { gap: metrics.toolbar.row }]}>
          {pair}
          {backButton}
        </View>
      ) : (
        pair
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: { position: "absolute", flexDirection: "row", justifyContent: "space-between" },
  column: { position: "absolute", alignItems: "center" },
  rowGroup: { flexDirection: "row" },
  columnGroup: { alignItems: "center" },
});
