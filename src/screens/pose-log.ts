import { Settings } from 'react-native';

const KEPT = 60;
let entries: object[] = [];
let recording = false;

export const startPoseLog = () => {
  recording = true;
};

// oxlint-disable-next-line anti-slop/no-object-parameters -- a debug log: it writes whichever snapshot it's handed as JSON, and reads none of it
export const logPose = (what: string, data: object) => {
  if (!recording) {
    return;
  }

  entries = [...entries.slice(-(KEPT - 1)), { at: Date.now(), what, ...data }];
  Settings.set({ HexPoseLog: JSON.stringify(entries) });
};
