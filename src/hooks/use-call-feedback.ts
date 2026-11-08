import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';

import connectSound from '@/assets/sounds/connect.wav';
import endSound from '@/assets/sounds/end.wav';

const options = { keepAudioSessionActive: true };

export const useCallFeedback = (
  live: boolean,
  { sounds, haptics }: { sounds: boolean; haptics: boolean },
) => {
  const connect = useAudioPlayer(connectSound, options);
  const end = useAudioPlayer(endSound, options);
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
        void (async () => {
          await connect.seekTo(0);
          connect.play();
        })();
      }
    } else {
      if (haptics) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      }

      if (sounds) {
        void (async () => {
          await end.seekTo(0);
          end.play();
        })();
      }
    }
  }, [live, connect, end, sounds, haptics]);
};
