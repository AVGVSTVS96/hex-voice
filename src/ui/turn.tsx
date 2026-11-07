import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '@/theme';
import { metrics, radius } from '@/ui/tokens';

// One turn of a call: yours in a bubble at the trailing edge, hex's plain at the leading edge.
export function Turn({ you, children }: { you: boolean; children: ReactNode }) {
  return <View style={you ? styles.you : styles.hex}>{children}</View>;
}

const styles = StyleSheet.create({
  you: {
    alignSelf: 'flex-end',
    maxWidth: '86%',
    backgroundColor: theme.fill,
    borderRadius: radius.bubble,
    borderCurve: 'continuous',
    paddingHorizontal: metrics.bubbleX,
    paddingVertical: metrics.bubbleY,
  },
  hex: { alignSelf: 'flex-start', maxWidth: '96%' },
});
