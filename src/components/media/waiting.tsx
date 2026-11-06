import { Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '@/components/glyph';
import { Thumb } from '@/components/media/thumb';
import type { Picked } from '@/live/media';
import { circle, radius, theme } from '@/theme';
import { metrics, space } from '@/ui/tokens';

// What you picked or shot, waiting in the composer to go with your words, each with its way out,
// as many to a row as the field's width holds.
export function Waiting({ media, onRemove }: { media: Picked[]; onRemove: (at: number) => void }) {
  return (
    <View style={styles.row}>
      {media.map((each, i) => (
        <View key={each.uri} style={styles.one}>
          <Thumb media={each} width={metrics.media.waiting} corner={radius.waiting} square />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${each.kind}`}
            testID="thread-remove-media"
            hitSlop={space[2]}
            onPress={() => onRemove(i)}
            style={styles.remove}
          >
            <Glyph name="xmark" size={space[2.5]} color={theme.onMedia} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const REMOVE = space[5];

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  one: { width: metrics.media.waiting, height: metrics.media.waiting },
  remove: {
    ...circle(REMOVE),
    position: 'absolute',
    top: space[1],
    right: space[1],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.overMedia,
  },
});
