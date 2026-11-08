import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';

// The call's WebRTC audio shares the app's audio session, so these players keep it
// active after they finish instead of deactivating it under the call.
const options = { keepAudioSessionActive: true };

// `live` is a call on this phone, connected.
export const useCallFeedback = (
  live: boolean,
  { sounds, haptics }: { sounds: boolean; haptics: boolean },
) => {
  const connect = useAudioPlayer(require('@/assets/sounds/connect.wav'), options);
  const end = useAudioPlayer(require('@/assets/sounds/end.wav'), options);
  const previous = useRef(live);

  useEffect(() => {
    const was = previous.current;
    previous.current = live;
    if (process.env.EXPO_OS !== 'ios' || live === was) {
      return;
    }
    if (live) {
      if (haptics) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (sounds) {
        void connect.seekTo(0).then(() => {
          connect.play();
        });
      }
    } else {
      if (haptics) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      }
      if (sounds) {
        void end.seekTo(0).then(() => {
          end.play();
        });
      }
    }
  }, [live, connect, end, sounds, haptics]);
};
