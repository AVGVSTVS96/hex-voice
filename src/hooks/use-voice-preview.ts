import { useAudioPlayer } from 'expo-audio';
import { useEffect } from 'react';

import { VOICE_PREVIEWS } from '@/live/voice-previews';
import type { LiveVoice } from '@/live/voices';

// Like the call sounds, keep the audio session active so a preview never deactivates it under a call.
const options = { keepAudioSessionActive: true };

export function useVoicePreview(voice: LiveVoice, playing: boolean, take = 0) {
  const player = useAudioPlayer(null, options);

  useEffect(() => {
    if (!playing) return;
    player.replace(VOICE_PREVIEWS[voice]);
    player.play();
    return () => player.pause();
  }, [player, voice, playing, take]);
}
