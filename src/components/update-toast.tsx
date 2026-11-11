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
import { useEffect, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";

import type { NativeBuild } from "@/hooks/use-app-updates";
import { theme } from "@/theme";
import { glass } from "@/ui/glass-button";
import { Host } from "@/ui/host";
import { Text } from "@/ui/text";
import { metrics, space } from "@/ui/tokens";

export const UpdateToast = ({
  build,
  place,
  endsCall,
  onInstall,
  onDismiss,
}: {
  build: NativeBuild;
  place: { left: number; width: number } & ({ top: number } | { bottom: number });
  endsCall: boolean;
  onInstall: () => Promise<boolean>;
  onDismiss: () => void;
}) => {
  const [step, setStep] = useState<"ready" | "installing" | "failed">("ready");

  useEffect(() => {
    if (step !== "installing") {
      return;
    }

    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setStep("ready");
      }
    });

    return () => {
      listener.remove();
    };
  }, [step]);

  const action = endsCall ? "End call & install" : "Install";

  return (
    <View pointerEvents="box-none" style={[styles.place, place]}>
      <Host matchContents>
        <Row alignment="center" spacing={0} modifiers={[glass("capsule")]}>
          <Button
            testID="update-install"
            onPress={() => {
              if (step === "installing") {
                return;
              }

              setStep("installing");
              void (async () => {
                setStep((await onInstall()) ? "installing" : "failed");
              })();
            }}
            modifiers={[
              buttonStyle("plain"),
              accessibilityLabel(
                step === "installing"
                  ? `Installing build ${build.version}; hex closes and opens again in it`
                  : `${endsCall ? "End the call and install" : "Install"} the new version of hex, build ${build.version}`,
              ),
            ]}
          >
            <Row
              alignment="center"
              spacing={space[2]}
              modifiers={[
                frame({ height: metrics.pill.regular }),
                padding({
                  leading: space[4],
                  trailing: step === "installing" ? space[4] : space[2],
                }),
                contentShape(shapes.rectangle()),
              ]}
            >
              {step === "installing" ? (
                <>
                  <ProgressView modifiers={[tint(theme.accent)]} />
                  <Text variant="headline">Installing</Text>
                  <Text tone="secondary">{`build ${build.version}`}</Text>
                </>
              ) : (
                <>
                  <Icon name="arrow.down.circle" size={metrics.symbol.bar} color={theme.accent} />
                  <Text tone="secondary">
                    {step === "failed" ? "Install didn't start" : "Update ready"}
                  </Text>
                  <Text variant="headline" tone="accent">
                    {step === "failed" ? "Try again" : action}
                  </Text>
                </>
              )}
            </Row>
          </Button>
          {step === "installing" ? null : (
            <Button
              testID="update-dismiss"
              onPress={onDismiss}
              modifiers={[
                buttonStyle("plain"),
                frame({ width: metrics.pill.regular, height: metrics.pill.regular }),
                contentShape(shapes.rectangle()),
                accessibilityLabel("Not now"),
              ]}
            >
              <Image systemName="xmark" size={metrics.symbol.small} color={theme.secondary} />
            </Button>
          )}
        </Row>
      </Host>
    </View>
  );
};

const styles = StyleSheet.create({
  place: { position: "absolute", alignItems: "center", zIndex: 2 },
});
