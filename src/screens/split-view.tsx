import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { theme } from '@/theme';

export type Side = 'first' | 'second';

// For checks (?split=first or second): the app in one half of the screen, as Split View puts it,
// the other half left to a stand-in for the other app: side by side where the screen is wider than
// tall, one over the other where it's taller. The half has its own safe area, and the pose reports
// the fold and the cameras in its coordinates, as iOS does for a Split View window. iOS's own Split
// View can't be started on the Duo simulator, so this is how scripts/duo sees it.
export const SplitView = ({ side, children }: { side: Side; children: ReactNode }) => {
  const [across, setAcross] = useState(true);
  const other = <View style={styles.other} />;
  return (
    <View
      style={[styles.screen, { flexDirection: across ? 'row' : 'column' }]}
      onLayout={({ nativeEvent: { layout } }) => setAcross(layout.width > layout.height)}
    >
      {side === 'second' && other}
      <View style={styles.half}>
        <SafeAreaProvider>{children}</SafeAreaProvider>
      </View>
      {side === 'first' && other}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  half: { flex: 1, overflow: 'hidden' },
  other: { flex: 1, backgroundColor: theme.edge },
});
