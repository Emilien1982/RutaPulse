"""Extra tests on the `coastal` rule (ADR 0003 section 5), on top of test_inland_water.py. No network, no Docker."""

import subprocess

import pytest

from tests.test_build_extract_cache import BASE, Env, make_zone
from tests.test_inland_water import BBOX, build_map, fake_environment
from zonefactory import build
from zonefactory.build import WATER_ZIP, BuildError
from zonefactory.config import ZONES_FILE, load_zones


@pytest.fixture
def env(tmp_path, monkeypatch):
    return Env(tmp_path, monkeypatch)


@pytest.mark.parametrize("coastal", [True, False])
def test_build_zone_gives_the_flag_of_the_zone_to_the_map_step(env, monkeypatch, coastal):
    seen = []
    monkeypatch.setattr(build, "build_map", lambda work, cache, bbox, pbf, c: (seen.append(c), env.build_map(work, cache, bbox, pbf, c)))
    zone = dict(make_zone(f"{BASE}-261018.osm.pbf"), coastal=coastal)
    build.build_zone(zone, 1, env.tmp / "out", env.cache)
    assert seen == [coastal]


def test_nancy_is_inland_in_the_real_zones_file():
    nancy = next(z for z in load_zones(ZONES_FILE) if z["id"] == "nancy")
    assert nancy["coastal"] is False


def test_coastal_zone_with_missing_real_file_downloads_it_without_the_minimal_file(tmp_path, monkeypatch):
    commands, _ = fake_environment(tmp_path, monkeypatch, with_real_water=False)
    build_map(tmp_path, "coast", coastal=True)
    assert any("--only-download" in c for c in commands)
    assert not any(a.startswith("--water-polygons-path") for c in commands for a in c)


def test_coastal_zone_after_an_inland_one_still_fails_clearly_when_the_server_is_down(tmp_path, monkeypatch):
    fake_environment(tmp_path, monkeypatch, with_real_water=False, fail_download=True)
    build_map(tmp_path, "inland", coastal=False)  # works without the real file
    sources = tmp_path / "cache" / "planetiler" / "sources"
    assert not (sources / WATER_ZIP).exists()
    with pytest.raises(BuildError) as err:
        build_map(tmp_path, "coast", coastal=True)
    assert "osmdata" in str(err.value) and "côtière" in str(err.value)
    assert not (sources / WATER_ZIP).exists()  # the minimal file was not taken for the real one


def test_failed_download_of_another_annex_does_not_blame_the_water_server(tmp_path, monkeypatch):
    commands, sources = fake_environment(tmp_path, monkeypatch, fail_download=True)
    (sources / "lake_centerline.shp.zip").unlink()
    with pytest.raises(BuildError) as err:
        build_map(tmp_path, "inland", coastal=False)
    assert "osmdata" not in str(err.value)
    assert "Planetiler" in str(err.value)


def test_inland_zone_with_complete_cache_does_not_use_the_network(tmp_path, monkeypatch):
    commands, _ = fake_environment(tmp_path, monkeypatch)
    build_map(tmp_path, "inland", coastal=False)
    assert not any("--download" in c or "--only-download" in c for c in commands)
