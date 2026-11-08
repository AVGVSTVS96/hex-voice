import { useEffect } from "react";
import { Settings, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useViewport } from "@/hooks/use-viewport";
import { logPose, startPoseLog } from "@/screens/pose-log";
import type { Room } from "@/screens/window";

import type { Pose } from "../../modules/pose";

export const PoseReport = ({ pose, room }: { pose: Pose; room: Room }) => {
  const window = useWindowDimensions();
  const size = useViewport();
  const insets = useSafeAreaInsets();
  useEffect(startPoseLog, []);
  useEffect(() => {
    Settings.set({ HexPose: JSON.stringify({ window, size, insets, pose, room }) });
    logPose("pose", { window, size, insets, pose, room });
  }, [window, size, insets, pose, room]);

  return null;
};
