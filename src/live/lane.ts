import { laneX } from "./tasks";
import type { Turn } from "./tasks";

export interface Lane {
  spans: { from: number; to: number }[];
  failures: number[];
}

const JOIN = 0.008;
export const APART = 0.012;

export const laneOf = (tracks: Turn[][], now: number): Lane => {
  const x = (at: string) => laneX(Date.parse(at), now, 1);
  const spans: Lane["spans"] = [];
  const failures: number[] = [];

  for (const track of tracks) {
    for (const [i, turn] of track.entries()) {
      const next = track.at(i + 1);

      if (turn.state === "working") {
        spans.push({ from: x(turn.at), to: next ? x(next.at) : 1 });
      } else if (turn.state === "failed") {
        failures.push(x(turn.at));
      }
    }
  }

  return { spans: merged(spans), failures: apart(failures) };
};

const merged = (spans: Lane["spans"]) => {
  const out: Lane["spans"] = [];

  for (const span of spans.toSorted((a, b) => a.from - b.from)) {
    const last = out.at(-1);

    if (last && span.from - last.to < JOIN) {
      last.to = Math.max(last.to, span.to);
    } else {
      out.push({ ...span });
    }
  }

  return out;
};

const apart = (xs: number[]) => {
  const out: number[] = [];

  for (const x of xs.toSorted((a, b) => b - a)) {
    const last = out.at(-1);

    if (last === undefined || last - x >= APART) {
      out.push(x);
    }
  }

  return out;
};
