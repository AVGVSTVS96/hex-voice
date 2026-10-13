import { Host } from '@expo/ui';
import { Image } from '@expo/ui/swift-ui';
import type { SFSymbol } from 'sf-symbols-typescript';

export function Glyph({ name, size, color }: { name: SFSymbol; size: number; color: string }) {
  if (process.env.EXPO_OS !== 'ios') return null;
  return (
    <Host matchContents>
      <Image systemName={name} size={size} color={color} />
    </Host>
  );
}
