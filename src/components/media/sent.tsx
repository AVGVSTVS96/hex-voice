import { StyleSheet, Text, View } from 'react-native';

import { Thumb } from '@/components/media/thumb';
import type { Shown } from '@/live/media';
import { radius, theme } from '@/theme';
import { metrics, space, textOf } from '@/ui/tokens';

// A photo or clip you sent a call, on your side of its words, sized from their width.
// While hex takes it in, it shows dim with Sending under it.
export function SentMedia({
  media,
  sending = false,
  failed,
}: {
  media: Shown;
  sending?: boolean;
  failed?: string;
}) {
  return (
    <View style={styles.you}>
      <View style={[styles.thumb, sending && styles.dim]}>
        <Thumb media={media} width="100%" corner={radius.media} />
      </View>
      {sending ? (
        <Text style={styles.note}>Sending</Text>
      ) : failed ? (
        <Text style={styles.failed}>{`Not sent · ${failed}`}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  you: { alignSelf: 'stretch', alignItems: 'flex-end', gap: space[1] },
  thumb: { width: metrics.media.share },
  dim: { opacity: 0.6 },
  note: { ...textOf('footnote'), color: theme.tertiary },
  failed: { ...textOf('footnote', 'medium'), color: theme.danger },
});
