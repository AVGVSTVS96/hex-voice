import { Pressable, StyleSheet, Text, View } from "react-native";

import { CallMenu } from "@/components/call-menu";
import { useToolbarBack } from "@/components/toolbar-back";
import { callName, callWhen } from "@/live/calls";
import type { CallSummary } from "@/live/calls";
import { circle, theme } from "@/theme";
import { metrics, space, textOf } from "@/ui/tokens";

interface Props {
  call: CallSummary;
  live: boolean;
  onCall: boolean;
  transcript?: string;
  onBack: () => void;
  onDelete?: () => void;
}

export const PastCallBar = ({ call, live, onCall, transcript, onBack, onDelete }: Props) => {
  const inToolbar = useToolbarBack(
    "call",
    onCall ? { to: "your call", onPress: onBack } : undefined,
  );

  return (
    <View pointerEvents="box-none" style={styles.bar}>
      <View style={styles.spacer} />
      <View pointerEvents="box-none" style={styles.title}>
        <Text numberOfLines={1} style={styles.name}>
          {callName(call)}
        </Text>
        {onCall && !inToolbar ? (
          <Pressable accessibilityRole="button" onPress={onBack} hitSlop={10} style={styles.back}>
            <View style={styles.liveDot} />
            <Text style={styles.backText}>Back to your call</Text>
          </Pressable>
        ) : (
          <Text numberOfLines={1} style={styles.when}>
            {callWhen(call, live)}
          </Text>
        )}
      </View>
      <CallMenu transcript={transcript} title={callName(call)} onDelete={onDelete} />
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: space[3] },
  spacer: { width: metrics.tool },
  title: { flex: 1, alignItems: "center" },
  name: { ...textOf("headline"), color: theme.text },
  when: { ...textOf("caption"), color: theme.secondary },
  back: { flexDirection: "row", alignItems: "center", gap: space[2] },
  liveDot: { ...circle(7), backgroundColor: theme.switchOn },
  backText: { ...textOf("caption", "medium"), color: theme.switchOn },
});
