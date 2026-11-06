import { Capsule, Circle, Mask, Rectangle, ZStack } from '@expo/ui/swift-ui';
import { accessibilityHidden, foregroundStyle, frame, offset } from '@expo/ui/swift-ui/modifiers';

import { laneOf } from '@/live/lane';
import { laneX, startOfDay, type Turn } from '@/live/tasks';
import { theme } from '@/theme';

const HEIGHT = 12;
const BAR = 4;
// The shortest run is still a bar, never a dot.
const SHORTEST = 6;
const FAILED = 5;
const NOW = 6;
const GLOW = 12;
const TICK = 6;

// A project's last week at a glance, on a thin line: its runs in mint, deepening from the week's
// far end to now, so the latest work reads first; a lit dot at now while it works; a tick where
// today began; red where a run failed. A quiet project is the line alone.
export function Lane({ tracks, width, now }: { tracks: Turn[][]; width: number; now: number }) {
  const { spans, failures } = laneOf(tracks, now, width);
  const live = spans.at(-1)?.to === width;
  const today = laneX(startOfDay(new Date(now)), now, width);
  return (
    <ZStack
      alignment="leading"
      modifiers={[frame({ width, height: HEIGHT }), accessibilityHidden(true)]}
    >
      <Capsule modifiers={[frame({ width, height: 1 }), foregroundStyle(theme.edge)]} />
      <Capsule
        modifiers={[
          frame({ width: 1, height: TICK }),
          foregroundStyle(theme.tertiary),
          offset({ x: today }),
        ]}
      />
      <Mask alignment="leading">
        <Rectangle
          modifiers={[
            frame({ width, height: BAR }),
            foregroundStyle({
              type: 'linearGradient',
              colors: [theme.accentTrack, theme.accent],
              startPoint: { x: 0, y: 0.5 },
              endPoint: { x: 1, y: 0.5 },
            }),
          ]}
        />
        <Mask.Content>
          <ZStack alignment="leading" modifiers={[frame({ width, height: BAR })]}>
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
        <ZStack modifiers={[frame({ width: GLOW, height: GLOW }), offset({ x: width - GLOW })]}>
          <Circle modifiers={[foregroundStyle(theme.accentMuted)]} />
          <Circle modifiers={[frame({ width: NOW, height: NOW }), foregroundStyle(theme.accent)]} />
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
