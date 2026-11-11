import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { theme } from "@/theme";

export type Side = "first" | "second";

export const SplitView = ({
  side,
  share,
  children,
}: {
  side: Side;
  share: number;
  children: ReactNode;
}) => {
  const other = <View style={[styles.other, { flex: 1 - share }]} />;

  return (
    <View style={styles.screen}>
      {side === "second" && other}
      <View style={[styles.app, { flex: share }]}>
        <SafeAreaProvider>{children}</SafeAreaProvider>
      </View>
      {side === "first" && other}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: "row" },
  app: { overflow: "hidden" },
  other: { backgroundColor: theme.edge },
});
