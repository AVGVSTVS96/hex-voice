const MARGIN = 24;

export interface Room {
  top: number;
  bottom: number;
}

export const orbRest = (room: Room, center: number, size: number, most = size) => {
  const scale = Math.min(1, (room.bottom - room.top - 2 * MARGIN) / size, most / size);
  const half = (size * scale) / 2;
  const y = Math.min(Math.max(center, room.top + MARGIN + half), room.bottom - MARGIN - half);

  return { y, scale };
};
