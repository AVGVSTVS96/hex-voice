import type { ComponentProps } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

// A view that only some layouts or moments show makes its animated style as it mounts, from a
// worklet its parent hands it. Reanimated draws a view's first frame by its style's first worklet,
// with the values that worklet closed over then, and after that writes only what changes: a style
// made by a parent that outlives the view would draw it at the parent's first layout.
export function AnimatedView({
  animate,
  style,
  ...view
}: ComponentProps<typeof Animated.View> & { animate: () => ViewStyle }) {
  const animated = useAnimatedStyle(animate);
  return <Animated.View {...view} style={[style, animated]} />;
}
