"""Ordered line of the marked trails (ADR 0020, section 2). Cases are numbered as in the ADR."""

import json
import math
from pathlib import Path

import pytest

from zonefactory.trails import (
    MAX_ANNEX_M,
    MAX_REMOVED_SHARE,
    analyse,
    build_geojson,
    parse_opl,
)

EARTH_M = 6371008.8  # sphere of dist_m (length_m)
VALHALLA_RATIO = 6378160.0 / EARTH_M  # ordered_m is on the sphere of Valhalla
LON0, LAT0 = 6.0, 48.5
M_PER_DEG = math.radians(1) * EARTH_M
BBOX = {"lonMin": 5.0, "latMin": 48.0, "lonMax": 7.0, "latMax": 49.0}


def _lonlat(x, y):
    lon = LON0 + x / (M_PER_DEG * math.cos(math.radians(LAT0)))
    return f"{lon:.9f}", f"{LAT0 + y / M_PER_DEG:.9f}"


def pt(point):
    """[lon, lat] expected in `ordered` for a point (x, y) in metres."""
    lon, lat = _lonlat(*point)
    return [round(float(lon), 6), round(float(lat), 6)]


def make(points, ways, members=None, extra=""):
    """Analyse a fake relation 100. `points`: name -> (x, y) metres; `ways`: id -> names; `members`: OPL text."""
    ids = {name: i + 1 for i, name in enumerate(points)}
    opl = "".join(f"n{ids[n]} v1 x{_lonlat(*xy)[0]} y{_lonlat(*xy)[1]}\n" for n, xy in points.items())
    opl += "".join(f"w{w} v1 N{','.join('n' + str(ids[n]) for n in names)}\n" for w, names in ways.items())
    if members is None:
        members = ",".join(f"w{w}@" for w in ways)
    opl += f"r100 v1 M{members} Troute=mtb,name=Test\n{extra}"
    return next(t for t in analyse(*parse_opl(opl)) if t["id"] == 100)


def expected_m(metres):
    return metres * VALHALLA_RATIO


def points_of(names, points):
    return [pt(points[n]) for n in names]


# A straight path A-B-C-D, 1 km per way.
PATH = {"A": (0, 0), "B": (1000, 0), "C": (2000, 0), "D": (3000, 0)}


def test_1_simple_path():
    t = make(PATH, {1: "AB", 2: "BC", 3: "CD"})["order"]
    assert t["refusal"] is None and t["loop"] is False
    assert t["ordered"] == points_of("ABCD", PATH)
    assert t["ordered_m"] == pytest.approx(expected_m(3000), abs=2)
    assert t["removed_m"] == 0


def test_2_reversed_way_keeps_one_continuous_line():
    t = make(PATH, {1: "AB", 2: "CB", 3: "CD"})["order"]
    assert t["ordered"] == points_of("ABCD", PATH)


def test_3_members_out_of_order_follow_the_relation():
    # relation lists way 3 (C-D) first, then way 1 (A-B): the line goes from D to A
    t = make(PATH, {1: "AB", 2: "BC", 3: "CD"}, members="w3@,w1@,w2@")["order"]
    assert t["refusal"] is None
    assert t["ordered"] == points_of("DCBA", PATH)


SQUARE = {"A": (0, 0), "B": (1000, 0), "C": (1000, 1000), "D": (0, 1000)}


def test_4_simple_loop_starts_on_first_way_towards_second():
    t = make(SQUARE, {1: "AB", 2: "BC", 3: "CD", 4: "DA"})["order"]
    assert t["loop"] is True
    assert t["ordered"] == points_of("ABCDA", SQUARE)
    assert t["ordered"][0] == t["ordered"][-1]
    assert t["ordered_m"] == pytest.approx(expected_m(4000), abs=3)


