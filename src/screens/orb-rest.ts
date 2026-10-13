const MARGIN = 24;

export type Room = { top: number; bottom: number };

// Where the orb rests between the toolbar and whatever sits below it (the call's ending and
// wrap-up, or the half-height Tasks sheet): on the screen's center while it fits there, else only
// as far up as it must go, and smaller only when the room is shorter than the orb.
export function orbRest(room: Room, center: number, size: number) {
  const scale = Math.min(1, (room.bottom - room.top - 2 * MARGIN) / size);
  const half = (size * scale) / 2;
  const y = Math.min(Math.max(center, room.top + MARGIN + half), room.bottom - MARGIN - half);
  return { y, scale };
}
