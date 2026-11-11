import { Icon, Row } from "@expo/ui";
import { Button, Image, ProgressView } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonStyle,
  contentShape,
  frame,
  padding,
  shapes,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { NativeBuild } from "@/hooks/use-app-updates";
import { theme } from "@/theme";
import { glass } from "@/ui/glass-button";
import { Host } from "@/ui/host";
import { Text } from "@/ui/text";
import { metrics, space } from "@/ui/tokens";

export const UpdateToast = ({
  build,
  edge,
  endsCall,
  onInstall,
  onDismiss,
}: {
  build: NativeBuild;
  edge: { top: number } | { bottom: number };
  endsCall: boolean;
  onInstall: () => Promise<boolean>;
  onDismiss: () => void;
}) => {
  const [installing, setInstalling] = useState(false);

  return (
    <View pointerEvents="box-none" style={[styles.place, edge]}>
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
              setInstalling(true);
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              void onInstall().then(setInstalling);
            }}
            modifiers={[
              buttonStyle("plain"),
              contentShape(shapes.capsule()),
              accessibilityLabel(
                installing
                  ? `Installing build ${build.version}; hex closes and opens again in it`
                  : `${endsCall ? "End the call and install" : "Install"} the new version of hex, build ${build.version}`,
              ),
            ]}
          >
            {installing ? (
              <Row alignment="center" spacing={space[2]}>
                <ProgressView modifiers={[tint(theme.accent)]} />
                <Text variant="headline">Installing</Text>
                <Text variant="headline" tone="secondary">
                  {`build ${build.version}`}
                </Text>
              </Row>
            ) : (
              <Row alignment="center" spacing={space[2]}>
                <Icon name="arrow.down.circle" size={metrics.symbol.bar} color={theme.accent} />
                <Text variant="headline">Update ready</Text>
                <Text variant="headline" tone="accent">
                  {endsCall ? "End call & install" : "Install"}
                </Text>
              </Row>
            )}
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
};

const styles = StyleSheet.create({
  place: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 2 },
});
