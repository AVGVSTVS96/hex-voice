import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CallSummary } from '@/live/calls';
import { circle, theme } from '@/theme';

type Props = Pick<CallSummary, 'why' | 'summary' | 'waiting'> & {
  center?: boolean;
  onOpen?: () => void;
  onMore?: () => void;
};

// Under the orb (`center`) only the first few of what's left for you fit; the rest are in Tasks.
const UNDER_ORB = 3;

// hex's own account of a call once its work settles: what happened, where things went, and what's
// left for you. Until then a phone call hex placed still says why it called. Under the orb it's cut
// to fit, and a tap opens the call, where it reads whole.
export function WrapUp({ why, summary, waiting = [], center, onOpen, onMore }: Props) {
  const lead = summary ?? (why && `hex called because: ${why}`);
  if (!lead && !waiting.length) return null;
  const shown = center ? waiting.slice(0, UNDER_ORB) : waiting;
  const more = waiting.length - shown.length;
  return (
    <Pressable
      disabled={!onOpen}
      onPress={onOpen}
      accessibilityHint={onOpen ? 'Opens the call' : undefined}
      style={[styles.wrap, center && styles.center]}
    >
      {lead && (
        <Text
          selectable={!center}
          numberOfLines={center ? 4 : undefined}
          style={[styles.summary, center && styles.centered]}
        >
          {lead}
        </Text>
      )}
      {waiting.length > 0 && (
        <View style={styles.waiting}>
          <Text style={[styles.label, center && styles.centered]}>Waiting on you</Text>
          {shown.map((item) => (
            <View key={item} style={styles.item}>
              <View style={styles.dot} />
              <Text
                selectable={!center}
                numberOfLines={center ? 2 : undefined}
                style={styles.itemText}
              >
                {item}
              </Text>
            </View>
          ))}
          {more > 0 && (
            <Text
              accessibilityRole="button"
              onPress={onMore}
              style={[styles.label, styles.more, center && styles.centered]}
            >
              {`${more} more in Tasks`}
            </Text>
          )}
        </View>
      )}
    </Pressable>
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
    ...circle(6),
    marginTop: 8,
    backgroundColor: theme.accent,
  },
  itemText: { flexShrink: 1, color: theme.text, fontSize: 15, lineHeight: 22 },
  more: { color: theme.accent },
});
