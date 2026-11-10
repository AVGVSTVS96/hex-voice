import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import type { DimensionValue } from "react-native";

import { Glyph } from "@/components/glyph";
import { mediaSource } from "@/hooks/use-media";
import type { Shown } from "@/live/media";
import { bevel, circle, theme } from "@/theme";
import { film, metrics, radius, space } from "@/ui/tokens";

export const Thumb = ({
  media,
  width,
  corner,
  square = false,
}: {
  media: Shown;
  width: DimensionValue;
  corner: number;
  square?: boolean;
}) => {
  const [shape, setShape] = useState(4 / 3);
  const source = mediaSource(media);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={media.kind === "video" ? "Video" : "Photo"}
      style={[styles.frame, { width, aspectRatio: square ? 1 : shape, borderRadius: corner }]}
    >
      <Image
        source={source}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        onLoad={({ nativeEvent: { source: loaded } }) => {
          setShape(Math.min(4 / 3, Math.max(3 / 4, loaded.width / loaded.height)));
        }}
      />
      {media.kind === "video" && (
        <View style={styles.play}>
          <Glyph name="play.fill" size={metrics.symbol.bar} color={film.ink} />
        </View>
      )}
      <View pointerEvents="none" style={[styles.edge, { borderRadius: corner }]} />
    </View>
  );
};

export const Album = ({
  media,
  width,
  dim = false,
  side: edge = "end",
}: {
  media: Shown[];
  width: number;
  dim?: boolean;
  side?: "start" | "end";
}) => {
  const one = media.length === 1;
  const side = one ? width : (width - space[1]) / 2;

  return (
    <View style={[styles.album, { width, justifyContent: `flex-${edge}` }, dim && styles.dim]}>
      {media.map((each, i) => (
        <Thumb key={i} media={each} width={side} corner={radius.media} square={!one} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  album: { flexDirection: "row", flexWrap: "wrap", gap: space[1] },
  dim: { opacity: 0.6 },
  frame: {
    overflow: "hidden",
    borderCurve: "continuous",
    backgroundColor: theme.skeleton,
    alignItems: "center",
    justifyContent: "center",
  },
  play: {
    ...circle(metrics.tool),
    backgroundColor: film.glass,
    alignItems: "center",
    justifyContent: "center",
  },
  edge: {
    ...StyleSheet.absoluteFill,
    borderCurve: "continuous",
    borderWidth: bevel.width,
    borderColor: bevel.side,
    borderTopColor: bevel.light,
    borderBottomColor: bevel.shade,
  },
});
