import copy
import json

import pytest

from zonefactory.config import ZONES_FILE, ConfigError, get_zone, load_zones

VALID = {
    "zones": [
        {
            "id": "nancy",
            "name": "Nancy",
            "bbox": {"lonMin": 5.84, "latMin": 48.47, "lonMax": 6.52, "latMax": 48.92},
            "osmExtractUrl": "https://download.geofabrik.de/europe/france/lorraine-latest.osm.pbf",
        }
    ]
}


def write(tmp_path, data):
    path = tmp_path / "zones.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def changed(**zone_changes):
    data = copy.deepcopy(VALID)
    data["zones"][0].update(zone_changes)
    return data


def test_valid_file_is_read(tmp_path):
    zones = load_zones(write(tmp_path, VALID))
    assert [z["id"] for z in zones] == ["nancy"]


def test_real_zones_file_is_valid():
    assert "nancy" in [z["id"] for z in load_zones(ZONES_FILE)]


def test_missing_field_is_refused(tmp_path):
    data = copy.deepcopy(VALID)
    del data["zones"][0]["name"]
    with pytest.raises(ConfigError, match="name"):
        load_zones(write(tmp_path, data))


def test_unknown_field_is_refused(tmp_path):
    with pytest.raises(ConfigError, match="oops"):
        load_zones(write(tmp_path, changed(oops=1)))


@pytest.mark.parametrize("bad_id", ["Nancy", "a", "nancy-", "-nancy", "na ncy", "n" * 41, "nancy--est"])
def test_invalid_id_is_refused(tmp_path, bad_id):
    with pytest.raises(ConfigError):
        load_zones(write(tmp_path, changed(id=bad_id)))


def test_duplicate_id_is_refused(tmp_path):
    data = copy.deepcopy(VALID)
    data["zones"].append(copy.deepcopy(data["zones"][0]))
    with pytest.raises(ConfigError, match="double"):
        load_zones(write(tmp_path, data))


def test_lon_min_not_below_lon_max_is_refused(tmp_path):
    box = {"lonMin": 6.52, "latMin": 48.47, "lonMax": 5.84, "latMax": 48.92}
    with pytest.raises(ConfigError, match="lonMin < lonMax"):
        load_zones(write(tmp_path, changed(bbox=box)))


def test_lat_min_equal_lat_max_is_refused(tmp_path):
    box = {"lonMin": 5.84, "latMin": 48.47, "lonMax": 6.52, "latMax": 48.47}
    with pytest.raises(ConfigError, match="latMin < latMax"):
        load_zones(write(tmp_path, changed(bbox=box)))


def test_side_over_one_degree_is_refused(tmp_path):
    box = {"lonMin": 5.0, "latMin": 48.47, "lonMax": 6.5, "latMax": 48.92}
    with pytest.raises(ConfigError, match="dépasse"):
        load_zones(write(tmp_path, changed(bbox=box)))


def test_side_of_exactly_one_degree_is_accepted(tmp_path):
    box = {"lonMin": 5.0, "latMin": 48.0, "lonMax": 6.0, "latMax": 49.0}
    assert load_zones(write(tmp_path, changed(bbox=box)))


@pytest.mark.parametrize(
    "url", ["https://example.org/lorraine.osm", "http://example.org/lorraine.osm.pbf", "https://example.org/.osm.pbf.zip"]
)
def test_bad_extract_address_is_refused(tmp_path, url):
    with pytest.raises(ConfigError):
        load_zones(write(tmp_path, changed(osmExtractUrl=url)))


def test_longitude_out_of_range_is_refused(tmp_path):
    box = {"lonMin": 179.5, "latMin": 0, "lonMax": 180.5, "latMax": 0.5}
    with pytest.raises(ConfigError):
        load_zones(write(tmp_path, changed(bbox=box)))


def test_empty_zone_list_is_refused(tmp_path):
    with pytest.raises(ConfigError):
        load_zones(write(tmp_path, {"zones": []}))


def test_broken_json_is_refused(tmp_path):
    path = tmp_path / "zones.json"
    path.write_text("{", encoding="utf-8")
    with pytest.raises(ConfigError, match="illisible"):
        load_zones(path)


def test_requested_id_is_found_or_refused():
    zones = copy.deepcopy(VALID["zones"])
    assert get_zone(zones, "nancy")["name"] == "Nancy"
    with pytest.raises(ConfigError, match="absente"):
        get_zone(zones, "metz")
