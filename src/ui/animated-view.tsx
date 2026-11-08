import type { ComponentProps } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

export const AnimatedView = ({
  animate,
  style,
  ...view
}: ComponentProps<typeof Animated.View> & { animate: () => ViewStyle }) => {
  const animated = useAnimatedStyle(animate);

  return <Animated.View {...view} style={[style, animated]} />;
};
