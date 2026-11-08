import { requireNativeView } from "expo";
import type { ViewProps } from "react-native";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Pose {
  regular: boolean;
  bar?: "left" | "right";
  fold?: Rect;
  occlusions?: Rect[];
}

export type PoseViewProps = ViewProps & {
  onPoseChange: (event: { nativeEvent: Pose }) => void;
};

export const PoseView =
  process.env.EXPO_OS === "ios" ? requireNativeView<PoseViewProps>("Pose") : undefined;
