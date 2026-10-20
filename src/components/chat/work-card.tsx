import { StyleSheet, Text, View } from 'react-native';

import type { Planned } from '@/live/tasks';
import { theme } from '@/theme';

// What hex is doing right now, under its last reply: the step it's on, and how far through its
// plan it is when it has one.
export function WorkCard({ line, plan }: { line: string; plan: Planned[] }) {
  const done = plan.filter((step) => step.state === 'done').length;
  const now = plan.find((step) => step.state === 'running');
  return (
    <View style={styles.card} accessibilityLabel={`Working: ${line}`}>
      <View style={styles.head}>
        <View style={styles.pulse} />
        <Text numberOfLines={2} style={styles.line}>
          {line || 'Working'}
        </Text>
      </View>
      {plan.length > 0 && (
        <>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(done / plan.length) * 100}%` }]} />
          </View>
          <Text numberOfLines={1} style={styles.plan}>
            {`${done} of ${plan.length}${now ? ` · ${now.text}` : ''}`}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: theme.surface,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.switchOn },
  line: { flex: 1, color: theme.text, fontSize: 15, lineHeight: 20 },
  track: { height: 4, borderRadius: 2, backgroundColor: theme.edge, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: theme.accent },
  plan: { color: theme.secondary, fontSize: 13 },
});
