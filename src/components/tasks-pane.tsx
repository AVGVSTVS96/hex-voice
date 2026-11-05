import { Host, Rectangle, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  clipped,
  foregroundStyle,
  frame,
  offset,
  opacity,
} from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { shapeOf, usePages } from '@/components/tasks/pages';
import { Tasks, TasksView, type TasksProps } from '@/components/tasks/tasks-view';
import type { Fold, Page } from '@/screens/layout';
import { logPose } from '@/screens/pose-log';
import { theme } from '@/theme';

// Narrower than the list's "‹ Call", which starts 16-20pt in, so the swipe strip never covers it.
const BACK_EDGE_WIDTH = 16;
const BACK_SWIPE_DISTANCE = 48;
const BACK_FLICK_SPEED = 400;

export function TasksPane({
  top,
  foot,
  width,
  style,
  ...view
}: TasksProps & {
  top: number;
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
        <TasksView {...view} width={width} foot={foot} />
      </Host>
    </Animated.View>
  );
}

// Tasks on iPhone Duo. It sits over the call, so it takes no touches while it's closed.
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
      if (translationX > BACK_SWIPE_DISTANCE || velocityX > BACK_FLICK_SPEED) scheduleOnRN(back);
    });
  return (
    <Animated.View
      testID="tasks-page"
      onLayout={({ nativeEvent: { layout } }) =>
        logPose('tasks', { ...layout, shape: pages.shape })
      }
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
        <ZStack
          alignment="top"
          modifiers={[
            frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
            clipped(),
          ]}
        >
          <Tasks
            {...view}
            pages={pages}
            room={{ width: area.width, fold, foot: page.foot, paged: true }}
          />
          {page.gap ? <Gap gap={page.gap} /> : null}
        </ZStack>
      </Host>
      <GestureDetector gesture={swipe}>
        <View testID="tasks-edge" style={styles.edge} />
      </GestureDetector>
    </Animated.View>
  );
}

// On its side partly open, a break across Tasks where the fold's frame is: what scrolls passes
// under it dimmed, so a row resting there still reads as a row, and it takes the taps in the fold
// and nowhere else.
function Gap({ gap }: { gap: Fold }) {
  return (
    <Rectangle
      modifiers={[
        frame({ height: gap.band }),
        frame({ maxWidth: Infinity }),
        foregroundStyle(theme.sheet),
        opacity(DIM),
        offset({ x: 0, y: gap.at }),
        accessibilityHidden(true),
      ]}
    />
  );
}

const DIM = 0.7;

const styles = StyleSheet.create({
  pane: { position: 'absolute', top: 0, bottom: 0, right: 0, backgroundColor: theme.sheet },
  page: { position: 'absolute' },
  fill: { flex: 1 },
  edge: { position: 'absolute', top: 0, bottom: 0, left: 0, width: BACK_EDGE_WIDTH },
});
