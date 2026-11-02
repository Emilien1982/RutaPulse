"""build_zone and the difficulty step (ADR 0018 section 6, T2): input file, output file, checksums, catalogue."""

import json
from types import SimpleNamespace

import pytest

from zonefactory import build, difficulty
from zonefactory.catalogue import validate_catalogue, zone_entry
from zonefactory.checksums import SUMS_NAME

from tests.test_build_extract_cache import BASE, Env
from tests.test_catalogue import REPO, catalogue_of

TABLE = [[1], [], [2, 3], [], [], [], [9]]


@pytest.fixture
def env(tmp_path, monkeypatch):
    return Env(tmp_path, monkeypatch)


@pytest.fixture
def calls(monkeypatch):
    recorded = []

    def recording(zone_pbf, out, work):
        recorded.append((zone_pbf, out, work))
        difficulty.write_table(out, TABLE)
        return ["1 voie"]

    monkeypatch.setattr(build, "difficulty", SimpleNamespace(LEVELS=7, extract_difficulty=recording))
    return recorded


def test_step_reads_the_zone_extract_not_the_regional_one(env, calls):
    env.build(f"{BASE}-261018.osm.pbf")
    assert len(calls) == 1
    zone_pbf, out_file, work = calls[0]
    assert zone_pbf == work / "zone.osm.pbf"
    assert zone_pbf.name != "lorraine-261018.osm.pbf"
    assert out_file == work / "difficulty.json"


def test_difficulty_is_in_the_package_sums_and_catalogue(env, calls):
    out = env.build(f"{BASE}-261018.osm.pbf")
    assert json.loads((out / "difficulty.json").read_text()) == {"formatVersion": 1, "waysByLevel": TABLE}
    assert any(l.endswith("  difficulty.json") for l in (out / SUMS_NAME).read_text().splitlines())
    assert "difficulty.json" in (out / SUMS_NAME).read_text()
    entry = zone_entry(out, REPO)
    assert "difficulty.json" in [f["path"] for f in entry["files"]]
    assert entry["totalBytes"] == sum(f["bytes"] for f in entry["files"])
    validate_catalogue(catalogue_of(entry))


def test_default_fake_still_gives_a_package_with_an_empty_table(env):
    out = env.build(f"{BASE}-261018.osm.pbf")
    data = json.loads((out / "difficulty.json").read_text())
    assert data == {"formatVersion": 1, "waysByLevel": [[]] * 7}
