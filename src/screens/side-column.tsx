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

export const SideColumn = ({
  column: { bar },
  tools,
  controls,
}: {
  column: NonNullable<Layout['column']>;
  tools: ReactNode;
  controls: Omit<ComponentProps<typeof CallButtons>, 'modifiers'>;
}) => {
  const keyboard = useKeyboardUp();

  if (!ColumnView) {
    return null;
  }

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
};

const styles = StyleSheet.create({
  row: { ...StyleSheet.absoluteFill, flexDirection: 'row' },
  reversed: { flexDirection: 'row-reverse' },
  content: { flex: 1 },
  column: { ...StyleSheet.absoluteFill },
});
