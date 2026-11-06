"""How a move's frames are counted: from the first that changed to the first of the final layout,
and of those, the ones after iOS's own part that aren't the final layout."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fold_frames import differs, settle as settled, wrong as counted


def same(a, b):
    return a == b


def settle(frames):
    return settled(frames, same, lambda frame: frame == 'off')


def wrong(frames, landed, last):
    return counted(frames, landed, last, same)


class Settle(unittest.TestCase):
    def test_a_layout_that_lands_at_once_takes_one_frame(self):
        self.assertEqual(settle(['old', 'old', 'new', 'new', 'new']), (2, 2))

    def test_the_screen_the_duo_lights_counts_from_its_first_drawn_frame(self):
        self.assertEqual(settle(['off', 'off', 'off', 'new', 'new']), (3, 3))

    def test_a_layout_that_flickers_back_settles_only_after_its_last_change(self):
        self.assertEqual(settle(['old', 'new', 'old', 'new', 'new']), (1, 3))

    def test_nothing_moved(self):
        self.assertIsNone(settle(['old', 'old', 'old']))

    def test_a_few_changed_pixels_are_the_same_frame(self):
        frame = bytes(1000)
        self.assertFalse(differs(frame, bytes([255] * 4) + bytes(996)))
        self.assertTrue(differs(frame, bytes([255] * 6) + bytes(994)))


class Wrong(unittest.TestCase):
    def test_only_frames_after_ios_landed_count(self):
        frames = ['old', 'tilt1', 'tilt2', 'stale', 'stale', 'new', 'new']
        first, last = settle(frames)
        self.assertEqual(wrong(frames, first + 2, last), 2)

    def test_an_app_that_lands_with_ios_shows_no_wrong_frame(self):
        frames = ['old', 'tilt1', 'tilt2', 'new', 'new']
        first, last = settle(frames)
        self.assertEqual(wrong(frames, first + 2, last), 0)


if __name__ == '__main__':
    unittest.main()
