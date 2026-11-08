import { useEffect } from 'react';
import { Settings, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useViewport } from '@/hooks/use-viewport';
import { logPose, startPoseLog } from '@/screens/pose-log';
import type { Room } from '@/screens/window';
import type { Pose } from '../../modules/pose';

// Writes the window, the size the screen lays out at, the safe area, the pose and the room it
// leaves the window (`roomOf`) to the app's defaults (HexPose), where scripts/duo reads them, and
// starts the timed log of them and of where the screen's parts were laid out (HexPoseLog), so a
// check can see what changed between shots.
// The one reader of the window, to show where it and the screen's size disagree.
export const PoseReport = ({ pose, room }: { pose: Pose; room: Room }) => {
  const window = useWindowDimensions();
  const size = useViewport();
  const insets = useSafeAreaInsets();
  useEffect(startPoseLog, []);
  useEffect(() => {
    Settings.set({ HexPose: JSON.stringify({ window, size, insets, pose, room }) });
    logPose('pose', { window, size, insets, pose, room });
  }, [window, size, insets, pose, room]);

  return null;
};
