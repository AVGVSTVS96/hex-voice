import { Pressable, StyleSheet, View } from "react-native";

import { Glyph } from "@/components/glyph";
import { Thumb } from "@/components/media/thumb";
import type { Picked } from "@/live/media";
import { circle } from "@/theme";
import { film, metrics, radius, space } from "@/ui/tokens";

export const Waiting = ({
  media,
  onRemove,
}: {
  media: Picked[];
  onRemove: (at: number) => void;
}) => (
  <View style={styles.row}>
    {media.map((each, i) => (
      <View key={`${i} ${each.uri}`} style={styles.one}>
        <Thumb media={each} width={metrics.media.waiting} corner={radius.waiting} square />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${each.kind}`}
          testID="thread-remove-media"
          hitSlop={space[2]}
          onPress={() => {
            onRemove(i);
          }}
          style={styles.remove}
        >
          <Glyph name="xmark" size={metrics.symbol.mark} color={film.ink} />
        </Pressable>
      </View>
    ))}
  </View>
);

const REMOVE = space[5];

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  one: { width: metrics.media.waiting, height: metrics.media.waiting },
  remove: {
    ...circle(REMOVE),
    position: "absolute",
    top: space[1],
    right: space[1],
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: film.glass,
  },
});
