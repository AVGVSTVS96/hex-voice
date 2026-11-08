import { RNHostView } from '@expo/ui';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ColumnView } from '../../modules/column';
import { useKeyboardUp } from '@/hooks/use-keyboard-up';
import { motion } from '@/motion';
import { COLUMN } from '@/screens/layout';
import type { Layout } from '@/screens/layout';
import { Host } from '@/ui/host';

// iPhone Duo's side column as a sibling of the content in one row, laid out natively: it is the
// bar's inset wide, which the safe area view takes on the native side as iOS reports it, and inside
// it SwiftUI places the tools and call buttons around what covers the screen there (modules/column),
// so they land with the window's new size in the frame it changes, never over the content. It
// draws nothing of its own: the call and Tasks' backdrop run under it as before. While the keyboard
// is up over its foot, the call buttons there fade, so the glass keyboard never shows them through.
export function SideColumn({
  column: { bar },
  tools,
  controls,
}: {
  column: NonNullable<Layout['column']>;
  tools: ReactNode;
  controls: ReactNode;
}) {
  const keyboard = useKeyboardUp();
  const controlsStyle = useAnimatedStyle(() => ({
    opacity: withTiming(keyboard ? 0 : 1, { duration: motion.toolbar }),
  }));
  if (!ColumnView) return null;
  return (
    <View pointerEvents="box-none" style={[styles.row, bar === 'left' && styles.reversed]}>
      <View pointerEvents="none" style={styles.content} />
      <SafeAreaView mode="padding" edges={[bar]} pointerEvents="box-none">
        <Host style={styles.column}>
          <ColumnView top={COLUMN.top} clear={COLUMN.clear}>
            <RNHostView matchContents>
              <View>{tools}</View>
            </RNHostView>
            <RNHostView matchContents>
              <Animated.View pointerEvents={keyboard ? 'none' : 'box-none'} style={controlsStyle}>
                {controls}
              </Animated.View>
            </RNHostView>
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
