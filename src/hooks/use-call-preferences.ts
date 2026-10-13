import { DEFAULT_PERSONA_COLOR, isPersonaColor } from '@/components/persona/variants';
import { useSavedPreference } from '@/hooks/use-saved-preference';

export const REACTIONS = [
  { id: 'off', label: 'Off', amount: 0 },
  { id: 'subtle', label: 'Subtle', amount: 0.07 },
  { id: 'lively', label: 'Lively', amount: 0.16 },
] as const;

export type Reaction = (typeof REACTIONS)[number]['id'];

function isReaction(value: unknown): value is Reaction {
  return REACTIONS.some((reaction) => reaction.id === value);
}

function isSwitch(value: unknown): value is 'on' | 'off' {
  return value === 'on' || value === 'off';
}

export function useCallPreferences() {
  const color = useSavedPreference('live.personaColor', DEFAULT_PERSONA_COLOR, isPersonaColor);
  const reaction = useSavedPreference<Reaction>('live.reaction', 'subtle', isReaction);
  const sounds = useSavedPreference<'on' | 'off'>('live.sounds', 'on', isSwitch);
  const haptics = useSavedPreference<'on' | 'off'>('live.haptics', 'on', isSwitch);
  return {
    personaColor: color.value,
    setPersonaColor: color.setValue,
    reaction: reaction.value,
    setReaction: reaction.setValue,
    sounds: sounds.value === 'on',
    setSounds: (on: boolean) => sounds.setValue(on ? 'on' : 'off'),
    haptics: haptics.value === 'on',
    setHaptics: (on: boolean) => haptics.setValue(on ? 'on' : 'off'),
  };
}

export type CallPreferences = ReturnType<typeof useCallPreferences>;
