import type { Rect, Room } from '@/screens/window';

// iPhone Duo's column with the call buttons at its foot is a short one when folded on its side:
// below this height its buttons draw smaller and closer.
const SHORT = 520;
const GAP = 12;

// iPhone Duo's side column, as its window has it: the side the system's bars run down, how far
// from the column's middle the system draws its items, where its buttons may start below what's at
// its top and end above what's at its foot, and whether it's short.
//
// The column is the bar's inset wide, but the system doesn't center its items in it: the time,
// wifi and camera sit about 6pt toward the screen from the inset's middle, where the camera's
// occlusion is. Buttons centered on them line up with them. Where the column reports only the one
// occlusion as wide as itself, its middle is all there is to go on.
export type Column = {
  bar: 'left' | 'right';
  width: number;
  shift: number;
  top: number;
  foot: number;
  tight: boolean;
};

export function columnOf({
  size: window,
  insets,
  bar,
  occlusions,
}: Pick<Room, 'size' | 'insets' | 'bar' | 'occlusions'>): Column | undefined {
  if (!bar) return undefined;
  const width = bar === 'right' ? insets.right : insets.left;
  const x = bar === 'right' ? window.width - width : 0;
  const covers = occlusions.filter((area) => area.x < x + width && area.x + area.width > x);
  const high = (area: Rect) => area.y + area.height / 2 < window.height / 2;
  const top = covers
    .filter(high)
    .reduce((bottom, area) => Math.max(bottom, area.y + area.height), insets.top);
  const foot = covers
    .filter((area) => !high(area))
    .reduce((bottom, area) => Math.max(bottom, window.height - area.y + 8), insets.bottom);
  const items = covers.filter((area) => area.width < width);
  const center = items.length
    ? items.reduce((sum, area) => sum + area.x + area.width / 2, 0) / items.length
    : x + width / 2;
  return {
    bar,
    width,
    shift: center - (x + width / 2),
    top: Math.max(top, GAP + 4),
    foot,
    tight: window.height < SHORT,
  };
}
