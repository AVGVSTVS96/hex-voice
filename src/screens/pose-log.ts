import { Settings } from 'react-native';

const KEPT = 60;
let entries: object[] = [];
let recording = false;

export const startPoseLog = () => {
  recording = true;
};

export const logPose = (what: string, data: object) => {
  if (!recording) {
    return;
  }

  entries = [...entries.slice(-(KEPT - 1)), { at: Date.now(), what, ...data }];
  Settings.set({ HexPoseLog: JSON.stringify(entries) });
};
