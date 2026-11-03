import { Host } from '@expo/ui/swift-ui';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import { TasksView, type TasksProps } from '@/components/tasks/tasks-view';
import type { Page } from '@/screens/layout';
import { theme } from '@/theme';

// Tasks on iPad: a pane down the trailing edge that stays open beside the call, the way Calls
// stays open down the leading one. Its title sits on the toolbar's line (`toolbar` is that line's
// height), and its list runs to the screen's foot, under the buttons that float clear of the
// home indicator (`foot`).
export function TasksPane({
  top,
  toolbar,
  foot,
  width,
  style,
  ...view
}: TasksProps & {
  top: number;
  toolbar: number;
  foot: number;
  width: number;
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
}) {
  return (
    <Animated.View
      testID="tasks-pane"
      accessibilityElementsHidden={!view.open}
      importantForAccessibility={view.open ? 'auto' : 'no-hide-descendants'}
      style={[styles.pane, { width, paddingTop: top }, style]}
    >
      <Host seedColor={theme.tint} ignoreSafeArea="container" style={styles.fill}>
        <TasksView {...view} width={width} line={toolbar - top} foot={foot} />
      </Host>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pane: { position: 'absolute', top: 0, bottom: 0, right: 0, backgroundColor: theme.sheet },
  page: { position: 'absolute', backgroundColor: theme.sheet },
  fill: { flex: 1 },
});

// Tasks on iPhone Duo: a place of its own beside the call's column, split into pages at the fold
// while the Duo is open (`page`). It takes no touches while it's closed, since it sits over the call.
export function TasksPage({
  page,
  style,
  ...view
}: TasksProps & { page: Page; style?: StyleProp<AnimatedStyle<ViewStyle>> }) {
  const { area } = page;
  return (
    <Animated.View
      testID="tasks-page"
      pointerEvents={view.open ? 'auto' : 'none'}
      accessibilityElementsHidden={!view.open}
      importantForAccessibility={view.open ? 'auto' : 'no-hide-descendants'}
      style={[
        styles.page,
        { left: area.x, top: area.y, width: area.width, height: area.height },
        style,
      ]}
    >
      <Host seedColor={theme.tint} ignoreSafeArea="container" style={styles.fill}>
        <TasksView
          {...view}
          paged
          width={area.width}
          height={area.height}
          fold={page.fold}
          top={page.top}
          foot={page.foot}
        />
      </Host>
    </Animated.View>
  );
}
