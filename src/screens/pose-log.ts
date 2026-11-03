import { Settings } from 'react-native';

// What the screen saw and laid out, with the time of each, for scripts/duo's checks to line up
// against their shots (HexPoseLog). It records only once a check asks for the pose report.
const KEPT = 60;
let entries: object[] = [];
let recording = false;

export function startPoseLog() {
  recording = true;
}

export function logPose(what: string, data: object) {
  if (!recording) return;
  entries = [...entries.slice(-(KEPT - 1)), { at: Date.now(), what, ...data }];
  Settings.set({ HexPoseLog: JSON.stringify(entries) });
}
