import { breakpoint } from "@/ui/tokens";

import type { Pose, Rect } from "../../modules/pose";

export type { Rect } from "../../modules/pose";

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

export interface Room {
  size: Size;
  insets: Insets;
  regular: boolean;
  bar?: "left" | "right" | undefined;
  fold?: Fold | undefined;
  occlusions: Rect[];
}

export const roomOf = (pose: Pose, size: Size, insets: Insets): Room => {
  const bar =
    pose.bar && (pose.bar === "right" ? insets.right : insets.left) > 0 ? pose.bar : undefined;

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
