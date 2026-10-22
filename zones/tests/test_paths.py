import pytest

from zonefactory.paths import hgt_name, hgt_names_for_bbox, storage_path


@pytest.mark.parametrize(
    "name, expected",
    [
        ("N48E005.hgt", "elevation/N48/N48E005.hgt"),
        ("S01W070.hgt", "elevation/S01/S01W070.hgt"),
        ("map.pmtiles", "map.pmtiles"),
        ("valhalla_tiles.tar", "valhalla_tiles.tar"),
        ("LICENCES.md", "LICENCES.md"),
    ],
)
def test_storage_path(name, expected):
    assert storage_path(name) == expected


def test_hgt_name_signs():
    assert hgt_name(5, 48) == "N48E005.hgt"
    assert hgt_name(-70, -1) == "S01W070.hgt"


def test_hgt_tiles_of_nancy():
    bbox = {"lonMin": 5.84, "latMin": 48.47, "lonMax": 6.52, "latMax": 48.92}
    assert hgt_names_for_bbox(bbox) == ["N48E005.hgt", "N48E006.hgt"]


def test_hgt_tiles_edge_on_whole_degree_adds_nothing():
    bbox = {"lonMin": 5.5, "latMin": 48.1, "lonMax": 6.0, "latMax": 48.9}
    assert hgt_names_for_bbox(bbox) == ["N48E005.hgt"]


def test_hgt_tiles_south_west():
    bbox = {"lonMin": -70.5, "latMin": -0.5, "lonMax": -70.2, "latMax": -0.2}
    assert hgt_names_for_bbox(bbox) == ["S01W071.hgt"]
