import { Icon, Row } from "@expo/ui";
import { Button, Image } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
  contentShape,
  frame,
  padding,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { Linking, StyleSheet, View } from "react-native";

import type { NativeBuild } from "@/hooks/use-app-updates";
import { theme } from "@/theme";
import { glass } from "@/ui/glass-button";
import { Host } from "@/ui/host";
import { Text } from "@/ui/text";
import { metrics, space } from "@/ui/tokens";

export const UpdateToast = ({
  build,
  top,
  onDismiss,
}: {
  build: NativeBuild;
  top: number;
  onDismiss: () => void;
}) => (
  <View pointerEvents="box-none" style={[styles.place, { top: top + space[2] }]}>
    <Host matchContents>
      <Row
        alignment="center"
        spacing={space[3]}
        modifiers={[
          frame({ height: metrics.pill.regular }),
          padding({ leading: space[4], trailing: space[2] }),
          glass("capsule"),
        ]}
      >
        <Button
          testID="update-install"
          onPress={() => {
            void Linking.openURL(build.install);
          }}
          modifiers={[
            buttonStyle("plain"),
            contentShape(shapes.capsule()),
            accessibilityLabel(`Install the new version of hex, build ${build.version}`),
          ]}
        >
          <Row alignment="center" spacing={space[2]}>
            <Icon name="arrow.down.circle" size={metrics.symbol.bar} color={theme.accent} />
            <Text variant="headline">Update ready</Text>
            <Text variant="headline" tone="accent">
              Install
            </Text>
          </Row>
        </Button>
        <Button
          testID="update-dismiss"
          onPress={onDismiss}
          modifiers={[
            buttonStyle("plain"),
            frame({ width: metrics.pill.small, height: metrics.pill.small }),
            contentShape(shapes.circle()),
            accessibilityLabel("Not now"),
          ]}
        >
          <Image systemName="xmark" size={metrics.symbol.small} color={theme.secondary} />
        </Button>
      </Row>
    </Host>
  </View>
);

const styles = StyleSheet.create({
  place: { position: "absolute", left: 0, right: 0, alignItems: "center" },
});
