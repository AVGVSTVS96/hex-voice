import { breakpoint } from '@/ui/tokens';

import type { Pose, Rect } from '../../modules/pose';

export type { Rect };

// Where the fold divides the window: a line down it at `x`, or across it at `y`.
export type Fold = { x: number } | { y: number };

export interface Size {
  width: number;
  height: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// The app's window as layout sees it: its size and safe area, and what of the device's pose falls
// inside it. iOS reports the fold and the side the system prefers its bars on for the device,
// wherever the window is: in Split View the fold lies at the window's edge, and the bar's edge is
// reported though this window's bars may run along the top. Layout reads only this, so a window
// lays out from what it has, whatever the device around it is doing.
export interface Room {
  size: Size;
  insets: Insets;
  // The window's width class, which iOS sets from the window's own width.
  regular: boolean;
  // The side this window's bars run down, where the window keeps an inset for them.
  bar?: 'left' | 'right';
  // The fold, only where it parts this window, with a page's width on each side of it, in the
  // window's coordinates.
  fold?: Fold;
  // What the cameras and status items cover of the window.
  occlusions: Rect[];
}

export const roomOf = (pose: Pose, size: Size, insets: Insets): Room => {
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
};

// The fold within the window: it parts the window only where it lies across it with a page of the
// window's safe room on either side, and then it's the line down the middle of iOS's division
// region. How far the Duo is folded never reaches layout: Apple asks folding to move only what it
// must.
const parting = (fold: Rect, size: Size, insets: Insets): Fold | undefined => {
  const across = fold.height > fold.width;

  const [before, after] = across
    ? [fold.x - insets.left, size.width - insets.right - (fold.x + fold.width)]
    : [fold.y - insets.top, size.height - insets.bottom - (fold.y + fold.height)];

  if (before < breakpoint.page || after < breakpoint.page) {
    return undefined;
  }

  return across ? { x: fold.x + fold.width / 2 } : { y: fold.y + fold.height / 2 };
};

const clip = (area: Rect, { width, height }: Size): Rect | undefined => {
  const x = Math.max(0, area.x);
  const y = Math.max(0, area.y);
  const right = Math.min(width, area.x + area.width);
  const bottom = Math.min(height, area.y + area.height);

  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : undefined;
};
