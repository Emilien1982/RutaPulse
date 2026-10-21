"""Tests from ADR 0003 section 2 (osmExtract) and the cache rules, with no network and no Docker."""

import hashlib
import json
from pathlib import Path

import pytest

from zonefactory import build
from zonefactory.checksums import SUMS_NAME

BBOX = {"lonMin": 5.84, "latMin": 48.47, "lonMax": 6.52, "latMax": 48.92}
TILES = ["N48E005.hgt", "N48E006.hgt"]
SIZE = 3601 * 3601 * 2  # SRTM 1 arc-second tile, independent of the code
OSM_DATE = "2026-10-18T20:25:06Z"
BASE = "https://download.geofabrik.de/europe/france/lorraine"


def make_zone(url):
    return {"id": "nancy", "name": "Nancy", "bbox": BBOX, "osmExtractUrl": url}


def test_dated_url_from_latest():
    # Reference checked at Geofabrik: 2026-10-18T20:25:06Z <-> lorraine-261018.osm.pbf
    assert build.dated_url(f"{BASE}-latest.osm.pbf", OSM_DATE) == f"{BASE}-261018.osm.pbf"


def test_dated_url_keeps_an_already_dated_address():
    url = f"{BASE}-260901.osm.pbf"
    assert build.dated_url(url, OSM_DATE) == url


def test_dated_url_does_not_touch_other_names():
    url = "https://example.org/data/extract.osm.pbf"
    assert build.dated_url(url, OSM_DATE) == url


class Env:
    """Replaces every slow or external step of build_zone; records the downloads."""

    def __init__(self, tmp_path, monkeypatch):
        self.tmp, self.downloads = tmp_path, []
        self.cache = tmp_path / "cache"
        self.osm = tmp_path / "work" / "osm"
        monkeypatch.setattr(build, "WORK_DIR", tmp_path / "work")
        monkeypatch.setattr(build, "OSM_DIR", self.osm)
        monkeypatch.setattr(build, "tool_versions", lambda: {"valhalla": "3.9.1"})
        monkeypatch.setattr(build, "osm_header", lambda pbf, bbox: OSM_DATE)
        monkeypatch.setattr(build, "download", self.download)
        monkeypatch.setattr(build, "run", lambda cmd, **kw: None)
        monkeypatch.setattr(build, "valhalla", self.valhalla)
        monkeypatch.setattr(build, "build_map", self.build_map)
        monkeypatch.setattr(build, "build_terrain", lambda work, bbox: (work / "terrain.pmtiles").write_bytes(b"t"))
        monkeypatch.setattr(build, "build_contours", lambda work, bbox, name: (work / "contours.pmtiles").write_bytes(b"c"))
        monkeypatch.setattr(build.trails, "extract_trails", lambda *a: (a[2].write_text("{}"), [])[1])
        self.elevation_built = False

    def download(self, url, dest):
        self.downloads.append(url)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(b"downloaded:" + url.encode())

    def valhalla(self, work, *args):
        if args[0] == "valhalla_build_elevation":
            self.elevation_built = True
            (work / "elevation" / "N48").mkdir(parents=True, exist_ok=True)
            for n in TILES:
                (work / "elevation" / "N48" / n).write_bytes(b"\0" * SIZE)
        elif args[0] == "valhalla_build_extract":
            (work / "valhalla_tiles.tar").write_bytes(b"tar")

    def build_map(self, work, cache, bbox, pbf):
        (work / "planetiler").mkdir()
        (work / "planetiler" / "map.pmtiles").write_bytes(b"m")

    def cached(self, name, size):
        path = self.cache / "elevation" / "N48" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"\0" * size)
        return path

    def build(self, url, out=None):
        out = out or self.tmp / "out"
        build.build_zone(make_zone(url), 1, out, self.cache)
        return out


@pytest.fixture
def env(tmp_path, monkeypatch):
    return Env(tmp_path, monkeypatch)


def test_latest_extract_already_present_is_not_reused(env):
    env.osm.mkdir(parents=True)
    old = env.osm / "lorraine-latest.osm.pbf"
    old.write_bytes(b"yesterday")
    env.build(f"{BASE}-latest.osm.pbf")
    assert env.downloads == [f"{BASE}-latest.osm.pbf"]
    assert old.read_bytes() != b"yesterday"


def test_dated_extract_already_present_is_reused(env):
    env.osm.mkdir(parents=True)
    (env.osm / "lorraine-261018.osm.pbf").write_bytes(b"kept")
    out = env.build(f"{BASE}-261018.osm.pbf")
    assert env.downloads == []
    zone = json.loads((out / "zone.json").read_text())
    assert zone["osmExtract"] == {"url": f"{BASE}-261018.osm.pbf", "md5": hashlib.md5(b"kept").hexdigest()}


def test_zone_json_notes_dated_url_and_md5_when_built_from_latest(env):
    out = env.build(f"{BASE}-latest.osm.pbf")
    zone = json.loads((out / "zone.json").read_text())
    assert zone["osmExtract"]["url"] == f"{BASE}-261018.osm.pbf"
    pbf = env.osm / "lorraine-latest.osm.pbf"
    assert zone["osmExtract"]["md5"] == hashlib.md5(pbf.read_bytes()).hexdigest()
    assert zone["osmDate"] == OSM_DATE


def test_truncated_cached_tile_is_dropped_by_the_check(env):
    bad = env.cached("N48E005.hgt", 1234)
    good = env.cached("N48E006.hgt", SIZE)
    build.drop_truncated_tiles(env.cache, BBOX)
    assert not bad.exists()
    assert good.exists()


def test_truncated_cached_tile_is_neither_reused_nor_packaged(env):
    env.cached("N48E005.hgt", 1234)
    env.cached("N48E006.hgt", SIZE)
    out = env.build(f"{BASE}-261018.osm.pbf")
    assert env.elevation_built  # the zone's tiles were rebuilt
    for n in TILES:
        assert (out / n).stat().st_size == SIZE
    assert (env.cache / "elevation" / "N48" / "N48E005.hgt").stat().st_size == SIZE


def test_complete_cached_tiles_are_reused_and_only_zone_tiles_packaged(env):
    for n in TILES + ["N48E007.hgt"]:
        env.cached(n, SIZE)
    out = env.build(f"{BASE}-261018.osm.pbf")
    assert not env.elevation_built
    assert sorted(p.name for p in out.iterdir() if p.suffix == ".hgt") == TILES
    sums = (out / SUMS_NAME).read_text()
    assert "N48E007" not in sums
