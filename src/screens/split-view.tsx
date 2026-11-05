import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { theme } from '@/theme';

export type Side = 'left' | 'right';

// For checks (?split=left or right): the app in one half of the screen, as Split View puts it, the
// other half left to a stand-in for the other app. The half has its own safe area, and the pose
// reports the fold and the cameras in its coordinates, as iOS does for a Split View window. iOS's
// own Split View can't be started on the Duo simulator, so this is how scripts/duo sees it.
export function SplitView({ side, children }: { side: Side; children: ReactNode }) {
  const other = <View style={styles.other} />;
  return (
    <View style={styles.screen}>
      {side === 'right' && other}
      <View style={styles.half}>
        <SafeAreaProvider>{children}</SafeAreaProvider>
      </View>
      {side === 'left' && other}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row' },
  half: { flex: 1, overflow: 'hidden' },
  other: { flex: 1, backgroundColor: theme.edge },
});
