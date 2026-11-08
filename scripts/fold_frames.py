#!/usr/bin/env python3
"""Counts the frames the app shows a wrong layout after each Duo move, from `scripts/duo fold`'s films.

    scripts/fold_frames.py <dir>

<dir> holds, per state, a film of each screen (<state>-1.mov the cover, <state>-3.mov the open
screen) through the same moves, the ms each film started (<state>-<screen>.start) and its moves
(<state>-<screen>-moves.txt: "<ms> <from> <to>"). Each move is cut from the film of the screen it
lands on at 60 frames a second, as iOS draws, from a little before it until the next, and runs from
the first frame that changed (a lit screen's first, when the Duo changes screens) to the first of
the final layout, after which nothing changes.

Part of that is iOS's own: the screen lighting, the turn's animation, the home screen shown while
the app's window moves. The state named "probe" is a plain UIKit app that lays out in the pass that
resizes its window (FoldProbe), filmed through the same moves, so how long it takes from its first
changed frame to its final one is iOS's part. A move counts as landed that long after the app's own
first changed frame, and the frames the app shows after that which aren't its final layout are the
app's: drawn for the old window, or in pieces. Without a probe, every frame counts.

It writes table.md, and per move a sheet of its frames, each labelled by its ms after iOS landed.
"""
import subprocess
import sys
from pathlib import Path

FPS = 60
# Gray frames this small keep a layout's shape and lose the orb's breathing and the clock's digits.
SIDE = 128
# A pixel has changed past this many gray levels, and a frame past this share of its pixels.
LEVELS = 32
SHARE = 0.005
# The probe's layout is a few big blocks, and the home indicator iOS fades in and dims for seconds
# after a move is under this share of it, so the probe's own landing ignores it.
PROBE_SHARE = 0.03
BEFORE = 0.25
# A film's first frame comes a little after the simulator says it started, so a cut stops this far
# short of the next move.
AFTER = 0.6
# A move is counted over this long after it, and the Duo is held a while longer (FOLD_HOLD in
# scripts/duo): the frame at the end of that hold is what settled looks like, so a cut whose last
# frame isn't it was still changing, or stuck, and isn't counted as settled.
WINDOW = 4.0


def screen_of(pose):
    return 1 if pose.startswith('cover') else 3


def differs(a, b, share=SHARE):
    changed = sum(1 for x, y in zip(a, b) if abs(x - y) > LEVELS)
    return changed > share * len(a)


def dark(frame):
    return max(frame) < LEVELS


def settle(frames, same=None, off_screen=dark):
    """(first, last): the first frame that moved, ignoring a dark screen, which is off, and the
    first of the final layout. None when nothing moved."""
    same = same or (lambda a, b: not differs(a, b))
    before, final = frames[0], frames[-1]
    first = next((i for i, frame in enumerate(frames)
                  if not off_screen(frame) and not same(frame, before)), None)
    if first is None:
        return None
    last = len(frames) - 1
    while last > first and same(frames[last - 1], final):
        last -= 1
    return first, last


def wrong(frames, landed, last, same=None):
    """The frames from `landed` until the final layout that aren't it."""
    same = same or (lambda a, b: not differs(a, b))
    return sum(1 for frame in frames[landed:last] if not same(frame, frames[-1]))


def reading(film, start, seconds, scale):
    """ffmpeg reading a film from `start` as its screen looked. The simulator writes a frame only
    when the screen changes, so a seek ahead of decoding lands on the next change instead of what
    was showing: ffmpeg decodes up to `start`, and the fps filter repeats the frame on screen."""
    return ['ffmpeg', '-nostdin', '-loglevel', 'error', '-i', str(film), '-ss',
            f'{max(0, start):.3f}', '-t', f'{seconds:.3f}', '-vf', f'fps={FPS},scale={scale}']


def gray(film, start, seconds):
    raw = subprocess.run(
        [*reading(film, start, seconds, f'{SIDE}:{SIDE},format=gray'), '-f', 'rawvideo', '-'],
        check=True, capture_output=True).stdout
    size = SIDE * SIDE
    return [raw[i:i + size] for i in range(0, len(raw) - size + 1, size)]


