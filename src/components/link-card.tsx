import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Glyph } from "@/components/glyph";
import { failure, openURL } from "@/hooks/use-failures";
import type { Item } from "@/live/calls";
import { theme } from "@/theme";
import { labelOf, radius, space, textOf } from "@/ui/tokens";

const hostOf = (url: string) => url.replace(/^https?:\/\//u, "").split(/[/?#]/u)[0] ?? url;

export const LinkCard = ({ item }: { item: Item }) => {
  const [failed, setFailed] = useState<string>();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={item.title}
      accessibilityHint={hostOf(item.url)}
      onPress={async () => {
        setFailed(undefined);

        try {
          await openURL(item.url);
        } catch (error) {
          setFailed(failure("Not opened", error));
        }
      }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.words}>
        <Text numberOfLines={2} style={styles.title}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={[styles.host, failed !== undefined && styles.failed]}>
          {failed ?? hostOf(item.url)}
        </Text>
      </View>
      <Glyph name="arrow.up.right" size={13} color={theme.secondary} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    alignSelf: "flex-start",
    maxWidth: "96%",
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    backgroundColor: theme.surface,
    borderRadius: radius.group,
    borderCurve: "continuous",
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  pressed: { opacity: 0.6 },
  words: { flexShrink: 1, gap: space[0.5] },
  title: { ...textOf("detail", "medium"), color: theme.text },
  host: { ...labelOf("caption"), color: theme.secondary },
  failed: { color: theme.danger },
});
