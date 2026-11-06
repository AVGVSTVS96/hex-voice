import { Image } from '@expo/ui/swift-ui';
import { accessibilityLabel, contentShape, frame, shapes } from '@expo/ui/swift-ui/modifiers';

import type { Call } from '@/call/call';
import { useShare } from '@/call/use-call';
import { AddMedia } from '@/components/media/add-media';
import { MOST } from '@/live/media';
import { theme } from '@/theme';
import { glass } from '@/ui/glass-button';
import { metrics, type GlassSize } from '@/ui/tokens';

// The call's +: a glass button like the call's others, and what you shoot or pick goes to the call
// as you send it. One piece, so it sits wherever the call puts it.
export function CallAdd({ call, size }: { call: Call; size: GlassSize }) {
  const share = useShare(call);
  const diameter = metrics[size];
  return (
    <AddMedia
      testID="call-add"
      most={MOST}
      sends
      onAdd={(media) => media.forEach(share)}
      label={
        <Image
          systemName="plus"
          size={metrics.symbol.regular}
          color={theme.text}
          modifiers={[
            frame({ width: diameter, height: diameter }),
            contentShape(shapes.circle()),
            glass('circle'),
            accessibilityLabel('Send a photo or video'),
          ]}
        />
      }
    />
  );
}
