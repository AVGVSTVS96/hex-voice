import { breakpoint } from '@/ui/tokens';

import type { Pose, Rect, Region } from '../../modules/pose';

export type { Rect, Region };
export type Size = { width: number; height: number };
export type Insets = { top: number; right: number; bottom: number; left: number };

// The app's window as layout sees it: its size and safe area, and what of the device's pose falls
// inside it. iOS reports the fold and the side the system prefers its bars on for the device,
// wherever the window is: in Split View the fold lies at the window's edge, and the bar's edge is
// reported though this window's bars may run along the top. Layout reads only this, so a window
// lays out from what it has, whatever the device around it is doing.
export type Room = {
  size: Size;
  insets: Insets;
  // The window's width class, which iOS sets from the window's own width.
  regular: boolean;
  // The side this window's bars run down, where the window keeps an inset for them.
  bar?: 'left' | 'right';
  // The fold, only where it parts this window, with a page's width on each side of it, in the
  // window's coordinates and no longer than the window.
  fold?: Region;
  // What the cameras and status items cover of the window.
  occlusions: Rect[];
};

export function roomOf(pose: Pose, size: Size, insets: Insets): Room {
  const bar =
    pose.bar && (pose.bar === 'right' ? insets.right : insets.left) > 0 ? pose.bar : undefined;
  return {
    size,
    insets,
    regular: pose.regular,
    bar,
    fold: pose.fold && parting(pose.fold, size, insets),
    occlusions: (pose.occlusions ?? []).flatMap((area) => {
      const inside = clip(area, size);
      return inside ? [inside] : [];
    }),
  };
}

// Whether the screen turns as the device does: a plain iPhone stays upright, iPad and iPhone Duo
// turn. A device fact, so it reads the pose itself.
export function turns(pose: Pose, pad: boolean) {
  return pad || !!pose.bar || !!pose.fold;
}

// The fold within the window: it parts the window only where it lies across it with a page of the
// window's safe room on either side, and then runs only as long as the window.
function parting(fold: Region, size: Size, insets: Insets): Region | undefined {
  const across = fold.height > fold.width;
  const [before, after] = across
    ? [fold.x - insets.left, size.width - insets.right - (fold.x + fold.width)]
    : [fold.y - insets.top, size.height - insets.bottom - (fold.y + fold.height)];
  if (before < breakpoint.page || after < breakpoint.page) return undefined;
  const inside = clip(fold, size);
  return inside && { ...inside, active: fold.active };
}

function clip(area: Rect, { width, height }: Size): Rect | undefined {
  const x = Math.max(0, area.x);
  const y = Math.max(0, area.y);
  const right = Math.min(width, area.x + area.width);
  const bottom = Math.min(height, area.y + area.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : undefined;
}