def test_4_loop_with_first_way_against_the_second():
    # way 1 is written D-A and the second way A-B touches its end A: the loop starts at D
    t = make(SQUARE, {1: "DA", 2: "AB", 3: "BC", 4: "CD"})["order"]
    assert t["ordered"] == points_of("DABCD", SQUARE)
    # way 1 written A-D while way 2 is B-C: the second way touches the start A, so the loop is turned
    t = make(SQUARE, {1: "AD", 2: "BC", 3: "AB", 4: "CD"}, members="w1@,w3@,w2@,w4@")["order"]
    assert t["loop"] is True
    assert t["ordered"][0] == pt(SQUARE["D"])
    assert t["ordered"][1] == pt(SQUARE["A"])


def test_5_sub_relation_followed_in_order_without_endless_loop():
    extra = "r101 v1 Mw2@,w3@,r101@,r100@ Troute=mtb\n"
    t = make(PATH, {1: "AB", 2: "BC", 3: "CD"}, members="w1@,r101@", extra=extra)["order"]
    assert t["refusal"] is None
    assert t["ordered"] == points_of("ABCD", PATH)


def test_6_t_junction_cuts_the_way():
    points = {"A": (0, 0), "B": (1000, 0), "C": (2000, 0), "E": (1000, 300)}
    # way 1 goes through B, way 2 starts at B: a T. The 300 m stub is an annex.
    t = make(points, {1: "ABC", 2: "BE"})["order"]
    assert t["refusal"] is None
    assert t["ordered"] == points_of("ABC", points)
    assert t["removed_m"] == pytest.approx(300, abs=2)


STUB_BASE = {"A": (0, 0), "J": (5000, 0), "B": (10000, 0)}


@pytest.mark.parametrize("stub_m, refusal", [(MAX_ANNEX_M - 1, None), (MAX_ANNEX_M + 1, "branches")])
def test_7_dead_end_below_and_above_the_limit(stub_m, refusal):
    points = {**STUB_BASE, "S": (5000, stub_m)}
    t = make(points, {1: "AJ", 2: "JB", 3: "JS"})["order"]
    assert t["refusal"] == refusal
    if refusal is None:
        assert t["removed_m"] == pytest.approx(stub_m, abs=2)
        assert t["ordered"] == points_of("AJB", points)
    else:
        assert t["ordered"] is None and t["removed_m"] is None and t["loop"] is None


def test_8_small_loop_on_a_junction():
    points = {**STUB_BASE, "L1": (5000, 36), "L2": (5036, 36), "L3": (5036, 0)}
    t = make(points, {1: "AJ", 2: "JB", 3: ["J", "L1", "L2", "L3", "J"]})["order"]
    assert t["refusal"] is None
    assert t["removed_m"] == pytest.approx(144, abs=2)
    assert t["ordered"] == points_of("AJB", points)


VARIANT = {"A": (0, 0), "J1": (4000, 0), "J2": (5000, 0), "B": (9000, 0), "M": (4500, 400)}


def test_9_variant_keeps_the_first_of_the_relation():
    # the long variant (via M) is listed first: kept, even though the direct one is shorter
    t = make(VARIANT, {1: ["A", "J1"], 2: ["J1", "M", "J2"], 3: ["J1", "J2"], 4: ["J2", "B"]})["order"]
    assert t["refusal"] is None
    assert pt(VARIANT["M"]) in t["ordered"]
    assert t["removed_m"] == pytest.approx(1000, abs=2)
    # listed the other way round: the direct one is kept
    t = make(VARIANT, {1: ["A", "J1"], 2: ["J1", "J2"], 3: ["J1", "M", "J2"], 4: ["J2", "B"]})["order"]
    assert pt(VARIANT["M"]) not in t["ordered"]
    assert t["removed_m"] == pytest.approx(math.hypot(500, 400) * 2, abs=2)


ALT = {"A": (0, 0), "J": (5000, 0), "B": (10000, 0), "X": (5000, 1200)}


