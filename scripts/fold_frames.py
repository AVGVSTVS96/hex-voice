#!/usr/bin/env python3
"""Counts the frames each Duo move takes to settle, from the films `scripts/duo fold` makes.

    scripts/fold_frames.py <dir>

<dir> holds, per state, a film of each screen (<state>-1.mov the cover, <state>-3.mov the open
screen) through the same moves, the ms each film started (<state>-<screen>.start) and its moves
(<state>-<screen>-moves.txt: "<ms> <from> <to>"). Each move is cut from the film of the screen it lands on at 60 frames a
second, as iOS draws, from a little before it until the next. From the first frame that differs
from the one before the move to the frame after which none differs from the last, it counts the
frames on screen, those of them that aren't the last, and of those the ones held for more than a
frame: a layout drawn for the old window, or in pieces, rather than a step of iOS's turn. It writes table.md, and per move a sheet of those frames.
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


def dark(frame):
    return max(frame) < LEVELS


def settle(frames, same=None, off_screen=dark):
    """(first, last, off, held): the first frame that moved, the first of the final layout, the
    frames between them that weren't it, and of those the ones held on screen, the same as the frame
    before or after: a layout drawn and left there rather than a step of iOS's turn or a fade. A
    screen that's dark is off, as the one the Duo leaves is. None when nothing moved."""
    same = same or (lambda a, b: not differs(a, b))
    before, final = frames[0], frames[-1]
    first = next((i for i, frame in enumerate(frames)
                  if not off_screen(frame) and not same(frame, before)), None)
    if first is None:
        return None
    last = len(frames) - 1
    while last > first and same(frames[last - 1], final):
        last -= 1
    wrong = [i for i in range(first, last) if not same(frames[i], final)]
    held = [i for i in wrong
            if same(frames[i], frames[i - 1]) or same(frames[i], frames[i + 1])]
    return first, last, len(wrong), len(held)


def gray(film, start, seconds):
    raw = subprocess.run(
        ['ffmpeg', '-nostdin', '-loglevel', 'error', '-ss', f'{max(0, start):.3f}', '-t',
         f'{seconds:.3f}', '-i', str(film), '-vf', f'fps={FPS},scale={SIDE}:{SIDE},format=gray',
         '-f', 'rawvideo', '-'],
        check=True, capture_output=True).stdout
    size = SIDE * SIDE
    return [raw[i:i + size] for i in range(0, len(raw) - size + 1, size)]


def sheet(film, start, seconds, first, last, out):
    """Cut the way `gray` cuts, so a frame's number is the same in both."""
    out.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ['ffmpeg', '-nostdin', '-loglevel', 'error', '-ss', f'{max(0, start):.3f}', '-t',
         f'{seconds:.3f}', '-i', str(film), '-vf', f'fps={FPS},scale=-2:360', '-start_number', '0',
         str(out / '%03d.png')],
        check=True)
    for shot in sorted(out.glob('*.png')):
        n = int(shot.stem)
        if first - 2 <= n <= last + 2:
            shot.rename(out / f'{n:03d}_{round((n - first) * 1000 / FPS):+d}ms.png')
        else:
            shot.unlink()
    subprocess.run(
        ['magick', 'montage', '-label', '%t', '-pointsize', '18', '-fill', 'white', '-background',
         '#222', '-tile', '8x', '-geometry', '+3+3', *sorted(map(str, out.glob('*.png'))),
         f'{out}.png'], check=False)


def marks_of(moves):
    return [line.split() for line in moves.read_text().splitlines() if line.strip()]


def main(folder):
    folder = Path(folder)
    rows = ['| state | move | frames to final | ms | not final | wrong layout held |',
            '|---|---|---|---|---|---|']
    for moves in sorted(folder.glob('*-3-moves.txt')):
        state = moves.name[:-len('-3-moves.txt')]
        for n, (_, before, after) in enumerate(marks_of(moves)):
            screen = screen_of(after)
            film = folder / f'{state}-{screen}.mov'
            began = folder / f'{state}-{screen}.start'
            filmed = folder / f'{state}-{screen}-moves.txt'
            move = f'{before} → {after}'
            if not (film.exists() and began.exists() and filmed.exists()):
                rows.append(f'| {state} | {move} | no film of screen {screen} | | | |')
                continue
            marks = marks_of(filmed)
            at = marks[n][0]
            start = (int(at) - int(began.read_text())) / 1000 - BEFORE
            until = int(marks[n + 1][0]) if n + 1 < len(marks) else int(at) + 4000
            seconds = (until - int(at)) / 1000 + BEFORE - 0.1
            frames = gray(film, start, seconds)
            moved = settle(frames)
            if moved is None:
                rows.append(f'| {state} | {move} | 0 (nothing moved) | 0 | 0 | 0 |')
                continue
            first, last, off, held = moved
            rows.append(f'| {state} | {move} | {last - first + 1} | '
                        f'{round((last - first) * 1000 / FPS)} | {off} | {held} |')
            sheet(film, start, seconds, first, last,
                  folder / 'frames' / f'{state}-{n + 1}-{before}-{after}')
    table = '\n'.join(rows) + '\n'
    (folder / 'table.md').write_text(table)
    print(table)


if __name__ == '__main__':
    main(sys.argv[1])
