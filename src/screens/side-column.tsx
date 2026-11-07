import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Layout } from '@/screens/layout';

// iPhone Duo's side column as a sibling of the content in one row, laid out natively: it is the
// bar's inset wide, which the safe area view takes on the native side as iOS reports it, so its
// tools and call buttons land with the window's new size in the frame it changes, never over the
// content. It draws nothing of its own: the call and Tasks' backdrop run under it as before.
export function SideColumn({
  column: { bar, shift, top, foot },
  tools,
  controls,
}: {
  column: NonNullable<Layout['column']>;
  tools: ReactNode;
  controls: ReactNode;
}) {
  return (
    <View pointerEvents="box-none" style={[styles.row, bar === 'left' && styles.reversed]}>
      <View pointerEvents="none" style={styles.content} />
      <SafeAreaView mode="padding" edges={[bar]} pointerEvents="box-none">
        <View
          pointerEvents="box-none"
          style={[
            styles.column,
            {
              paddingTop: top,
              paddingBottom: foot,
              paddingLeft: Math.max(0, 2 * shift),
              paddingRight: Math.max(0, -2 * shift),
            },
          ]}
        >
          {tools}
          <View pointerEvents="none" style={styles.content} />
          {controls}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  reversed: { flexDirection: 'row-reverse' },
  content: { flex: 1 },
  column: { ...StyleSheet.absoluteFill, alignItems: 'center' },
});
