import copy
import json

import pytest

from zonefactory.catalogue import (
    CatalogueError,
    load_catalogue,
    make_catalogue,
    update_catalogue,
    validate_catalogue,
    zone_entry,
)
from zonefactory.checksums import write_sums

REPO = "Emilien1982/RutaPulse"
BBOX = {"lonMin": 5.84, "latMin": 48.47, "lonMax": 6.52, "latMax": 48.92}
NAMES = [
    "valhalla_tiles.tar", "map.pmtiles", "terrain.pmtiles", "contours.pmtiles",
    "trails.geojson", "LICENCES.md", "N48E005.hgt",
]  # fmt: skip


def make_package(folder, zone_id="nancy", version=1, name="Nancy"):
    folder.mkdir(parents=True, exist_ok=True)
    for n in NAMES:
        (folder / n).write_bytes(f"{zone_id}-{n}".encode())
    info = {"formatVersion": 1, "id": zone_id, "name": name, "version": version, "bbox": BBOX,
            "osmDate": "2026-10-18T20:25:06Z", "builtAt": "2026-10-22T09:12:31Z", "tools": {}}  # fmt: skip
    (folder / "zone.json").write_text(json.dumps(info))
    write_sums(folder)
    return folder


@pytest.fixture
def entry(tmp_path):
    return zone_entry(make_package(tmp_path / "p"), REPO)


def catalogue_of(*entries):
    return {"formatVersion": 1, "zones": list(entries)}


def test_entry_has_paths_urls_sizes_and_total(entry):
    paths = [f["path"] for f in entry["files"]]
    assert paths == sorted(paths)
    assert "elevation/N48/N48E005.hgt" in paths
    hgt = next(f for f in entry["files"] if f["path"].endswith(".hgt"))
    assert hgt["url"] == f"https://github.com/{REPO}/releases/download/zone-nancy-v1/N48E005.hgt"
    assert entry["totalBytes"] == sum(f["bytes"] for f in entry["files"])
    assert "SHA256SUMS" not in paths
    validate_catalogue(catalogue_of(entry))


def test_add_a_zone_keeps_sorted_order(tmp_path, entry):
    other = zone_entry(make_package(tmp_path / "q", "metz", 1, "Metz"), REPO)
    result = update_catalogue(catalogue_of(entry), other)
    assert [z["id"] for z in result["zones"]] == ["metz", "nancy"]
    validate_catalogue(result)


def test_replace_a_version(tmp_path, entry):
    v2 = zone_entry(make_package(tmp_path / "q", version=2), REPO)
    result = update_catalogue(catalogue_of(entry), v2)
    assert [(z["id"], z["version"]) for z in result["zones"]] == [("nancy", 2)]


def test_make_catalogue_from_explicit_empty_then_replace(tmp_path):
    out = tmp_path / "c.json"
    first = tmp_path / "first.json"
    first.write_text('{"formatVersion": 1, "zones": []}')
    make_catalogue(first, make_package(tmp_path / "p1"), REPO, out)
    make_catalogue(out, make_package(tmp_path / "p2", version=2), REPO, out)
    zones = json.loads(out.read_text())["zones"]
    assert [(z["id"], z["version"]) for z in zones] == [("nancy", 2)]


def test_wrong_hash_in_sums_stops_everything(tmp_path):
    folder = make_package(tmp_path / "p")
    (folder / "map.pmtiles").write_bytes(b"changed")
    with pytest.raises(CatalogueError, match="empreinte fausse"):
        zone_entry(folder, REPO)


def test_file_not_in_sums_stops_everything(tmp_path):
    folder = make_package(tmp_path / "p")
    (folder / "extra.bin").write_bytes(b"x")
    with pytest.raises(CatalogueError, match="ne correspondent pas"):
        zone_entry(folder, REPO)


def test_bad_repo_is_refused(tmp_path):
    with pytest.raises(CatalogueError, match="--repo"):
        zone_entry(make_package(tmp_path / "p"), "pas-un-depot")


def test_invalid_result_is_not_written(tmp_path):
    folder = make_package(tmp_path / "p")
    (folder / "N48E005.hgt").unlink()  # required file missing
    write_sums(folder)
    out = tmp_path / "c.json"
    first = tmp_path / "first.json"
    first.write_text('{"formatVersion": 1, "zones": []}')
    with pytest.raises(CatalogueError, match="elevation"):
        make_catalogue(first, folder, REPO, out)
    assert not out.exists()


def drop_file(zone, path):
    zone["files"] = [f for f in zone["files"] if f["path"] != path]
    zone["totalBytes"] = sum(f["bytes"] for f in zone["files"])


def mutated(entry, change):
    data = copy.deepcopy(entry)
    change(data)
    return catalogue_of(data)


@pytest.mark.parametrize(
    "change, message",
    [
        (lambda z: z["files"][0].update(sha256="abc"), "sha256"),
        (lambda z: z["files"][0].update(path="../evil"), "path"),
        (lambda z: z["files"][0].update(path="/abs"), "path"),
        (lambda z: z["files"][0].update(url="http://x/y"), "url"),
        (lambda z: z.update(extra=1), "extra"),
        (lambda z: z.pop("osmDate"), "osmDate"),
        (lambda z: z.update(totalBytes=z["totalBytes"] + 1), "totalBytes"),
        (lambda z: z["bbox"].update(lonMin=7.0), "lonMin < lonMax"),
        (lambda z: drop_file(z, "map.pmtiles"), "map.pmtiles"),
        (lambda z: z["files"][0].update(url=z["files"][0]["url"].replace("-v1/", "-v9/")), "adresse"),
        (lambda z: z["files"].reverse(), "triés"),
    ],
)
def test_invalid_catalogues_are_refused(entry, change, message):
    with pytest.raises(CatalogueError, match=message):
        validate_catalogue(mutated(entry, change))


def test_unsorted_or_duplicate_zones_are_refused(tmp_path, entry):
    other = zone_entry(make_package(tmp_path / "q", "metz", 1, "Metz"), REPO)
    with pytest.raises(CatalogueError, match="triées"):
        validate_catalogue(catalogue_of(entry, other))
    with pytest.raises(CatalogueError, match="double"):
        validate_catalogue(catalogue_of(entry, entry))


def test_empty_catalogue_is_valid():
    validate_catalogue({"formatVersion": 1, "zones": []})


def test_same_or_lower_version_is_refused(tmp_path, entry):
    v1_again = zone_entry(make_package(tmp_path / "q", version=1), REPO)
    with pytest.raises(CatalogueError, match="plus récente"):
        update_catalogue(catalogue_of(entry), v1_again)
    v2 = zone_entry(make_package(tmp_path / "r", version=2), REPO)
    with pytest.raises(CatalogueError, match="plus récente"):
        update_catalogue(catalogue_of(v2), entry)
