import {
  callsBeside,
  stageLayout,
  wordsBefore,
  type Box,
  type CallsPlacement,
  type Stage,
  type Words,
} from '@/call/stage';
import { metrics } from '@/ui/tokens';

import type { Fold, Insets, Rect, Room, Size } from '@/screens/window';

const RAIL = 96;
const WORDS = 600;
const LIST = 360;
const RAIL_ORB = 44;

// The screen's regions for the room its window has, never the device's pose: where the call
// stage's box sits and what it keeps clear of, and where Calls and Tasks come in. The stage lays out
// its own content from its box (`stageLayout`). The bars are iOS's own (src/screens/bars.tsx), and
// the window's safe area already keeps clear of them: where the system puts its bars down the side
// (iPhone Duo), the call's buttons join them there, and the stage's box is the rest of the screen.
// Where the window's fold parts it, the call and Tasks part there too, held wide or on its side.
//
// Calls and Tasks come in from the sides, and where they go is all this decides; the call card
// looks the same either way. Calls comes in one of two ways:
// - slide: the call slides aside, showing Calls beneath (the phone, iPhone Duo folded)
// - beside: the call gives up its leading edge to Calls and moves into the room left
// - over: Calls slides in over the call, which stays where it is. On iPhone Duo with no call to
//   show (`call` false) it does, across the whole content, short of a page of its own open upright:
//   there's nothing of a call to peek at or sit beside, and its buttons stay in the bar.
// Tasks comes in one of three:
// - beside: the call gives up its trailing edge to Tasks (iPad)
// - sheet: Tasks rises as a sheet (phone)
// - page: Tasks is a place of its own over the call (iPhone Duo, see `Duo`)

// iPhone Duo's Tasks is a place of its own over the call (`tasks`), the window's safe area. Open on
// a call, a switch in the bar can give the call's words the page before the fold while Tasks keeps
// the one after it (`beside`). On its side the keyboard takes the page after the fold, so while you
// type there Tasks moves to the page before it (`typing`), the way a laptop keeps what you write
// above its keys. Spots are the window's.
export type Duo = {
  tasks: Page;
  beside?: { tasks: Page; typing?: Page; words: Words & { raise: number } };
};

// Where Tasks lays out: `area` is the window's safe area, clear of the bars and the status items,
// and its content keeps `foot` clear of the home indicator, or ends at the fold. `margin` is how far
// the window runs past it on each side.
export type Page = {
  area: Rect;
  margin: Insets;
  foot: number | 'fold';
};

// The stage's parts are in its box's coordinates; `content` is that box in the window's.
export type Layout = Stage & {
  content: Rect;
  // Before a call on iPad, Tasks opens across the screen as an inbox and the call waits in a rail.
  inbox?: Inbox;
  duo?: Duo;
};

// The bar stays where it is over the inbox, so the inbox starts `top` down, under it.
export type Inbox = {
  width: number;
  top: number;
  orb: Required<Spot>;
  controls: Place;
};

type Place = { x: number; y: number };
type Spot = Place & { size?: number };

export function screenLayout(room: Room, { call = true } = {}): Layout {
  const { size: window, insets, regular, bar, fold } = room;
  const side = bar ? (bar === 'right' ? insets.right : insets.left) : 0;
  const content = {
    x: bar === 'left' ? side : 0,
    y: 0,
    width: window.width - side,
    height: window.height,
  };
  const duo = !!(bar || fold);
  const box: Box = {
    width: content.width,
    height: content.height,
    safe: { top: insets.top, bottom: insets.bottom },
    fold: fold && ('x' in fold ? { x: fold.x - content.x } : fold),
    inBar: duo,
    regular,
  };
  const layout = stageLayout(box);
  if (!duo) return { ...layout, content, inbox: regular ? rail(window, insets) : undefined };
  const before = box.fold && wordsBefore(box, layout, box.fold);
  const {
    tasks,
    after,
    before: above,
  } = paged(
    window,
    {
      area: { ...content, y: insets.top, height: window.height - insets.top },
      foot: insets.bottom,
    },
    fold,
  );
  // Open on its side Calls comes in under the bar, leaving the bar whole. It sits beside the call,
  // as on iPad, only where that leaves the call a page; otherwise it slides over all but a peek of
  // the call, as on the phone.
  const calls = bar ? layout.calls : callsBeside(box.width, insets.top);
  const banded = !bar && calls.place === 'beside';
  const whole = !call && layout.kind !== 'split';
  return {
    ...layout,
    content,
    calls: whole ? { ...calls, width: content.width, place: 'over' } : calls,
    // Beside Calls on its side, the words keep to the room the call has left.
    ...(!banded
      ? {}
      : {
          besideCalls: {
            ...layout.words,
            x: LIST + metrics.gutter,
            width: Math.min(box.width - LIST - 2 * metrics.gutter, WORDS),
          },
        }),
    tasks: { width: content.width, place: 'page' },
    // Where Calls comes in beside the call, the orb rests whole in the room the call has left.
    orb:
      calls.place === 'beside'
        ? { ...layout.orb, dock: besideCalls(box, layout, calls) }
        : layout.orb,
    duo: {
      tasks,
      beside: after && before && { tasks: after, typing: above, words: before },
    },
  };
}

// The orb's spots beside Calls, in the stage's box: it rests midway across the room the call has
// left, and gives the words that room once there are words, shrinking away where it rests.
function besideCalls(
  box: Box,
  layout: Stage,
  calls: CallsPlacement,
): NonNullable<Stage['orb']['dock']> {
  const rest = {
    x: (calls.width + box.width) / 2,
    y: layout.orb.read.y,
    size: Math.min(layout.orb.size, (box.width - calls.width) * 0.62),
  };
  return { calls: rest, read: { ...rest, size: 0 }, tasks: rest };
}

// Before a call on iPad, the rail the call waits in beside the inbox.
function rail(window: Size, insets: Insets): Inbox {
  const bottomInset = Math.max(insets.bottom, 20) + 14;
  const foot = window.height - bottomInset - metrics.call / 2;
  return {
    width: window.width - RAIL,
    top: insets.top,
    orb: { x: RAIL / 2, y: foot - metrics.call / 2 - 20 - RAIL_ORB / 2, size: RAIL_ORB },
    controls: { x: RAIL / 2, y: foot },
  };
}

// Tasks over a page's area, and the page after the fold, the one it keeps when the call's words
// take the one before it. Held wide that's the page from the fold to the screen's end; on its side
// the screen is one tall page and the keyboard takes the bottom one, so the page before the fold is
// where it types beside the call's words.
function paged(
  window: Size,
  { area, foot }: { area: Rect; foot: number },
  fold?: Fold,
): { tasks: Page; after?: Page; before?: Page } {
  const at = (area: Rect, foot: number | 'fold'): Page => ({
    area,
    margin: {
      top: area.y,
      right: window.width - area.x - area.width,
      bottom: window.height - area.y - area.height,
      left: area.x,
    },
    foot,
  });
  const tasks = at(area, foot);
  if (!fold) return { tasks };
  if ('x' in fold)
    return { tasks, after: at({ ...area, x: fold.x, width: area.x + area.width - fold.x }, foot) };
  return {
    tasks,
    after: at({ ...area, y: fold.y, height: area.y + area.height - fold.y }, foot),
    before: at({ ...area, height: fold.y - area.y }, 'fold'),
  };
}
