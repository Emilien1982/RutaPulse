"""Water polygons: the real file for a coastal zone, a minimal one for an inland zone (ADR 0003, section 5)."""

import copy
import json
import subprocess
import zipfile

import pytest

from zonefactory import build
from zonefactory.build import BuildError, WATER_ZIP
from zonefactory.config import ConfigError, load_zones

BBOX = {"lonMin": 5.84, "latMin": 48.47, "lonMax": 6.52, "latMax": 48.92}
ZONE = {
    "id": "nancy",
    "name": "Nancy",
    "bbox": BBOX,
    "osmExtractUrl": "https://download.geofabrik.de/europe/france/lorraine-latest.osm.pbf",
    "coastal": False,
}


def fake_environment(tmp_path, monkeypatch, with_real_water=True, fail_download=False):
    """Fake Docker and the minimal-file maker. Return (commands, cache sources folder)."""
    commands = []

    def fake_run(cmd, **kw):
        commands.append(cmd)
        if fail_download and "--only-download" in cmd:
            raise subprocess.CalledProcessError(1, cmd)

    def fake_inland_water(work):
        folder = work / "water"
        folder.mkdir(parents=True)
        (folder / WATER_ZIP).write_bytes(b"minimal")
        return folder / WATER_ZIP

    monkeypatch.setattr(build, "run", fake_run)
    monkeypatch.setattr(build, "inland_water_zip", fake_inland_water)
    monkeypatch.setattr(build.time, "sleep", lambda s: None)
    sources = tmp_path / "cache" / "planetiler" / "sources"
    sources.mkdir(parents=True)
    for name in build.PLANETILER_SOURCES:
        if name != WATER_ZIP or with_real_water:
            (sources / name).write_bytes(b"real")
    return commands, sources


def build_map(tmp_path, name, coastal):
    work = tmp_path / name
    work.mkdir()
    build.build_map(work, tmp_path / "cache", BBOX, tmp_path / "x.osm.pbf", coastal)


def test_inland_zone_gives_the_minimal_file_to_planetiler(tmp_path, monkeypatch):
    commands, _ = fake_environment(tmp_path, monkeypatch)
    build_map(tmp_path, "inland", coastal=False)
    assert f"--water-polygons-path=/water/{WATER_ZIP}" in commands[-1]
    mount = commands[-1][commands[-1].index(f"{tmp_path / 'inland' / 'water'}:/water:ro")]
    assert mount.endswith(":/water:ro")


def test_coastal_zone_uses_the_real_file_from_the_cache(tmp_path, monkeypatch):
    commands, _ = fake_environment(tmp_path, monkeypatch)
    build_map(tmp_path, "coast", coastal=True)
    assert not any(a.startswith("--water-polygons-path") for a in commands[-1])
    assert not any(a.endswith(":/water:ro") for a in commands[-1])


def test_minimal_file_never_enters_the_cache(tmp_path, monkeypatch):
    _, sources = fake_environment(tmp_path, monkeypatch)
    build_map(tmp_path, "inland", coastal=False)
    assert (sources / WATER_ZIP).read_bytes() == b"real"
    assert sorted(p.name for p in sources.iterdir()) == sorted(build.PLANETILER_SOURCES)


def test_coastal_zone_after_an_inland_zone_gets_the_real_file(tmp_path, monkeypatch):
    commands, sources = fake_environment(tmp_path, monkeypatch)
    build_map(tmp_path, "inland", coastal=False)
    build_map(tmp_path, "coast", coastal=True)
    assert not any(a.startswith("--water-polygons-path") for a in commands[-1])
    assert (sources / WATER_ZIP).read_bytes() == b"real"


def test_inland_zone_does_not_need_the_real_water_file(tmp_path, monkeypatch):
    commands, sources = fake_environment(tmp_path, monkeypatch, with_real_water=False)
    build_map(tmp_path, "inland", coastal=False)
    assert len(commands) == 1 and "--download" not in commands[0]
    assert not (sources / WATER_ZIP).exists()


def test_coastal_zone_without_real_file_and_a_dead_server_gets_a_clear_message(tmp_path, monkeypatch):
    fake_environment(tmp_path, monkeypatch, with_real_water=False, fail_download=True)
    with pytest.raises(BuildError, match="serveur des polygones d'eau"):
        build_map(tmp_path, "coast", coastal=True)


def test_zip_has_the_layout_of_the_real_file(tmp_path):
    shapes = tmp_path / "shapes"
    shapes.mkdir()
    for ext in ("shp", "shx", "dbf", "prj"):
        (shapes / f"water_polygons.{ext}").write_bytes(b"x")
    zip_path = build.zip_shapefile(shapes, tmp_path / WATER_ZIP)
    names = zipfile.ZipFile(zip_path).namelist()
    assert names == [f"water-polygons-split-3857/water_polygons.{e}" for e in ("dbf", "prj", "shp", "shx")]


def test_zones_json_without_coastal_is_refused(tmp_path):
    zone = copy.deepcopy(ZONE)
    del zone["coastal"]
    path = tmp_path / "zones.json"
    path.write_text(json.dumps({"zones": [zone]}), encoding="utf-8")
    with pytest.raises(ConfigError, match="coastal"):
        load_zones(path)


def test_coastal_must_be_a_boolean(tmp_path):
    path = tmp_path / "zones.json"
    path.write_text(json.dumps({"zones": [dict(ZONE, coastal="non")]}), encoding="utf-8")
    with pytest.raises(ConfigError):
        load_zones(path)


def test_both_values_are_accepted(tmp_path):
    other = dict(ZONE, id="brest", coastal=True)
    path = tmp_path / "zones.json"
    path.write_text(json.dumps({"zones": [ZONE, other]}), encoding="utf-8")
    assert [z["coastal"] for z in load_zones(path)] == [False, True]
