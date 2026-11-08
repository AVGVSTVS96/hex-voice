import { Pressable, StyleSheet, Text, View } from "react-native";

import { useRetry } from "@/call/use-call";
import { Thumb } from "@/components/media/thumb";
import type { Shown } from "@/live/media";
import { theme } from "@/theme";
import { metrics, radius, space, textOf } from "@/ui/tokens";

export const SentMedia = ({
  id,
  media,
  sending = false,
  failed,
}: {
  id: string;
  media: Shown;
  sending?: boolean;
  failed?: string;
}) => {
  const retry = useRetry();

  return (
    <View style={styles.you}>
      <View style={[styles.thumb, sending && styles.dim]}>
        <Thumb media={media} width="100%" corner={radius.media} />
      </View>
      {sending && <Text style={styles.note}>Sending</Text>}
      {!sending && failed !== undefined && failed !== "" && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            retry(id);
          }}
        >
          <Text style={styles.failed}>{`Not sent · ${failed} · Tap to try again`}</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  you: { alignSelf: "stretch", alignItems: "flex-end", gap: space[1] },
  thumb: { width: metrics.media.share },
  dim: { opacity: 0.6 },
  note: { ...textOf("caption"), color: theme.tertiary },
  failed: { ...textOf("caption", "medium"), color: theme.danger },
});
