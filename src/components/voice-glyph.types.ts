import type { ColorValue } from 'react-native';

export type VoiceGlyphName =
  'settings' | 'transcript' | 'calls' | 'tasks' | 'mic' | 'mic-off' | 'close' | 'waveform';

export type VoiceGlyphProps = {
  name: VoiceGlyphName;
  color: ColorValue;
  size?: number;
};
