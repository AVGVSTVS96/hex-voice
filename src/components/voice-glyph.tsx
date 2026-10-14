import { Icon } from '@expo/ui';
import { Text } from 'react-native';

import type { VoiceGlyphProps } from './voice-glyph.types';

export type { VoiceGlyphName } from './voice-glyph.types';
const symbols = {
  settings: 'slider.horizontal.3',
  transcript: 'text.bubble',
  calls: 'clock.arrow.circlepath',
  tasks: 'list.bullet',
  mic: 'mic',
  'mic-off': 'mic.slash',
  close: 'xmark',
  waveform: 'waveform',
} as const;

export function VoiceGlyph({ name, color, size = 25 }: VoiceGlyphProps) {
  if (process.env.EXPO_OS === 'ios') return <Icon name={symbols[name]} size={size} color={color} />;
  return (
    <Text style={{ color, fontSize: size }}>
      {name === 'close'
        ? '×'
        : name === 'calls'
          ? '◷'
          : name === 'settings' || name === 'transcript' || name === 'tasks'
            ? '☰'
            : name === 'mic-off'
              ? '⊘'
              : '≋'}
    </Text>
  );
}
