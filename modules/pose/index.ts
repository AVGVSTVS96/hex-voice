import { requireNativeView } from 'expo';
import type { ViewProps } from 'react-native';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Whether the width is regular, which side the system puts its bars on (iPhone Duo's side
// column), the fold's whole frame (the same at every angle), and what the cameras and system bars
// cover.
export interface Pose {
  regular: boolean;
  bar?: 'left' | 'right';
  fold?: Rect;
  occlusions?: Rect[];
}

export type PoseViewProps = ViewProps & {
  onPoseChange: (event: { nativeEvent: Pose }) => void;
};

export const PoseView =
  process.env.EXPO_OS === 'ios' ? requireNativeView<PoseViewProps>('Pose') : undefined;
