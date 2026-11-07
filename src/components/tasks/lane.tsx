import { Capsule, Circle, Mask, Rectangle, ZStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, foregroundStyle, frame, offset } from '@expo/ui/swift-ui/modifiers';

import { laneOf } from '@/live/lane';
import { laneX, type Turn } from '@/live/tasks';
import { theme } from '@/theme';

const HEIGHT = 14;
const BAR = 6;
const TICK = 3;
const HALO = 13;
// The shortest run is still a bar, never a dot.
const SHORTEST = 6;
const FAILED = 5;
const NOW = 7;
const DAY = 24 * 60 * 60_000;

// A project's last week at a glance, on a thin line marked off by day: its runs in blue, as all of
// hex's work is, full for the last day and fading the further back they go, so the latest work
// reads first; a glowing dot at its head while it works; red where a run failed. A quiet project
// is the line alone.
export function Lane({ tracks, width, now }: { tracks: Turn[][]; width: number; now: number }) {
  const { spans, failures } = laneOf(tracks, now, width);
  const live = spans.at(-1)?.to === width;
  const day = laneX(now - DAY, now, width) / width;
  return (
    <ZStack
      alignment="leading"
      modifiers={[frame({ width, height: HEIGHT }), accessibilityHidden(true)]}
    >
      <Capsule modifiers={[frame({ width, height: 1 }), foregroundStyle(theme.edge)]} />
      {[1, 2, 3, 4, 5, 6].map((days) => (
        <Circle
          key={`day:${days}`}
          modifiers={[
            frame({ width: TICK, height: TICK }),
            foregroundStyle(theme.fillStrong),
            offset({ x: laneX(now - days * DAY, now, width) - TICK / 2 }),
          ]}
        />
      ))}
      <Mask alignment="leading">
        <Rectangle
          modifiers={[
            frame({ width, height: BAR }),
            foregroundStyle({
              type: 'linearGradient',
              colors: [theme.progressFill, theme.progress],
              startPoint: { x: 0, y: 0.5 },
              endPoint: { x: day, y: 0.5 },
            }),
          ]}
        />
        <Mask.Content>
          <ZStack
            alignment="leading"
            modifiers={[frame({ width, height: BAR, alignment: 'leading' })]}
          >
            {spans.map((span) => {
              const length = Math.max(SHORTEST, span.to - span.from);
              return (
                <Capsule
                  key={`span:${span.from}`}
                  modifiers={[
                    frame({ width: length, height: BAR }),
                    offset({ x: Math.min(span.from, width - length) }),
                  ]}
                />
              );
            })}
          </ZStack>
        </Mask.Content>
      </Mask>
      {live ? (
        <ZStack
          alignment="center"
          modifiers={[frame({ width: HALO, height: HALO }), offset({ x: width - HALO })]}
        >
          <Circle modifiers={[foregroundStyle(theme.progressFill)]} />
          <Circle
            modifiers={[frame({ width: NOW, height: NOW }), foregroundStyle(theme.progress)]}
          />
        </ZStack>
      ) : null}
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

export function laneWidth(width: number) {
  return Math.round(Math.min(160, Math.max(72, width * 0.22)));
}
