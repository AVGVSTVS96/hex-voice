import { setAudioModeAsync, setIsAudioActiveAsync, useAudioPlayer } from 'expo-audio';
import type { AudioMode } from 'expo-audio';
import { useEffect, useState } from 'react';

import { VOICE_PREVIEWS } from '@/live/voice-previews';
import type { LiveVoice } from '@/live/voices';

const PREVIEW_AUDIO: Partial<AudioMode> = {
  playsInSilentMode: true,
  interruptionMode: 'duckOthers',
};

const SHARED_AUDIO: Partial<AudioMode> = {
  playsInSilentMode: true,
  interruptionMode: 'mixWithOthers',
};

export const useVoicePreview = (voice: LiveVoice, playing: boolean, take = 0) => {
  const player = useAudioPlayer(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!playing) {
      return;
    }

    let open = true;
    void (async () => {
      await setAudioModeAsync(PREVIEW_AUDIO).catch(() => null);

      if (open) {
        setReady(true);
      }
    })();

    return () => {
      open = false;
      setReady(false);
      player.pause();
      void setAudioModeAsync(SHARED_AUDIO).catch(() => null);
    };
  }, [player, playing]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    let current = true;
    void (async () => {
      await setIsAudioActiveAsync(true).catch(() => null);

      if (!current) {
        return;
      }

      player.replace(VOICE_PREVIEWS[voice]);
      player.play();
    })();

    return () => {
      current = false;
    };
  }, [player, voice, ready, take]);
};
