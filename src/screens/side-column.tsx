import { RNHostView } from '@expo/ui';
import { animation, Animation, disabled, opacity } from '@expo/ui/swift-ui/modifiers';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ColumnView } from '../../modules/column';
import { CallButtons } from '@/components/call-controls';
import { useKeyboardUp } from '@/hooks/use-keyboard-up';
import { motion } from '@/motion';
import { COLUMN } from '@/screens/layout';
import type { Layout } from '@/screens/layout';
import { Host } from '@/ui/host';

// iPhone Duo's side column as a sibling of the content in one row, laid out natively: it is the
// bar's inset wide, which the safe area view takes on the native side as iOS reports it, and inside
// it SwiftUI places the tools and call buttons around what covers the screen there (modules/column),
// so they land with the window's new size in the frame it changes, never over the content. The call
// buttons are SwiftUI in the column's own view graph, not React Native hosting a Host of their own.
// It draws nothing of its own: the call and Tasks' backdrop run under it as before. While the
// keyboard is up over its foot, the call buttons there fade, so the glass keyboard never shows them
// through.
export function SideColumn({
  column: { bar },
  tools,
  controls,
}: {
  column: NonNullable<Layout['column']>;
  tools: ReactNode;
  controls: Omit<ComponentProps<typeof CallButtons>, 'modifiers'>;
}) {
  const keyboard = useKeyboardUp();
  if (!ColumnView) return null;
  return (
    <View pointerEvents="box-none" style={[styles.row, bar === 'left' && styles.reversed]}>
      <View pointerEvents="none" style={styles.content} />
      <SafeAreaView mode="padding" edges={[bar]} pointerEvents="box-none">
        <Host avoids="system" style={styles.column}>
          <ColumnView top={COLUMN.top} clear={COLUMN.clear}>
            <RNHostView matchContents>
              <View>{tools}</View>
            </RNHostView>
            <CallButtons
              {...controls}
              modifiers={[
                opacity(keyboard ? 0 : 1),
                disabled(keyboard),
                animation(Animation.easeInOut({ duration: motion.toolbar / 1000 }), keyboard),
              ]}
            />
          </ColumnView>
        </Host>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  reversed: { flexDirection: 'row-reverse' },
  content: { flex: 1 },
  column: { ...StyleSheet.absoluteFill },
});
