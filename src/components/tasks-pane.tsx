import { ZStack } from '@expo/ui/swift-ui';
import { clipped, frame } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { pagedRoom, shapeOf, usePages } from '@/components/tasks/pages';
import { Tasks, TasksView, type TasksProps } from '@/components/tasks/tasks-view';
import type { Page } from '@/screens/layout';
import { logPose } from '@/screens/pose-log';
import { theme } from '@/theme';
import { AnimatedView } from '@/ui/animated-view';
import { Host } from '@/ui/host';

// Narrower than the list's "‹ Call", which starts 16-20pt in, so the swipe strip never covers it.
const BACK_EDGE_WIDTH = 16;
const BACK_SWIPE_DISTANCE = 48;
const BACK_FLICK_SPEED = 400;

export function TasksPane({
  top,
  foot,
  width,
  animate,
  ...view
}: TasksProps & {
  top: number;
  foot: number;
  width: number;
  animate: () => ViewStyle;
}) {
  return (
    <AnimatedView
      testID="tasks-pane"
      accessibilityElementsHidden={!view.open}
      importantForAccessibility={view.open ? 'auto' : 'no-hide-descendants'}
      style={[styles.pane, { width, paddingTop: top }]}
      animate={animate}
    >
      <Host seedColor={theme.tint} avoids="keyboard" style={styles.host}>
        <TasksView {...view} width={width} foot={foot} />
      </Host>
    </AnimatedView>
  );
}

// Tasks on iPhone Duo. It sits over the call, so it takes no touches while it's closed. A whole
// page fills the window's safe area as iOS lays it out, so a turn or fold lands with it in place;
// a page of its own beside the fold is placed by its margins.
export function TasksPage({
  page,
  whole,
  onClose,
  style,
  ...view
}: TasksProps & {
  page: Page;
  whole: boolean;
  onClose: () => void;
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
}) {
  const room = pagedRoom(page);
  const pages = usePages({ stack: view.stack, onMove: view.onMove, shape: shapeOf(room), onClose });
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
      style={[styles.page, whole ? styles.fill : page.margin, style]}
    >
      <SafeAreaView
        mode="padding"
        edges={whole ? ['top', 'left', 'right'] : []}
        style={styles.host}
      >
        <Host seedColor={theme.tint} avoids="keyboard" style={styles.host}>
          <ZStack
            alignment="top"
            modifiers={[
              frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'top' }),
              clipped(),
            ]}
          >
            <Tasks {...view} pages={pages} room={room} />
          </ZStack>
        </Host>
        <GestureDetector gesture={swipe}>
          <View testID="tasks-edge" style={styles.edge} />
        </GestureDetector>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pane: { position: 'absolute', top: 0, bottom: 0, right: 0, backgroundColor: theme.sheet },
  page: { position: 'absolute' },
  fill: { ...StyleSheet.absoluteFill },
  host: { flex: 1 },
  edge: { position: 'absolute', top: 0, bottom: 0, left: 0, width: BACK_EDGE_WIDTH },
});
