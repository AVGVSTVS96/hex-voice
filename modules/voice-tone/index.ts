import { NativeModule, requireOptionalNativeModule } from 'expo';

export type Tone = { pitch: number; tone: number };

declare class VoiceToneModule extends NativeModule<{ onTone: (tone: Tone) => void }> {
  start(): void;
  stop(): void;
}

export const VoiceTone = requireOptionalNativeModule<VoiceToneModule>('VoiceTone');
