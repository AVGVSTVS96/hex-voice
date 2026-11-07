import { Capsule, Circle, Rectangle, ZStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, foregroundStyle, frame, offset } from '@expo/ui/swift-ui/modifiers';

import { laneOf } from '@/live/lane';
import type { Turn } from '@/live/tasks';
import { theme } from '@/theme';

const HEIGHT = 9;
const BAR = 4;
// The shortest run is still a bar, never a dot.
const SHORTEST = 6;
const FAILED = 5;

// A project's last week at a glance, on a thin line: blue where hex worked, red where a run failed.
// A quiet project is the line alone.
export function Lane({ tracks, width, now }: { tracks: Turn[][]; width: number; now: number }) {
  const { spans, failures } = laneOf(tracks, now, width);
  return (
    <ZStack
      alignment="leading"
      modifiers={[frame({ width, height: HEIGHT }), accessibilityHidden(true)]}
    >
      <Rectangle modifiers={[frame({ width, height: 1 }), foregroundStyle(theme.edge)]} />
      {spans.map((span) => {
        const length = Math.max(SHORTEST, span.to - span.from);
        return (
          <Capsule
            key={`span:${span.from}`}
            modifiers={[
              frame({ width: length, height: BAR }),
              foregroundStyle(theme.progress),
              offset({ x: Math.min(span.from, width - length) }),
            ]}
          />
        );
      })}
      {failures.map((x) => (
        <Circle
          key={`failed:${x}`}
          modifiers={[
            frame({ width: FAILED, height: FAILED }),
            foregroundStyle(theme.danger),
            offset({ x: Math.min(x, width - FAILED / 2) - FAILED / 2 }),
          ]}
        />
      ))}
    </ZStack>
  );
}
