import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioPlayer,
  type AudioMode,
} from 'expo-audio';
import { useEffect } from 'react';

import { VOICE_PREVIEWS } from '@/live/voice-previews';
import type { LiveVoice } from '@/live/voices';

// A preview is a sound you asked to hear, so it plays with the silent switch on and ducks other
// apps' music instead of stopping it. Previews never play during a call, and WebRTC sets its own
// session whenever a call's audio starts, so this mode never reaches a call.
const PREVIEW_AUDIO: Partial<AudioMode> = {
  playsInSilentMode: true,
  interruptionMode: 'duckOthers',
};
// The call's chimes keep the audio session awake, so ending a preview doesn't let it go: music
// comes back up only once the mode stops asking to duck it.
const SHARED_AUDIO: Partial<AudioMode> = {
  playsInSilentMode: true,
  interruptionMode: 'mixWithOthers',
};
const share = () => void setAudioModeAsync(SHARED_AUDIO).catch(() => {});

export function useVoicePreview(voice: LiveVoice, playing: boolean, take = 0) {
  const player = useAudioPlayer(null);

  useEffect(() => {
    const finished = player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) share();
    });
    return () => finished.remove();
  }, [player]);

  useEffect(() => {
    if (!playing) return;
    return () => {
      player.pause();
      share();
    };
  }, [player, playing]);

  useEffect(() => {
    if (!playing) return;
    let current = true;
    void setAudioModeAsync(PREVIEW_AUDIO)
      .then(() => setIsAudioActiveAsync(true))
      .catch(() => {})
      .then(() => {
        if (!current) return;
        player.replace(VOICE_PREVIEWS[voice]);
        player.play();
      });
    return () => {
      current = false;
    };
  }, [player, voice, playing, take]);
}
