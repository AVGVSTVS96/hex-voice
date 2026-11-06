import type { Layout } from '@/screens/layout';
import { radius } from '@/ui/tokens';

// The call is a card, and Calls and Tasks only move it. Calls takes its leading edge up to where
// Calls ends, or slides it aside, and its top too where Calls starts below a band; Tasks takes its
// trailing edge where it's a pane beside it, and as a sheet or a page covers it instead. Its
// corners follow from where that leaves it: a card off any edge of the screen rounds by
// `radius.card`, all the way once it has moved that far, so no screen or pose draws it square
// beside a pane. `drawer` and `pane` run 0 (shut) to 1 (open). Edges are the window's.
//
// The stage, the call's content box, stays put in the window (`stage`, its place on the card)
// unless the card slides aside, and moves by layout, never a transform, since it holds SwiftUI
// views. A hairline edges a card that slides aside or starts below a band (`lined`); beside a pane a
// card still reaches the screen's top and foot, where a hairline would only line the screen's edges.
export function cardOf(
  { calls, tasks, content }: Pick<Layout, 'calls' | 'tasks' | 'content'>,
  drawer: number,
  pane: number,
  paneWidth: number,
) {
  'worklet';
  const left = drawer * (content.x + calls.width);
  const slid = calls.place === 'slide' ? drawer * calls.width : 0;
  const top = (calls.below ?? 0) * drawer;
  const right = (tasks.place === 'beside' ? pane * paneWidth : 0) - slid;
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
}
