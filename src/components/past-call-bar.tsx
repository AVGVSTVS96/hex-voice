import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CallMenu } from '@/components/call-menu';
import { callName, callWhen, type CallSummary } from '@/live/calls';
import { circle, theme } from '@/theme';
import { metrics, space, textOf } from '@/ui/tokens';

type Props = {
  call: CallSummary;
  live: boolean;
  onCall: boolean;
  transcript?: string;
  onBack: () => void;
  onDelete?: () => void;
};

// A past call's title, small, with its menu, heading its words.
export function PastCallBar({ call, live, onCall, transcript, onBack, onDelete }: Props) {
  return (
    <View pointerEvents="box-none" style={styles.bar}>
      <View style={styles.spacer} />
      <View pointerEvents="box-none" style={styles.title}>
        <Text numberOfLines={1} style={styles.name}>
          {callName(call)}
        </Text>
        {onCall ? (
          <Pressable accessibilityRole="button" onPress={onBack} hitSlop={10} style={styles.back}>
            <View style={styles.liveDot} />
            <Text style={styles.backText}>Back to your call</Text>
          </Pressable>
        ) : (
          <Text numberOfLines={1} style={styles.when}>
            {callWhen(call, live)}
          </Text>
        )}
      </View>
      <CallMenu transcript={transcript} title={callName(call)} onDelete={onDelete} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  spacer: { width: metrics.tool },
  title: { flex: 1, alignItems: 'center' },
  name: { ...textOf('headline'), color: theme.text },
  when: { ...textOf('caption'), color: theme.secondary },
  back: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  liveDot: { ...circle(7), backgroundColor: theme.switchOn },
  backText: { ...textOf('caption', 'semibold'), color: theme.switchOn },
});
