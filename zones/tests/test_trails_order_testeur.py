"""Extra tests by the tester, written from ADR 0020 section 2 only."""

import pytest

from tests.test_trails_order import expected_m, make, pt


def line(names, points):
    return [pt(points[n]) for n in names]


def test_loop_with_a_short_variant_stays_a_loop():
    # long thin loop; a variant of ~283 m bypasses the short side B-B2 (200 m)
    p = {"A": (0, 0), "B": (10000, 0), "B2": (10000, 200), "C": (0, 200), "X": (10100, 100)}
    ways = {1: "AB", 2: ["B", "B2"], 3: "B2 C".split(), 4: "CA", 5: ["B", "X", "B2"]}
    t = make(p, ways, members="w1@,w2@,w3@,w4@,w5@")["order"]
    assert t["refusal"] is None
    assert t["loop"] is True and t["ordered"][0] == t["ordered"][-1]
    assert t["ordered"] == line(["A", "B", "B2", "C", "A"], p)
    assert 250 < t["removed_m"] < 320


def test_variant_listed_first_in_relation_is_the_one_kept():
    p = {"A": (0, 0), "B": (10000, 0), "B2": (10000, 200), "C": (0, 200), "X": (10100, 100)}
    ways = {1: "AB", 2: ["B", "B2"], 3: ["B2", "C"], 4: "CA", 5: ["B", "X", "B2"]}
    t = make(p, ways, members="w1@,w5@,w2@,w3@,w4@")["order"]
    assert t["refusal"] is None and t["loop"] is True
    assert t["ordered"] == line(["A", "B", "X", "B2", "C", "A"], p)


def test_square_with_two_small_dead_ends_is_a_loop_and_counts_removals():
    p = {"A": (0, 0), "B": (2000, 0), "C": (2000, 2000), "D": (0, 2000), "E": (-100, 0), "F": (2000, 2200)}
    ways = {1: "AB", 2: "BC", 3: "CD", 4: "DA", 5: "AE", 6: "CF"}
    t = make(p, ways, members="w1@,w2@,w3@,w4@,w5@,w6@")["order"]
    assert t["refusal"] is None and t["loop"] is True
    assert t["ordered"] == line("ABCDA", p)
    assert t["removed_m"] == pytest.approx(300, abs=2)
    assert t["ordered_m"] == pytest.approx(expected_m(8000), abs=3)


def test_single_way_whose_first_node_has_the_biggest_id_keeps_osm_direction():
    p = {"D": (3000, 0), "C": (2000, 0), "B": (1000, 0), "A": (0, 0)}  # ids: D=1 ... A=4
    t = make(p, {1: ["A", "B", "C", "D"]})["order"]
    assert t["refusal"] is None and t["loop"] is False
    assert t["ordered"] == line("ABCD", p)


@pytest.mark.parametrize(
    "ways",
    [
        {1: "BA", 2: "BC", 3: "CD"},  # first way reversed
        {1: "AB", 2: "BC", 3: "DC"},  # last way reversed
        {1: "BA", 2: "CB", 3: "DC"},  # all reversed
        {1: "AB", 2: "CB", 3: "CD"},  # middle reversed
    ],
)
def test_one_way_path_with_reversed_ways_goes_from_first_way_to_last(ways):
    p = {"A": (0, 0), "B": (1000, 0), "C": (2000, 0), "D": (3000, 0)}
    t = make(p, ways)["order"]
    assert t["refusal"] is None and t["loop"] is False
    assert t["ordered"] == line("ABCD", p)
    assert t["removed_m"] == 0


def test_nested_subrelation_followed_in_order():
    p = {"A": (0, 0), "B": (1000, 0), "C": (2000, 0), "D": (3000, 0)}
    extra = "r101 v1 Mw2@,r102@ Troute=mtb\nr102 v1 Mw3@ Troute=mtb\n"
    t = make(p, {1: "AB", 2: "BC", 3: "CD"}, members="w1@,r101@", extra=extra)["order"]
    assert t["ordered"] == line("ABCD", p)


def test_role_on_a_subrelation_drops_nested_ways_too():
    p = {"A": (0, 0), "B": (1000, 0), "C": (2000, 0), "D": (2000, 100), "E": (2000, 200)}
    extra = "r101 v1 Mw3@,r102@ Troute=mtb\nr102 v1 Mw4@ Troute=mtb\n"
    ways = {1: "AB", 2: "BC", 3: ["C", "D"], 4: ["D", "E"]}
    t = make(p, ways, members="w1@,w2@,r101@alternative", extra=extra)["order"]
    assert t["refusal"] is None
    assert t["ordered"] == line("ABC", p)
    assert t["removed_m"] == pytest.approx(200, abs=3)


@pytest.mark.parametrize("role", ["alternative", "excursion", "approach", "connection"])
def test_dropped_roles_are_removed_and_counted(role):
    p = {"A": (0, 0), "B": (1000, 0), "C": (2000, 0), "D": (2000, 100)}
    t = make(p, {1: "AB", 2: "BC", 3: "CD"}, members=f"w1@,w2@,w3@{role}")["order"]
    assert t["refusal"] is None
    assert t["ordered"] == line("ABC", p)
    assert t["removed_m"] == pytest.approx(100, abs=2)


@pytest.mark.parametrize("role", ["", "main", "forward", "backward"])
def test_kept_roles_stay_in_the_line(role):
    p = {"A": (0, 0), "B": (1000, 0), "C": (2000, 0), "D": (3000, 0)}
    t = make(p, {1: "AB", 2: "BC", 3: "CD"}, members=f"w1@,w2@,w3@{role}")["order"]
    assert t["refusal"] is None
    assert t["ordered"] == line("ABCD", p)
    assert t["removed_m"] == 0


def _two_spurs(main_len):
    p = {"A": (0, 0), "J1": (1000, 0), "J2": (main_len - 1700, 0), "D": (main_len, 0), "E1": (1000, 499), "E2": (main_len - 1700, -499)}
    ways = {1: ["A", "J1"], 2: ["J1", "J2"], 3: ["J2", "D"], 4: ["J1", "E1"], 5: ["J2", "E2"]}
    return make(p, ways)["order"]


def test_threshold_just_under_15_percent_is_accepted():
    t = _two_spurs(5700)  # removed ~998 of ~6698 = 14.9 %
    assert t["refusal"] is None
    assert t["removed_m"] == pytest.approx(998, abs=4)


def test_threshold_just_over_15_percent_is_refused():
    t = _two_spurs(5600)  # ~998 of ~6598 = 15.1 %
    assert t["refusal"] == "removedTooMuch"
    assert t["ordered"] is None and t["loop"] is None and t["ordered_m"] is None and t["removed_m"] is None
