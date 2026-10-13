export type VoiceGlyphName =
  'settings' | 'captions' | 'calls' | 'tasks' | 'mic' | 'mic-off' | 'close' | 'waveform';

export type VoiceGlyphProps = {
  name: VoiceGlyphName;
  color: string;
  size?: number;
};
