import { StyleSheet, Text, View } from 'react-native';

import type { CallSummary } from '@/live/calls';
import { theme } from '@/theme';

type Props = Pick<CallSummary, 'why' | 'summary' | 'waiting'> & { center?: boolean };

// hex's own account of a call once its work settles: what happened, where things went, and what's
// left for you. Until then a phone call hex placed still says why it called.
export function WrapUp({ why, summary, waiting = [], center }: Props) {
  const lead = summary ?? (why && `hex called because: ${why}`);
  if (!lead && !waiting.length) return null;
  return (
    <View style={[styles.wrap, center && styles.center]}>
      {lead && (
        <Text
          selectable
          numberOfLines={center ? 4 : undefined}
          style={[styles.summary, center && styles.centered]}
        >
          {lead}
        </Text>
      )}
      {waiting.length > 0 && (
        <View style={styles.waiting}>
          <Text style={[styles.label, center && styles.centered]}>Waiting on you</Text>
          {waiting.map((item) => (
            <View key={item} style={styles.item}>
              <View style={styles.dot} />
              <Text selectable numberOfLines={center ? 2 : undefined} style={styles.itemText}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  center: { alignItems: 'center' },
  centered: { textAlign: 'center' },
  summary: { color: theme.secondary, fontSize: 16, lineHeight: 23 },
  waiting: { gap: 8 },
  label: { color: theme.secondary, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    backgroundColor: theme.accent,
  },
  itemText: { flexShrink: 1, color: theme.text, fontSize: 15, lineHeight: 22 },
});
