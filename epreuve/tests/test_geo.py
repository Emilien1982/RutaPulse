import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from geo import distance_m


class TestIdentiques(unittest.TestCase):
    def test_meme_point(self):
        self.assertEqual(distance_m(45.0, 5.0, 45.0, 5.0), 0)

    def test_origine(self):
        self.assertEqual(distance_m(0, 0, 0, 0), 0)

    def test_pole(self):
        self.assertEqual(distance_m(90, 0, 90, 0), 0)

    def test_extremes_identiques(self):
        self.assertAlmostEqual(distance_m(-90, -180, -90, -180), 0, delta=1e-6)


class TestDistancesConnues(unittest.TestCase):
    def test_un_degre_latitude(self):
        self.assertAlmostEqual(distance_m(0, 0, 1, 0), 111195, delta=1)

    def test_un_degre_latitude_autre_meridien_et_hemisphere(self):
        self.assertAlmostEqual(distance_m(-31, 20, -30, 20), 111195, delta=1)

    def test_un_degre_latitude_sens_inverse(self):
        self.assertAlmostEqual(distance_m(1, 0, 0, 0), 111195, delta=1)

    def test_antipodes_equateur(self):
        self.assertAlmostEqual(distance_m(0, 0, 0, 180), 20015087, delta=1)

    def test_antipodes_poles(self):
        self.assertAlmostEqual(distance_m(90, 0, -90, 0), 20015087, delta=1)

    def test_antipodes_quelconques(self):
        self.assertAlmostEqual(distance_m(45, 10, -45, -170), 20015087, delta=1)


class TestSymetrie(unittest.TestCase):
    def test_symetrie(self):
        cas = [
            (48.8566, 2.3522, 40.7128, -74.0060),
            (0, 0, 0, 180),
            (-33.9, 151.2, 51.5, -0.12),
            (90, 0, -90, 0),
            (12.3, -180, 12.3, 180),
        ]
        for a in cas:
            with self.subTest(a=a):
                self.assertEqual(distance_m(*a), distance_m(a[2], a[3], a[0], a[1]))


class TestValidation(unittest.TestCase):
    def test_bornes_valides(self):
        for args in [(90, 180, -90, -180), (-90, -180, 90, 180), (0, 180, 0, -180)]:
            with self.subTest(args=args):
                distance_m(*args)

    def test_hors_bornes(self):
        base = [10.0, 10.0, 20.0, 20.0]
        mauvaises = [
            (0, 90.0001), (0, -90.0001), (0, 91), (0, -91), (0, 1000),
            (1, 180.0001), (1, -180.0001), (1, 181), (1, -181), (1, 360),
            (2, 90.0001), (2, -91),
            (3, 180.0001), (3, -181),
        ]
        for idx, val in mauvaises:
            args = list(base)
            args[idx] = val
            with self.subTest(idx=idx, val=val):
                with self.assertRaises(ValueError):
                    distance_m(*args)


if __name__ == "__main__":
    unittest.main()
