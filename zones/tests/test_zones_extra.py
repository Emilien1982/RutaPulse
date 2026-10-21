"""Extra tests written from the spec (C2, C3, C8, ADR 0003 sections 1, 5, 7)."""

import copy
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from zonefactory import build
from zonefactory.checksums import SUMS_NAME, write_sums
from zonefactory.config import ConfigError, get_zone, load_zones
from zonefactory.paths import hgt_names_for_bbox

NANCY = {
    "id": "nancy",
    "name": "Nancy",
    "bbox": {"lonMin": 5.84, "latMin": 48.47, "lonMax": 6.52, "latMax": 48.92},
    "osmExtractUrl": "https://download.geofabrik.de/europe/france/lorraine-261018.osm.pbf",
}
TEST_ZONE = {
    "id": "essai-est",
    "name": "Essai Est",
    "bbox": {"lonMin": 7.1, "latMin": 48.2, "lonMax": 7.6, "latMax": 48.6},
    "osmExtractUrl": "https://download.geofabrik.de/europe/france/alsace-latest.osm.pbf",
}
TEMPLATE = Path(__file__).resolve().parent.parent / "templates" / "LICENCES.md"


# C2: a second zone in zones.json is read and validated with no code change
def test_second_zone_is_read_and_can_be_requested(tmp_path):
    path = tmp_path / "zones.json"
    path.write_text(json.dumps({"zones": [NANCY, TEST_ZONE]}), encoding="utf-8")
    zones = load_zones(path)
    assert [z["id"] for z in zones] == ["nancy", "essai-est"]
    assert get_zone(zones, "essai-est")["name"] == "Essai Est"


def test_second_invalid_zone_is_refused(tmp_path):
    bad = copy.deepcopy(TEST_ZONE)
    bad["bbox"]["lonMax"] = 9.0  # 1.9 degrees wide
    path = tmp_path / "zones.json"
    path.write_text(json.dumps({"zones": [NANCY, bad]}), encoding="utf-8")
    with pytest.raises(ConfigError):
        load_zones(path)


def test_unknown_id_message_lists_known_zones(tmp_path):
    with pytest.raises(ConfigError, match="nancy"):
        get_zone([NANCY], "inconnue")


def test_empty_zone_list_is_refused(tmp_path):
    path = tmp_path / "zones.json"
    path.write_text('{"zones": []}', encoding="utf-8")
    with pytest.raises(ConfigError):
        load_zones(path)


def test_non_json_file_is_refused(tmp_path):
    path = tmp_path / "zones.json"
    path.write_text("{ pas du json", encoding="utf-8")
    with pytest.raises(ConfigError):
        load_zones(path)


def test_missing_file_is_refused(tmp_path):
    with pytest.raises(ConfigError):
        load_zones(tmp_path / "nope.json")


def test_http_extract_url_is_refused(tmp_path):
    bad = dict(NANCY, osmExtractUrl="http://x.org/a.osm.pbf")
    path = tmp_path / "zones.json"
    path.write_text(json.dumps({"zones": [bad]}), encoding="utf-8")
    with pytest.raises(ConfigError):
        load_zones(path)


# HGT tiles expected for one or several zones
def test_hgt_tiles_of_nancy():
    assert sorted(hgt_names_for_bbox(NANCY["bbox"])) == ["N48E005.hgt", "N48E006.hgt"]


def test_hgt_tiles_of_other_zone_do_not_include_nancy_tiles():
    assert hgt_names_for_bbox(TEST_ZONE["bbox"]) == ["N48E007.hgt"]


def test_hgt_tiles_in_southern_western_hemisphere():
    box = {"lonMin": -69.9, "latMin": -0.8, "lonMax": -69.2, "latMax": -0.2}
    assert hgt_names_for_bbox(box) == ["S01W070.hgt"]


def test_hgt_tiles_when_zone_crosses_a_degree_line_in_both_directions():
    box = {"lonMin": 5.8, "latMin": 48.8, "lonMax": 6.2, "latMax": 49.2}
    assert sorted(hgt_names_for_bbox(box)) == ["N48E005.hgt", "N48E006.hgt", "N49E005.hgt", "N49E006.hgt"]


def _fake_valhalla_steps(monkeypatch):
    calls = []
    monkeypatch.setattr(build, "run", lambda cmd, **kw: calls.append(cmd))
    monkeypatch.setattr(build, "valhalla", lambda work, *args: calls.append(args))
    return calls


def test_cached_elevation_of_another_zone_is_not_copied_into_the_work_folder(tmp_path, monkeypatch):
    """The cache holds tiles of several zones; a zone must only get its own."""
    _fake_valhalla_steps(monkeypatch)
    cache, work = tmp_path / "cache", tmp_path / "work"
    (cache / "elevation" / "N48").mkdir(parents=True)
    for name in ("N48E005.hgt", "N48E006.hgt", "N48E007.hgt"):  # E007 belongs to another zone
        (cache / "elevation" / "N48" / name).write_bytes(b"x")
    work.mkdir()
    build.build_routing(work, cache, NANCY["bbox"], tmp_path / "x.osm.pbf")
    got = sorted(p.name for p in (work / "elevation").rglob("*.hgt"))
    assert got == ["N48E005.hgt", "N48E006.hgt"]


# SHA256SUMS
def _shasum_check(folder):
    return subprocess.run(["shasum", "-a", "256", "-c", SUMS_NAME], cwd=folder, capture_output=True, text=True)


def test_shasum_accepts_a_fresh_package(tmp_path):
    (tmp_path / "a.bin").write_bytes(b"abc")
    (tmp_path / "b.json").write_text("{}")
    write_sums(tmp_path)
    done = _shasum_check(tmp_path)
    assert done.returncode == 0, done.stdout + done.stderr


def test_shasum_detects_a_modified_file(tmp_path):
    (tmp_path / "a.bin").write_bytes(b"abc")
    (tmp_path / "b.json").write_text("{}")
    write_sums(tmp_path)
    (tmp_path / "a.bin").write_bytes(b"abd")
    done = _shasum_check(tmp_path)
    assert done.returncode != 0
    assert "a.bin: FAILED" in done.stdout


def test_shasum_detects_a_missing_file(tmp_path):
    (tmp_path / "a.bin").write_bytes(b"abc")
    write_sums(tmp_path)
    (tmp_path / "a.bin").unlink()
    assert _shasum_check(tmp_path).returncode != 0


def test_known_fingerprint_inside_sums_file(tmp_path):
    (tmp_path / "abc").write_bytes(b"abc")
    write_sums(tmp_path)
    # FIPS 180-2 annex B.1
    assert (tmp_path / SUMS_NAME).read_text() == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  abc\n"


# C8: licence template
@pytest.mark.parametrize("needle", ["OpenStreetMap", "ODbL", "OpenMapTiles", "Mapterhorn", "IGN"])
def test_licence_template_names_each_source(needle):
    assert needle in TEMPLATE.read_text(encoding="utf-8")
