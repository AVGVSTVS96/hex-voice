"""How a move's frames are counted: from the first that changed to the first of the final layout."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fold_frames import differs, settle


def same(a, b):
    return a == b


class Settle(unittest.TestCase):
    def test_a_layout_that_lands_at_once_takes_one_frame(self):
        self.assertEqual(settle(['old', 'old', 'new', 'new', 'new'], same), (2, 2, 0))

    def test_frames_drawn_before_the_final_layout_are_counted(self):
        frames = ['old', 'old', 'stretched', 'stretched', 'split', 'new', 'new']
        self.assertEqual(settle(frames, same), (2, 5, 3))

    def test_a_layout_that_flickers_back_settles_only_after_its_last_change(self):
        frames = ['old', 'new', 'old', 'new', 'new']
        self.assertEqual(settle(frames, same), (1, 3, 1))

    def test_nothing_moved(self):
        self.assertIsNone(settle(['old', 'old', 'old'], same))

    def test_a_few_changed_pixels_are_the_same_frame(self):
        frame = bytes(1000)
        self.assertFalse(differs(frame, bytes([255] * 4) + bytes(996)))
        self.assertTrue(differs(frame, bytes([255] * 6) + bytes(994)))


if __name__ == '__main__':
    unittest.main()
