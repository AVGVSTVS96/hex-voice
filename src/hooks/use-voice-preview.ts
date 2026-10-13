import {
  setAudioModeAsync,
  setIsAudioActiveAsync,
  useAudioPlayer,
  type AudioMode,
} from 'expo-audio';
import { useEffect, useState } from 'react';

import { VOICE_PREVIEWS } from '@/live/voice-previews';
import type { LiveVoice } from '@/live/voices';

// A preview is a sound you asked to hear, so it plays with the silent switch on and ducks other
// apps' music instead of stopping it. Previews never play during a call, and WebRTC sets its own
// session whenever a call's audio starts, so this mode never reaches a call.
const PREVIEW_AUDIO: Partial<AudioMode> = {
  playsInSilentMode: true,
  interruptionMode: 'duckOthers',
};

export function useVoicePreview(voice: LiveVoice, playing: boolean, take = 0) {
  // The session lets go when a preview ends or stops, which brings ducked music back up.
  const player = useAudioPlayer(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!playing) return;
    let open = true;
    void setAudioModeAsync(PREVIEW_AUDIO)
      .catch(() => {})
      .then(() => open && setReady(true));
    return () => {
      open = false;
      setReady(false);
      player.pause();
    };
  }, [player, playing]);

  // Waking the audio session can take a moment, so it happens off the JavaScript thread before the
  // swipe's preview starts, leaving play() nothing slow to do.
  useEffect(() => {
    if (!ready) return;
    let current = true;
    void setIsAudioActiveAsync(true)
      .catch(() => {})
      .then(() => {
        if (!current) return;
        player.replace(VOICE_PREVIEWS[voice]);
        player.play();
      });
    return () => {
      current = false;
    };
  }, [player, voice, ready, take]);
}
