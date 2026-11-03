import { Capsule, Circle, Rectangle, ZStack } from '@expo/ui/swift-ui';
import {
  accessibilityHidden,
  foregroundStyle,
  frame,
  offset,
  strokeBorder,
} from '@expo/ui/swift-ui/modifiers';

import { laneOf } from '@/live/lane';
import { LANE_TICKS, laneX, type Turn } from '@/live/tasks';
import { theme } from '@/theme';

const HEIGHT = 9;
const BAR = 4;
const DOT = 4;
const RING = 7;

// A project's last week at a glance: mint where it worked, a grey dot where a run ended (red if it
// failed), a mint ring where it last asked for you, and faint ticks an hour and a day back.
export function Lane({ tracks, width, now }: { tracks: Turn[][]; width: number; now: number }) {
  const { spans, ends, asked } = laneOf(tracks, now, width);
  return (
    <ZStack
      alignment="leading"
      modifiers={[frame({ width, height: HEIGHT }), accessibilityHidden(true)]}
    >
      <Rectangle modifiers={[frame({ width, height: 1 }), foregroundStyle(theme.edge)]} />
      {LANE_TICKS.map((age) => (
        <Rectangle
          key={`tick:${age}`}
          modifiers={[
            frame({ width: 1, height: 5 }),
            foregroundStyle(theme.edge),
            offset({ x: laneX(now - age, now, width) - 0.5 }),
          ]}
        />
      ))}
      {spans.map((span) => (
        <Capsule
          key={`span:${span.from}`}
          modifiers={[
            frame({ width: Math.max(BAR, span.to - span.from), height: BAR }),
            foregroundStyle(theme.accent),
            offset({ x: Math.min(span.from, width - BAR) }),
          ]}
        />
      ))}
      {ends.map((end) => (
        <Circle
          key={`end:${end.x}`}
          modifiers={[
            frame({ width: DOT, height: DOT }),
            foregroundStyle(end.failed ? theme.danger : theme.secondary),
            offset({ x: Math.min(end.x, width) - DOT / 2 }),
          ]}
        />
      ))}
      {asked === undefined ? null : (
        <Circle
          modifiers={[
            frame({ width: RING, height: RING }),
            foregroundStyle(theme.sheet),
            strokeBorder({ content: theme.accent, style: { lineWidth: 1.5 }, shape: 'circle' }),
            offset({ x: Math.min(asked, width - RING / 2) - RING / 2 }),
          ]}
        />
      )}
    </ZStack>
  );
}

export function laneWidth(width: number) {
  return Math.round(Math.min(160, Math.max(72, width * 0.22)));
}
