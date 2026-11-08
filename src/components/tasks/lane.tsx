import { laneOf } from '@/live/lane';
import type { Turn } from '@/live/tasks';
import { theme } from '@/theme';

import { Lane as Native } from '../../../modules/rows';

// A project's last week at a glance, across the row: blue where hex worked, red where a run failed.
// A quiet project is the line alone.
export function Lane({ tracks, now }: { tracks: Turn[][]; now: number }) {
  const { spans, failures } = laneOf(tracks, now);
  return (
    <Native
      spans={spans}
      failures={failures}
      line={theme.edge}
      work={theme.progress}
      failure={theme.danger}
    />
  );
}
