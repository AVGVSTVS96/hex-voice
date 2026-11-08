import { useEffect } from 'react';
import { useSharedValue, withSpring } from 'react-native-reanimated';

import { VoiceTone } from '../../modules/voice-tone';
import { useActive } from '@/hooks/use-watch';
import { motion } from '@/motion';

// How high your voice is and how bright it sounds, each from -1 to 1 around your own usual
// voice, while `listening` is on and the app is in front to show it. Both glide back to 0 when you
// stop talking.
export const useVoiceTone = (listening: boolean) => {
  const pitch = useSharedValue(0);
  const tone = useSharedValue(0);
  const active = useActive();
  const on = listening && active;
  useEffect(() => {
    const voice = VoiceTone;
    if (!on || !voice) return;
    const subscription = voice.addListener('onTone', (heard) => {
      pitch.set(withSpring(heard.pitch, motion.tone));
      tone.set(withSpring(heard.tone, motion.tone));
    });
    voice.start();
    return () => {
      subscription.remove();
      voice.stop();
      pitch.set(withSpring(0, motion.tone));
      tone.set(withSpring(0, motion.tone));
    };
  }, [on, pitch, tone]);
  return { pitch, tone };
};
