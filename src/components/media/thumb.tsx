import { useState } from 'react';
import { Image, StyleSheet, View, type DimensionValue } from 'react-native';

import { Glyph } from '@/components/glyph';
import { mediaSource } from '@/hooks/use-media';
import type { Shown } from '@/live/media';
import { bevel, circle, theme } from '@/theme';
import { film, metrics, radius, space } from '@/ui/tokens';

// A photo or clip as you sent it or as it waits to go: the picture to its edges under the bevel,
// a play mark on a clip. It takes the width it's given and its picture's own shape, kept between
// upright and wide so a panorama or a screenshot doesn't run away with the page.
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
      accessibilityLabel={media.kind === 'video' ? 'Video' : 'Photo'}
      style={[styles.frame, { width, aspectRatio: square ? 1 : shape, borderRadius: corner }]}
    >
      <Image
        source={source}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
        onLoad={({ nativeEvent: { source } }) =>
          setShape(Math.min(4 / 3, Math.max(3 / 4, source.width / source.height)))
        }
      />
      {media.kind === 'video' && (
        <View style={styles.play}>
          <Glyph name="play.fill" size={metrics.symbol.bar} color={film.ink} />
        </View>
      )}
      <View pointerEvents="none" style={[styles.edge, { borderRadius: corner }]} />
    </View>
  );
};

// Several sent together, as Messages groups them: one at the album's width, more as squares two
// to a row.
export const Album = ({
  media,
  width,
  dim = false,
}: {
  media: Shown[];
  width: number;
  dim?: boolean;
}) => {
  const one = media.length === 1;
  const side = one ? width : (width - space[1]) / 2;
  return (
    <View style={[styles.album, { width }, dim && styles.dim]}>
      {media.map((each, i) => (
        <Thumb key={i} media={each} width={side} corner={radius.media} square={!one} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  album: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: space[1] },
  dim: { opacity: 0.6 },
  frame: {
    overflow: 'hidden',
    borderCurve: 'continuous',
    backgroundColor: theme.skeleton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    ...circle(metrics.tool),
    backgroundColor: film.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  edge: {
    ...StyleSheet.absoluteFill,
    borderCurve: 'continuous',
    borderWidth: bevel.width,
    borderColor: bevel.side,
    borderTopColor: bevel.light,
    borderBottomColor: bevel.shade,
  },
});
