import type { Layout } from "@/screens/layout";
import { metrics, radius } from "@/ui/tokens";

export const cardOf = (
  { calls, tasks, content }: Pick<Layout, "calls" | "tasks" | "content">,
  drawer: number,
  pane: number,
  paneWidth: number,
) => {
  "worklet";
  const moved = calls.place === "over" ? 0 : drawer;
  const left = moved * (content.x + calls.width);
  const slid = calls.place === "slide" ? drawer * calls.width : 0;
  const top = (calls.below ?? 0) * moved;
  const right = (tasks.place === "beside" ? pane * paneWidth : 0) - slid;
  const off = Math.max(top, left, right);
  const rounded = Math.min(1, off / radius.card);

  return {
    top,
    left,
    right,
    borderRadius: radius.card * rounded,
    lined: top > 0 || slid > 0,
    stage: { top: -top, left: content.x + slid - left },
  };
};

const TASKS_OPEN = 1;

const BAR_MIN_WIDTH = 3 * metrics.tool + 2 * metrics.toolbar.row;

export const barOf = (
  layout: Pick<Layout, "calls" | "tasks" | "content" | "toolbar">,
  window: number,
  drawer: number,
) => {
  "worklet";
  const { toolbar, calls } = layout;
  const carried = calls.below === undefined ? drawer : 0;
  const card = cardOf(layout, carried, TASKS_OPEN, layout.tasks.width);
  const left = toolbar.x + card.left;
  const end = Math.max(toolbar.x + toolbar.width - card.right, left + BAR_MIN_WIDTH);

  return { left, right: window - end };
};
