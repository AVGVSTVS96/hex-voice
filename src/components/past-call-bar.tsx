import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { CallMenu } from '@/components/call-menu';
import { callName, callWhen, type CallSummary } from '@/live/calls';
import { theme } from '@/theme';

type Props = {
  call: CallSummary;
  live: boolean;
  onCall: boolean;
  transcript?: string;
  leading?: ReactNode;
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
  onBack: () => void;
  onDelete?: () => void;
};

// A past call's title, small, with its menu: in the toolbar's place on the phone, over the words
// where the toolbar lives in a side column.
export function PastCallBar({
  call,
  live,
  onCall,
  transcript,
  leading = <View style={styles.spacer} />,
  style,
  onBack,
  onDelete,
}: Props) {
  return (
    <Animated.View pointerEvents="box-none" style={[styles.bar, style]}>
      {leading}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', flexDirection: 'row', gap: 12 },
  spacer: { width: 48 },
  title: { flex: 1, alignItems: 'center', paddingTop: 3 },
  name: { color: theme.text, fontSize: 17, lineHeight: 22, fontWeight: '600' },
  when: { color: theme.secondary, fontSize: 13, lineHeight: 18 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.switchOn },
  backText: { color: theme.switchOn, fontSize: 13, lineHeight: 18, fontWeight: '500' },
});