def test_10_alternative_role_removes_a_long_branch_before_the_topology():
    ways = {1: "AJ", 2: "JB", 3: "JX"}
    assert make(ALT, ways)["order"]["refusal"] == "branches"  # without the role, a 1.2 km branch
    t = make(ALT, ways, members="w1@,w2@,w3@alternative")["order"]
    assert t["refusal"] is None
    assert t["ordered"] == points_of("AJB", ALT)
    assert t["removed_m"] == pytest.approx(1200, abs=2)
    # same through a sub-relation that carries the role
    t = make(ALT, ways, members="w1@,w2@,r101@excursion", extra="r101 v1 Mw3@ Troute=mtb\n")["order"]
    assert t["refusal"] is None
    assert t["removed_m"] == pytest.approx(1200, abs=2)


@pytest.mark.parametrize("role", ["approach", "connection"])
def test_10_other_dropped_roles(role):
    t = make(ALT, {1: "AJ", 2: "JB", 3: "JX"}, members=f"w1@,w2@,w3@{role}")["order"]
    assert t["refusal"] is None and t["removed_m"] > 1000


def test_10_main_and_direction_roles_are_kept():
    t = make(PATH, {1: "AB", 2: "BC", 3: "CD"}, members="w1@main,w2@forward,w3@backward")["order"]
    assert t["ordered"] == points_of("ABCD", PATH)
    assert t["removed_m"] == 0


def test_10_role_cutting_the_trail_in_two_is_refused():
    t = make(PATH, {1: "AB", 2: "BC", 3: "CD"}, members="w1@,w2@connection,w3@")["order"]
    assert t["refusal"] == "parts"


def test_11_forward_role_walked_backwards_gives_a_report_line():
    # way 2 is written C-B (against the line A-B-C-D) and carries `forward`
    members = "w1@,w2@forward,w3@"
    trail = make(PATH, {1: "AB", 2: "CB", 3: "CD"}, members=members)
    assert trail["order"]["refusal"] is None
    assert any("ALERTE" in n and "forward" in n for n in trail["order"]["notes"])
    # the line is kept in the direction of the relation
    assert trail["order"]["ordered"] == points_of("ABCD", PATH)


def test_12_fork_in_y_with_three_long_branches():
    points = {"J": (0, 0), "P": (2000, 0), "Q": (-1000, 1700), "R": (-1000, -1700)}
    assert make(points, {1: "JP", 2: "JQ", 3: "JR"})["order"]["refusal"] == "branches"


def test_13_figure_eight():
    points = {
        "X": (0, 0), "a1": (500, 0), "a2": (500, 500), "a3": (0, 500),
        "b1": (-500, 0), "b2": (-500, -500), "b3": (0, -500),
    }  # fmt: skip
    t = make(points, {1: ["X", "a1", "a2", "a3", "X"], 2: ["X", "b1", "b2", "b3", "X"]})["order"]
    assert t["refusal"] == "branches"


def test_14_lollipop_with_a_one_kilometre_stem():
    points = {"S": (-1000, 0), "X": (0, 0), "a1": (500, 0), "a2": (500, 500), "a3": (0, 500)}
    t = make(points, {1: "SX", 2: ["X", "a1", "a2", "a3", "X"]})["order"]
    assert t["refusal"] == "branches"


def test_15_separate_parts():
    points = {"A": (0, 0), "B": (1000, 0), "C": (3000, 0), "D": (4000, 0)}
    trail = make(points, {1: "AB", 2: "CD"})
    assert trail["parts"] == 2
    assert trail["order"]["refusal"] == "parts"
    assert trail["order"]["ordered"] is None


def test_16_removed_share_limit():
    def stubs(each_m):
        points = {"A": (0, 0), "J": (2000, 0), "B": (4000, 0), "S1": (2000, each_m), "S2": (2000, -each_m)}
        return make(points, {1: "AJ", 2: "JB", 3: ["J", "S1"], 4: ["J", "S2"]})["order"]

    assert stubs(400)["refusal"] == "removedTooMuch"  # 800 m of 4 800 m: 16.7 %
    ok = stubs(300)  # 600 m of 4 600 m: 13 %
    assert ok["refusal"] is None and ok["removed_m"] == pytest.approx(600, abs=2)
    assert MAX_REMOVED_SHARE == 0.15


