import { ArrangementView, Host, Spacer } from '@expo/ui/swift-ui';
import { arrangementViewStyle, frame, onGeometryChange } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

import type { Panes } from '@/screens/layout';

// How iOS arranges the open screen into two panes: side by side only where it's wider than tall,
// meeting on the crease flat and parting around the fold partly open. It spans the whole screen,
// past every safe area and the keyboard, so typing never rearranges it, and draws nothing: what
// moves between the panes (Tasks' pages sliding along) lays out in one space at the panes it
// reports. Each pane holds a spacer, since iOS draws a bar along an empty one.
export function Arrangement({
  onPane,
}: {
  onPane: (pane: keyof Panes, span: Panes[keyof Panes]) => void;
}) {
  const pane = (name: keyof Panes) => (
    <Spacer
      modifiers={[
        frame({ maxWidth: Infinity, maxHeight: Infinity }),
        onGeometryChange(({ x, width }) => onPane(name, { x, width })),
      ]}
    />
  );
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <Host ignoreSafeArea="all" style={styles.fill}>
        <ArrangementView
          modifiers={[
            arrangementViewStyle('split', { axes: 'horizontal' }),
            frame({ maxWidth: Infinity, maxHeight: Infinity }),
          ]}
        >
          <ArrangementView.Primary>{pane('first')}</ArrangementView.Primary>
          <ArrangementView.Secondary>{pane('second')}</ArrangementView.Secondary>
        </ArrangementView>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
