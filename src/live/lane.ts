import { laneX, type Turn } from './tasks';

// A project's last week as one lane `width` wide, now at the right: when any of its threads worked
// (`spans`), where each run ended (`ends`, failed ones marked), and when it last asked for you
// (`asked`). All its threads share the one lane, so stretches that touch merge, a run's end inside
// a stretch isn't marked, and marks too close to tell apart keep only the newest, so nothing draws
// over anything else.
export type Lane = {
  spans: { from: number; to: number }[];
  ends: { x: number; failed: boolean }[];
  asked?: number;
};

// Closer than this, two stretches read as one and two marks as a smudge.
const JOIN = 3;
const APART = 7;

export function laneOf(tracks: Turn[][], now: number, width: number): Lane {
  const x = (at: string) => laneX(Date.parse(at), now, width);
  const spans: Lane['spans'] = [];
  const ends: Lane['ends'] = [];
  let asked: number | undefined;
  for (const track of tracks)
    track.forEach((turn, i) => {
      const from = x(turn.at);
      const next = track[i + 1];
      if (turn.state === 'working') spans.push({ from, to: next ? x(next.at) : width });
      else if (turn.state === 'needs' && track[i - 1]?.state !== 'needs')
        asked = Math.max(asked ?? -Infinity, from);
      else if (turn.state === 'done' || turn.state === 'failed')
        ends.push({ x: from, failed: turn.state === 'failed' });
    });
  const work = merged(spans);
  // A run that ends inside a stretch of work says nothing the stretch doesn't, so only a failure
  // shows there.
  const loose = ends.filter(
    (end) =>
      end.failed || !work.some((span) => end.x >= span.from - JOIN && end.x <= span.to + JOIN),
  );
  return { spans: work, ends: apart(loose, asked), asked };
}

function merged(spans: Lane['spans']) {
  const out: Lane['spans'] = [];
  for (const span of [...spans].sort((a, b) => a.from - b.from)) {
    const last = out.at(-1);
    if (last && span.from - last.to < JOIN) last.to = Math.max(last.to, span.to);
    else out.push({ ...span });
  }
  return out;
}

// Newest first, each mark keeps clear of the one after it and of the ask's ring.
function apart(ends: Lane['ends'], asked?: number) {
  const out: Lane['ends'] = [];
  for (const end of [...ends].sort((a, b) => b.x - a.x)) {
    const near = (x: number) => Math.abs(x - end.x) < APART;
    if (asked !== undefined && near(asked)) continue;
    const last = out.at(-1);
    if (last && near(last.x)) {
      if (end.failed) last.failed = true;
      continue;
    }
    out.push({ ...end });
  }
  return out;
}