def test_17_way_listed_twice_is_counted_once():
    trail = make(PATH, {1: "AB", 2: "BC", 3: "CD"}, members="w1@,w2@,w1@,w3@")
    assert trail["length_m"] == pytest.approx(3000, abs=2)
    assert trail["order"]["ordered"] == points_of("ABCD", PATH)


def test_17_way_missing_from_the_extract_that_makes_a_hole():
    trail = make(PATH, {1: "AB", 3: "CD"}, members="w1@,w2@,w3@")  # way 2 is not in the extract
    assert trail["parts"] == 2
    assert trail["order"]["refusal"] == "parts"
    # a missing way at the end is harmless
    assert make(PATH, {1: "AB", 2: "BC"}, members="w1@,w2@,w3@")["order"]["refusal"] is None


def test_18_format_keys_decimals_duplicates_and_valhalla_length():
    # one meridian segment of 0.01 degree, with a second node on the same place as the first
    opl = (
        "n1 v1 x6.0 y48.0\nn2 v1 x6.0000001 y48.0\nn3 v1 x6.0 y48.01\n"
        "w1 v1 Nn1,n2\nw2 v1 Nn2,n3\nr100 v1 Mw1@,w2@ Troute=mtb,name=Test\n"
        "r200 v1 Mw1@,w2@ Troute=mtb\n"
    )
    geojson, _ = build_geojson(*parse_opl(opl), BBOX)
    for feature in geojson["features"]:
        props = feature["properties"]
        for key in ("ordered", "loop", "ordered_m", "removed_m", "refusal"):
            assert key in props
        assert props["ordered"] == [[6.0, 48.0], [6.0, 48.01]]  # 6 decimals, no consecutive duplicate
        assert props["ordered_m"] == round(6378160.0 * math.radians(0.01))  # computed by hand
        assert (props["loop"], props["removed_m"], props["refusal"]) == (False, 0, None)
    # a refused trail has the keys, all null
    refused_opl = "n1 v1 x6.0 y48.0\nn2 v1 x6.1 y48.0\nn3 v1 x6.2 y48.0\nn4 v1 x6.3 y48.0\n"
    refused_opl += "w1 v1 Nn1,n2\nw2 v1 Nn3,n4\nr100 v1 Mw1@,w2@ Troute=mtb\n"
    props = build_geojson(*parse_opl(refused_opl), BBOX)[0]["features"][0]["properties"]
    assert props["ordered"] is None and props["loop"] is None and props["ordered_m"] is None
    assert props["removed_m"] is None and props["refusal"] == "parts"


def test_18_report_names_each_removal():
    points = {**STUB_BASE, "S": (5000, 300)}
    _, report = build_geojson(*parse_opl(_opl(points, {1: "AJ", 2: "JB", 3: "JS"})), BBOX)
    assert any("impasse" in line and "1 voie" in line for line in report)


def _opl(points, ways):
    ids = {name: i + 1 for i, name in enumerate(points)}
    opl = "".join(f"n{ids[n]} v1 x{_lonlat(*xy)[0]} y{_lonlat(*xy)[1]}\n" for n, xy in points.items())
    opl += "".join(f"w{w} v1 N{','.join('n' + str(ids[n]) for n in names)}\n" for w, names in ways.items())
    return opl + "r100 v1 M" + ",".join(f"w{w}@" for w in ways) + " Troute=mtb\n"


def test_parse_opl_keeps_the_role_of_members():
    opl = "r1 v1 Mw5@alternative,r6@,n7@stop,w8@a%20%b Troute=mtb\n"
    _, _, rels = parse_opl(opl)
    assert rels[1][1] == [("w", 5, "alternative"), ("r", 6, ""), ("n", 7, "stop"), ("w", 8, "a b")]


