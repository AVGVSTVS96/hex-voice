import { Spacer } from '@expo/ui';
import { Capsule, Circle, Rectangle, ZStack } from '@expo/ui/swift-ui';
import {
  background,
  clipShape,
  foregroundStyle,
  frame,
  offset,
  strokeBorder,
} from '@expo/ui/swift-ui/modifiers';
import type { ReactNode } from 'react';

import { LANE_TICKS, laneX, type Turn } from '@/live/tasks';
import { theme } from '@/theme';

const LANE = 10;

export function Lane({
  tracks,
  width,
  now = Date.now(),
}: {
  tracks: Turn[][];
  width: number;
  now?: number;
}) {
  const x = (at: string) => laneX(Date.parse(at), now, width);
  const marks: ReactNode[] = LANE_TICKS.map((age) => (
    <Rectangle
      key={`tick:${age}`}
      modifiers={[
        frame({ width: 1, height: 5 }),
        foregroundStyle(theme.edge),
        offset({ x: laneX(now - age, now, width) - 0.5 }),
      ]}
    />
  ));
  tracks.forEach((track, t) => {
    let bar: { from: number; to: number } | undefined;
    const flush = (key: string) => {
      if (!bar) return;
      marks.push(
        <Capsule
          key={key}
          modifiers={[
            frame({ width: Math.max(2, bar.to - bar.from), height: 5 }),
            foregroundStyle(theme.accent),
            offset({ x: Math.min(bar.from, width - 2) }),
          ]}
        />,
      );
      bar = undefined;
    };
    track.forEach((turn, i) => {
      const from = x(turn.at);
      const to = i + 1 < track.length ? x(track[i + 1]!.at) : width;
      const key = `${t}:${i}`;
      if (turn.state === 'working') {
        if (bar && from - bar.to < 1.5 && to - from < 3) bar.to = to;
        else {
          flush(`${key}:bar`);
          bar = { from, to: to - from >= 3 ? to - 1 : to };
        }
        return;
      }
      flush(`${key}:bar`);
      const asked = turn.state === 'needs' && track[i - 1]?.state !== 'needs';
      if (turn.state === 'needs' && to - from >= 2)
        marks.push(
          <Capsule
            key={key}
            modifiers={[
              frame({ width: to - from, height: 1.5 }),
              foregroundStyle(theme.accentTrack),
              offset({ x: from }),
            ]}
          />,
        );
      if (asked || turn.state === 'done' || turn.state === 'failed')
        marks.push(
          asked ? (
            <Spacer
              key={`${key}:at`}
              modifiers={[
                frame({ width: 7, height: 7 }),
                background(theme.sheet),
                clipShape('circle'),
                strokeBorder({ content: theme.accent, style: { lineWidth: 1.6 }, shape: 'circle' }),
                offset({ x: from - 3.5 }),
              ]}
            />
          ) : (
            <Circle
              key={`${key}:at`}
              modifiers={[
                frame({ width: 5, height: 5 }),
                foregroundStyle(turn.state === 'failed' ? theme.danger : theme.secondary),
                offset({ x: from - 2.5 }),
              ]}
            />
          ),
        );
    });
    flush(`${t}:end`);
  });
  return (
    <ZStack alignment="leading" modifiers={[frame({ width, height: LANE })]}>
      <Rectangle modifiers={[frame({ width, height: 1 }), foregroundStyle(theme.edge)]} />
      {marks}
    </ZStack>
  );
}

export function laneWidth(width: number) {
  return Math.round(Math.min(240, Math.max(84, width * 0.25)));
}
