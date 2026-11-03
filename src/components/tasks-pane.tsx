import { Host } from '@expo/ui/swift-ui';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { shapeOf, usePages } from '@/components/tasks/pages';
import { Tasks, TasksView, type TasksProps } from '@/components/tasks/tasks-view';
import type { Page } from '@/screens/layout';
import { theme } from '@/theme';

// How far in from Tasks' leading edge a swipe goes back, and how far or fast it has to travel.
const EDGE = 16;
const SWIPE = 48;
const FLICK = 400;

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

// Tasks on iPhone Duo: a place of its own beside the call's column, split into pages at the fold
// while the Duo is open (`page`), drawn clear over the screen's backdrop. Back on its list, or a
// swipe in from its leading edge on any page, goes back a level, and from the list to the call
// (`onClose`). It takes no touches while it's closed, since it sits over the call.
export function TasksPage({
  page,
  onClose,
  style,
  ...view
}: TasksProps & {
  page: Page;
  onClose: () => void;
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
}) {
  const { area, fold } = page;
  const pages = usePages({
    open: view.open,
    at: view.at,
    shape: shapeOf(area.width, fold),
    onClose,
  });
  const { back } = pages;
  const swipe = Gesture.Pan()
    .activeOffsetX(12)
    .failOffsetY([-14, 14])
    .onEnd(({ translationX, velocityX }) => {
      if (translationX > SWIPE || velocityX > FLICK) scheduleOnRN(back);
    });
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
        <Tasks
          {...view}
          pages={pages}
          room={{
            width: area.width,
            height: area.height,
            fold,
            top: page.top,
            foot: page.foot,
            inset: page.inset,
            paged: true,
          }}
        />
      </Host>
      <GestureDetector gesture={swipe}>
        <View testID="tasks-edge" style={styles.edge} />
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pane: { position: 'absolute', top: 0, bottom: 0, right: 0, backgroundColor: theme.sheet },
  page: { position: 'absolute' },
  fill: { flex: 1 },
  edge: { position: 'absolute', top: 0, bottom: 0, left: 0, width: EDGE },
});
