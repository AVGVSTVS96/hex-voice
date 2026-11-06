import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Column } from '@/screens/column';
import { stack } from '@/ui/tokens';

// iPhone Duo's side column as a sibling of what it sits beside, one row: the column is the bar's
// inset wide, which the safe area view sets on the native side as iOS reports it, and the content
// takes the rest. Both lay out by flex in the pass that lays out the window, so nothing drawn in
// the content can reach under the column, and a new window's size reaches the two at once.
//
// Down the column: the tools from `top`, the call buttons ending `foot` up, and the docked call
// centered between them, all centered on the system's items. The buttons keep room for the call's
// own +, above mute (`add`), which the docked call beside Tasks goes without.
export function SideRow({
  column: { bar, shift, top, foot, tight },
  tools,
  call,
  controls,
  add,
  children,
}: {
  column: Column;
  tools: ReactNode;
  call?: ReactNode;
  controls?: ReactNode;
  add: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[styles.row, bar === 'left' && styles.reversed]}>
      <View style={styles.content}>{children}</View>
      <SafeAreaView mode="padding" edges={[bar]}>
        <View
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
          <View style={styles.call}>{call}</View>
          <View
            style={[styles.controls, { height: stack(tight ? 'compact' : 'regular', { add }) }]}
          >
            {controls}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  reversed: { flexDirection: 'row-reverse' },
  content: { flex: 1 },
  column: { ...StyleSheet.absoluteFill, alignItems: 'center' },
  call: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  controls: { justifyContent: 'flex-end' },
});
