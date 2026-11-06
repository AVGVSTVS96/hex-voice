#!/usr/bin/env python3
"""Counts the frames each Duo move takes to settle, from the films `scripts/duo fold` makes.

    scripts/fold_frames.py <dir>

<dir> holds, per state, a film of each screen (<state>-1.mov the cover, <state>-3.mov the open
screen), the ms each film started (<state>-<screen>.start) and its moves (<state>-moves.txt:
"<ms> <from> <to>"). Each move is cut from the film of the screen it lands on at 60 frames a
second, as iOS draws, from a little before it until the next. From the first frame that differs
from the one before the move to the frame after which none differs from the last, it counts the
frames on screen and those of them that aren't the last: a layout drawn for the old window, or
in pieces, before the final one. It writes table.md, and per move a sheet of those frames.
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
BEFORE = 0.25


def screen_of(pose):
    return 1 if pose.startswith('cover') else 3


def differs(a, b):
    changed = sum(1 for x, y in zip(a, b) if abs(x - y) > LEVELS)
    return changed > SHARE * len(a)


def settle(frames, same=None):
    """(first, last, off): the first frame that moved, the first of the final layout, and the
    frames between them that weren't it. None when nothing moved."""
    same = same or (lambda a, b: not differs(a, b))
    before, final = frames[0], frames[-1]
    first = next((i for i, frame in enumerate(frames) if not same(frame, before)), None)
    if first is None:
        return None
    last = len(frames) - 1
    while last > first and same(frames[last - 1], final):
        last -= 1
    off = sum(1 for frame in frames[first:last] if not same(frame, final))
    return first, last, off


def gray(film, start, seconds):
    raw = subprocess.run(
        ['ffmpeg', '-nostdin', '-loglevel', 'error', '-ss', f'{max(0, start):.3f}', '-t',
         f'{seconds:.3f}', '-i', str(film), '-vf', f'fps={FPS},scale={SIDE}:{SIDE},format=gray',
         '-f', 'rawvideo', '-'],
        check=True, capture_output=True).stdout
    size = SIDE * SIDE
    return [raw[i:i + size] for i in range(0, len(raw) - size + 1, size)]


def sheet(film, start, first, last, out):
    out.mkdir(parents=True, exist_ok=True)
    lo, hi = max(0, first - 2), last + 2
    subprocess.run(
        ['ffmpeg', '-nostdin', '-loglevel', 'error', '-ss', f'{max(0, start + lo / FPS):.3f}',
         '-t', f'{(hi - lo + 1) / FPS:.3f}', '-i', str(film), '-vf',
         f'fps={FPS},scale=-2:360', '-start_number', str(lo), str(out / '%03d.png')],
        check=True)
    shots = sorted(out.glob('*.png'))
    for shot in shots:
        ms = round((int(shot.stem) - first) * 1000 / FPS)
        shot.rename(out / f'{int(shot.stem):03d}_{ms:+d}ms.png')
    subprocess.run(
        ['magick', 'montage', '-label', '%t', '-pointsize', '18', '-fill', 'white', '-background',
         '#222', '-tile', '8x', '-geometry', '+3+3', *sorted(map(str, out.glob('*.png'))),
         f'{out}.png'], check=False)


def main(folder):
    folder = Path(folder)
    rows = ['| state | move | frames to final | ms | not final |', '|---|---|---|---|---|']
    for moves in sorted(folder.glob('*-moves.txt')):
        state = moves.name[:-len('-moves.txt')]
        marks = [line.split() for line in moves.read_text().splitlines() if line.strip()]
        for n, (at, before, after) in enumerate(marks):
            screen = screen_of(after)
            film = folder / f'{state}-{screen}.mov'
            began = folder / f'{state}-{screen}.start'
            move = f'{before} → {after}'
            if not film.exists() or not began.exists():
                rows.append(f'| {state} | {move} | no film of screen {screen} | | |')
                continue
            start = (int(at) - int(began.read_text())) / 1000 - BEFORE
            until = int(marks[n + 1][0]) if n + 1 < len(marks) else int(at) + 4000
            frames = gray(film, start, (until - int(at)) / 1000 + BEFORE - 0.1)
            moved = settle(frames)
            if moved is None:
                rows.append(f'| {state} | {move} | 0 (nothing moved) | 0 | 0 |')
                continue
            first, last, off = moved
            rows.append(f'| {state} | {move} | {last - first + 1} | '
                        f'{round((last - first) * 1000 / FPS)} | {off} |')
            sheet(film, start, first, last, folder / 'frames' / f'{state}-{n + 1}-{before}-{after}')
    table = '\n'.join(rows) + '\n'
    (folder / 'table.md').write_text(table)
    print(table)


if __name__ == '__main__':
    main(sys.argv[1])
