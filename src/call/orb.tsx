import { useEffect, useState } from 'react';
import {
  useAnimatedReaction,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { personaOf, wakeOf } from '@/call/call';
import type { Call } from '@/call/call';
import { useLevels } from '@/call/use-call';
import { Persona } from '@/components/persona';
import type { PersonaProps } from '@/components/persona';
import { useVoiceTone } from '@/hooks/use-voice-tone';
import { motion } from '@/motion';

export const CallPersona = ({ call, ...persona }: { call: Call } & Omit<PersonaProps, 'state'>) => {
  const [speaking, setSpeaking] = useState(false);
  useLevels(({ output }) => {
    setSpeaking(output > 0.035);
  });

  return <Persona {...persona} state={personaOf(call, speaking)} />;
};

export const useOrbLife = (
  call: Call,
  { reducedMotion, reaction }: { reducedMotion: boolean; reaction: number },
) => {
  const wake = useSharedValue(0);
  const breath = useSharedValue(0);
  const level = useSharedValue(0);
  const input = useSharedValue(0);
  const awake = wakeOf(call);

  const reacting =
    call.kind === 'here' &&
    call.phase === 'live' &&
    !call.mic.muted &&
    !reducedMotion &&
    reaction > 0;

  const { pitch, tone } = useVoiceTone(reacting);

  useEffect(() => {
    if (reducedMotion) {
      wake.set(awake);
      breath.set(0);

      return;
    }

    wake.set(
      awake === 1
        ? withSpring(1, motion.wake)
        : withTiming(awake, {
            duration: awake === 0 ? motion.settle.asleep : motion.settle.connecting,
            easing: motion.settle.easing,
          }),
    );
    breath.set(
      awake === 0
        ? withRepeat(withTiming(1, motion.breath), -1, true)
        : withTiming(0, { duration: motion.breath.out }),
    );
  }, [awake, reducedMotion, wake, breath]);

  useLevels((levels) => {
    input.set(levels.input);
  });
  useAnimatedReaction(
    () => (reacting ? Math.max(0, input.get() - 0.06) / 0.94 : 0),
    (loudness, before) => {
      if (loudness !== before) {
        level.set(withSpring(loudness, motion.reaction));
      }
    },
    [reacting],
  );

  return { wake, breath, level, pitch, tone };
};
