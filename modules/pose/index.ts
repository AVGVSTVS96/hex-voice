import { requireNativeView } from 'expo';
import type { ViewProps } from 'react-native';

export type Rect = { x: number; y: number; width: number; height: number };
export type Region = Rect & { active: boolean };

// Whether the width is regular, which side the system puts its bars on (iPhone Duo's side
// column), where the fold divides the screen, and what the cameras and system bars cover.
export type Pose = {
  regular: boolean;
  bar?: 'left' | 'right';
  fold?: Region;
  occlusions?: Rect[];
};

export type PoseViewProps = ViewProps & {
  onPoseChange: (event: { nativeEvent: Pose }) => void;
};

export const PoseView =
  process.env.EXPO_OS === 'ios' ? requireNativeView<PoseViewProps>('Pose') : undefined;