def sheet(film, start, seconds, first, landed, last, out):
    """Cut the way `gray` cuts, so a frame's number is the same in both."""
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob('*.png'):
        old.unlink()
    subprocess.run(
        [*reading(film, start, seconds, '-2:360'), '-start_number', '0', str(out / '%03d.png')],
        check=True)
    for shot in sorted(out.glob('*.png')):
        n = int(shot.stem)
        if first - 2 <= n <= last + 2:
            shot.rename(out / f'{n:03d}_{ms(n - landed):+d}ms.png')
        else:
            shot.unlink()
    subprocess.run(
        ['magick', 'montage', '-label', '%t', '-pointsize', '18', '-fill', 'white', '-background',
         '#222', '-tile', '8x', '-geometry', '+3+3', *sorted(map(str, out.glob('*.png'))),
         f'{out}.png'], check=False)


def ms(frames):
    return round(frames * 1000 / FPS)


def ended(film):
    """The ms a film runs."""
    return round(1000 * float(subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(film)],
        check=True, capture_output=True, text=True).stdout))


def marks_of(moves):
    return [line.split() for line in moves.read_text().splitlines() if line.strip()]


def cut(folder, state, n, after):
    """Move n's frames in the film of the screen it lands on, and how they were cut."""
    screen = screen_of(after)
    film = folder / f'{state}-{screen}.mov'
    began = folder / f'{state}-{screen}.start'
    filmed = folder / f'{state}-{screen}-moves.txt'
    if not (film.exists() and began.exists() and filmed.exists()):
        return None
    marks = marks_of(filmed)
    at = int(marks[n][0])
    zero = int(began.read_text())
    start = (at - zero) / 1000 - BEFORE
    until = int(marks[n + 1][0]) if n + 1 < len(marks) else zero + ended(film)
    held = (until - at) / 1000 + BEFORE - AFTER
    seconds = min(held, WINDOW + BEFORE)
    frames = gray(film, start, held)
    last = frames[-1] if frames and held > seconds + 0.5 else None
    return film, start, seconds, frames[:round(seconds * FPS)], last


def main(folder):
    folder = Path(folder)
    states = sorted(moves.name[:-len('-3-moves.txt')] for moves in folder.glob('*-3-moves.txt'))
    moves = marks_of(folder / f'{states[0]}-3-moves.txt') if states else []
    ios = {}
    if 'probe' in states:
        for n, (_, _, after) in enumerate(moves):
            taken = cut(folder, 'probe', n, after)
            moved = taken and settle(taken[3], lambda a, b: not differs(a, b, PROBE_SHARE))
            ios[n] = moved[1] - moved[0] if moved else 0
    rows = ['| state | move | iOS’s own (ms) | app final after it lands (ms) | '
            'wrong frames after it lands |', '|---|---|---|---|---|']
    for state in (one for one in states if one != 'probe'):
        for n, (_, before, after) in enumerate(moves):
            move = f'{before} → {after}'
            own = f'{ms(ios[n])}' if n in ios else '?'
            taken = cut(folder, state, n, after)
            if taken is None:
                rows.append(f'| {state} | {move} | {own} | no film | |')
                continue
            film, start, seconds, frames, held = taken
            if held is not None and frames and differs(frames[-1], held):
                rows.append(f'| {state} | {move} | {own} | not settled in {WINDOW:g} s | |')
                continue
            moved = settle(frames)
            if moved is None:
                rows.append(f'| {state} | {move} | {own} | nothing moved | 0 |')
                continue
            first, last = moved
            landed = min(last, first + ios.get(n, 0))
            rows.append(f'| {state} | {move} | {own} | {ms(last - landed)} | '
                        f'{wrong(frames, landed, last)} |')
            sheet(film, start, seconds, first, landed, last,
                  folder / 'frames' / f'{state}-{n + 1}-{before}-{after}')
    table = '\n'.join(rows) + '\n'
    (folder / 'table.md').write_text(table)
    print(table)


if __name__ == '__main__':
    main(sys.argv[1])
