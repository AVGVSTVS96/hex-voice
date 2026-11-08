import { useState } from "react";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { theme } from "@/theme";

export type Side = "first" | "second";

export const SplitView = ({ side, children }: { side: Side; children: ReactNode }) => {
  const [across, setAcross] = useState(true);
  const other = <View style={styles.other} />;

  return (
    <View
      style={[styles.screen, { flexDirection: across ? "row" : "column" }]}
      onLayout={({ nativeEvent: { layout } }) => {
        setAcross(layout.width > layout.height);
      }}
    >
      {side === "second" && other}
      <View style={styles.half}>
        <SafeAreaProvider>{children}</SafeAreaProvider>
      </View>
      {side === "first" && other}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  half: { flex: 1, overflow: "hidden" },
  other: { flex: 1, backgroundColor: theme.edge },
});
