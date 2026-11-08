import { laneOf } from '@/live/lane';
import type { Turn } from '@/live/tasks';
import { theme } from '@/theme';

import { Lane as Native } from '../../../modules/rows';

export const Lane = ({ tracks, now }: { tracks: Turn[][]; now: number }) => {
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
};