def test_19_nancy_v5_non_regression():
    """Raw ways of the two Nancy circuits (trails.geojson v5): two loops, lengths of the T1 trial on the Valhalla sphere."""
    data = json.loads((Path(__file__).parent / "data" / "trails_nancy_v5.geojson").read_text(encoding="utf-8"))
    nodes, ways, rels, ids = {}, {}, {}, {}
    for feature in data["features"]:
        members = []
        for line in feature["geometry"]["coordinates"]:
            way_id = len(ways) + 1
            ways[way_id] = [ids.setdefault(tuple(c), len(ids) + 1) for c in line]
            members.append(("w", way_id, ""))
        rels[feature["properties"]["osm_id"]] = ({"route": "mtb"}, members)
    nodes = {n: c for c, n in ids.items()}
    result = {t["id"]: t for t in analyse(nodes, ways, rels)}
    # the T1 trial measured 21 302.3 m and 34 865.0 m on a sphere of 6 371 008.8 m
    for rid, trial_m, share in ((11656724, 21302.3, 5.1), (15712020, 34865.0, 0.5)):
        order = result[rid]["order"]
        assert order["refusal"] is None and order["loop"] is True
        assert order["ordered"][0] == order["ordered"][-1]
        assert order["ordered_m"] == pytest.approx(trial_m * VALHALLA_RATIO, abs=1)
        assert 100 * order["removed_m"] / result[rid]["length_m"] == pytest.approx(share, abs=0.1)
    assert result[11656724]["order"]["ordered"][0] == [5.978104, 48.727358]
    assert result[15712020]["order"]["ordered"][0] == [6.042441, 48.903013]


def test_loop_with_two_annexes_is_not_cut_as_a_variant():
    # square of four 1 km ways, with a 100 m dead end at A and at C
    points = {**SQUARE, "SA": (-100, 0), "SC": (1100, 1000)}
    ways = {1: "AB", 2: "BC", 3: "CD", 4: "DA", 5: ["A", "SA"], 6: ["C", "SC"]}
    t = make(points, ways)["order"]
    assert t["refusal"] is None and t["loop"] is True
    assert t["removed_m"] == pytest.approx(200, abs=2)
    assert t["ordered"] == points_of("ABCDA", points)


def _loop_with_variant(variant_m):
    # loop J1 -> Y -> J2 (long) closed by J2 -> J1, with a variant J1 -> V -> J2 listed last
    points = {"J1": (0, 0), "J2": (400, 0), "Y": (200, -3000), "V": (200, variant_m)}
    return make(points, {1: ["J1", "Y", "J2"], 2: ["J2", "J1"], 3: ["J1", "V", "J2"]}), points


def test_loop_with_a_small_variant_stays_a_loop():
    trail, points = _loop_with_variant(100)
    t = trail["order"]
    assert t["refusal"] is None and t["loop"] is True
    assert t["ordered"][0] == t["ordered"][-1]
    assert pt(points["V"]) not in t["ordered"] and pt(points["Y"]) in t["ordered"]
    assert 0 < t["removed_m"] < MAX_REMOVED_SHARE * trail["length_m"]


def test_loop_with_a_big_variant_is_refused_for_the_removed_share():
    t = _loop_with_variant(2500)[0]["order"]
    assert t["refusal"] == "removedTooMuch"


def test_single_way_path_keeps_its_osm_direction_whatever_the_node_numbers():
    # the first node of the way is the one with the highest id
    opl = "n1 v1 x6.02 y48.5\nn2 v1 x6.01 y48.5\nn3 v1 x6.00 y48.5\nw1 v1 Nn3,n2,n1\nr100 v1 Mw1@ Troute=mtb\n"
    t = next(x for x in analyse(*parse_opl(opl)) if x["id"] == 100)["order"]
    assert t["ordered"][0] == [6.0, 48.5] and t["ordered"][-1] == [6.02, 48.5]
    opl = opl.replace("Nn3,n2,n1", "Nn1,n2,n3")  # and the other way round
    t = next(x for x in analyse(*parse_opl(opl)) if x["id"] == 100)["order"]
    assert t["ordered"][0] == [6.02, 48.5]
