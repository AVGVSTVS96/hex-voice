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
  bar?: "left" | "right" | undefined;
  fold?: Rect | undefined;
  occlusions?: Rect[] | undefined;
}

export type PoseViewProps = ViewProps & {
  onPoseChange: (event: { nativeEvent: Pose }) => void;
};

export const PoseView =
  process.env.EXPO_OS === "ios" ? requireNativeView<PoseViewProps>("Pose") : undefined;
