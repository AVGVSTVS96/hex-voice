import { Host } from '@expo/ui';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { TasksView, type TasksProps } from '@/components/tasks/tasks-view';
import { theme } from '@/theme';

// Tasks on iPad: a pane down the trailing edge that stays open beside the call, the way Calls
// stays open down the leading one.
export function TasksPane({
  top,
  width,
  style,
  ...view
}: TasksProps & { top: number; width: number; style?: StyleProp<AnimatedStyle<ViewStyle>> }) {
  return (
    <Animated.View
      testID="tasks-pane"
      accessibilityElementsHidden={!view.open}
      importantForAccessibility={view.open ? 'auto' : 'no-hide-descendants'}
      style={[styles.pane, { width, paddingTop: top }, style]}
    >
      <Host seedColor={theme.tint} style={styles.fill}>
        <TasksView {...view} width={width} />
      </Host>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pane: { position: 'absolute', top: 0, bottom: 0, right: 0, backgroundColor: theme.sheet },
  fill: { flex: 1 },
});
