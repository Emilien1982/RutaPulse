import math

import pytest

from zonefactory.trails import build_geojson, parse_opl

# Points (lon, lat): 1-2-3 and 4-5 are two parts of trail 100 (gap between 3 and 4);
# 6-7 is trail 200 (one part); 8-9 is far outside the zone.
N = {
    1: (5.990, 48.500), 2: (5.995, 48.500), 3: (6.000, 48.500), 4: (6.010, 48.500), 5: (6.020, 48.501),
    6: (6.000, 48.600), 7: (6.001, 48.600), 8: (9.000, 45.000), 9: (9.001, 45.000),
}  # fmt: skip
BBOX = {"lonMin": 5.9, "latMin": 48.4, "lonMax": 6.1, "latMax": 48.7}

OPL = (
    "".join(f"n{i} v1 x{lon} y{lat}\n" for i, (lon, lat) in N.items())
    + "w10 v1 Nn1,n2\nw11 v1 Nn2,n3\nw12 v1 Nn4,n5\nw13 v1 Nn6,n7\nw14 v1 Nn8,n9\n"
    # 100: ways 10, 11 and sub-relation 101 (way 12); name uses the %hex% escapes of OPL
    + "r100 v1 Mw10@,w11@,r101@ Troute=mtb,name=Test%20%&%20%circuit,ref=T1,colour=red\n"
    + "r101 v1 Mw12@ Troute=mtb\n"
    + "r200 v1 Mw13@ Troute=mtb,name=Continu\n"
    + "r300 v1 Mw14@ Troute=mtb,name=Dehors\n"  # outside the bbox
    + "r400 v1 Mw13@ Troute=hiking\n"  # not mtb
)


def haversine(a, b):
    r = 6371008.8
    p1, p2 = math.radians(a[1]), math.radians(b[1])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(b[0] - a[0]) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


@pytest.fixture(scope="module")
def result():
    geojson, report = build_geojson(*parse_opl(OPL), BBOX)
    return {f["properties"]["osm_id"]: f for f in geojson["features"]}, geojson, report


def test_feature_collection_of_multilinestrings(result):
    _, geojson, _ = result
    assert geojson["type"] == "FeatureCollection"
    assert all(f["geometry"]["type"] == "MultiLineString" for f in geojson["features"])


def test_only_mtb_relations_in_the_zone(result):
    features, _, _ = result
    assert sorted(features) == [100, 101, 200]


def test_parts_and_gap(result):
    props = result[0][100]["properties"]
    assert props["parts"] == 2
    expected = haversine(N[3], N[4])
    assert props["max_gap_m"] == pytest.approx(expected, abs=expected * 0.01 + 1)


def test_continuous_trail(result):
    props = result[0][200]["properties"]
    assert (props["parts"], props["max_gap_m"]) == (1, 0)


def test_properties_length_and_sub_relation(result):
    feature = result[0][100]
    props = feature["properties"]
    assert (props["name"], props["ref"], props["colour"]) == ("Test & circuit", "T1", "red")
    expected = haversine(N[1], N[2]) + haversine(N[2], N[3]) + haversine(N[4], N[5])
    assert props["length_m"] == pytest.approx(expected, rel=0.01)
    assert len(feature["geometry"]["coordinates"]) == 3  # the way of the sub-relation is followed


def test_report_counts_trails(result):
    _, _, report = result
    assert report[0].startswith("3 circuits balisés dans la zone (2 continus, 1 avec coupures)")
