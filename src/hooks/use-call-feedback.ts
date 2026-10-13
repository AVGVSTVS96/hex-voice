import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';

import type { LiveStatus } from '@/live/types';

// The call's WebRTC audio shares the app's audio session, so these players keep it
// active after they finish instead of deactivating it under the call.
const options = { keepAudioSessionActive: true };

export function useCallFeedback(
  status: LiveStatus,
  { sounds, haptics }: { sounds: boolean; haptics: boolean },
) {
  const connect = useAudioPlayer(require('@/assets/sounds/connect.wav'), options);
  const end = useAudioPlayer(require('@/assets/sounds/end.wav'), options);
  const previous = useRef(status);

  useEffect(() => {
    const was = previous.current;
    previous.current = status;
    if (process.env.EXPO_OS !== 'ios') return;
    if (status === 'connected' && was !== 'connected') {
      if (haptics) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (sounds) void connect.seekTo(0).then(() => connect.play());
    } else if (was === 'connected' && status !== 'connected') {
      if (haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      if (sounds) void end.seekTo(0).then(() => end.play());
    }
  }, [status, connect, end, sounds, haptics]);
}
