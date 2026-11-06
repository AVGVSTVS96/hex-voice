import { StyleSheet, Text, View } from 'react-native';

import { Thumb } from '@/components/media/thumb';
import type { Shown } from '@/live/media';
import { radius, theme } from '@/theme';
import { metrics, space, textOf } from '@/ui/tokens';

// A photo or clip you sent a call, on your side of its words, sized from their width.
export function Sent({ media, failed }: { media: Shown; failed?: string }) {
  return (
    <View style={styles.you}>
      <Thumb media={media} width={metrics.media.share} corner={radius.media} />
      {failed && <Text style={styles.failed}>{`Not sent · ${failed}`}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  you: { alignSelf: 'stretch', alignItems: 'flex-end', gap: space[1] },
  failed: { ...textOf('footnote', 'medium'), color: theme.danger },
});
