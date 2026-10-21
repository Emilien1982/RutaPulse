"""Tests from ADR 0003 sections 3, 4, 8 and ADR 0012 (catalogue, next-version, verify, CLI)."""

import copy
import json
import subprocess
import sys
from pathlib import Path

import pytest

from zonefactory.catalogue import CatalogueError, make_catalogue, update_catalogue, validate_catalogue, zone_entry
from zonefactory.checksums import write_sums
from zonefactory.verify import VerifyError, verify_zone
from zonefactory.versions import next_version

ZONES_DIR = Path(__file__).resolve().parent.parent
REPO = "Emilien1982/RutaPulse"
BBOX = {"lonMin": 5.84, "latMin": 48.47, "lonMax": 6.52, "latMax": 48.92}


def make_package(folder, zone_id="nancy", version=1, name="Nancy"):
    folder.mkdir(parents=True)
    contents = {
        "valhalla_tiles.tar": b"tar",
        "N48E005.hgt": b"hgt5",
        "N48E006.hgt": b"hgt66",
        "map.pmtiles": b"map",
        "terrain.pmtiles": b"terrain",
        "contours.pmtiles": b"contours",
        "trails.geojson": b"{}",
        "LICENCES.md": b"licences",
    }
    for n, c in contents.items():
        (folder / n).write_bytes(c)
    info = {"formatVersion": 1, "id": zone_id, "name": name, "version": version, "bbox": BBOX,
            "osmDate": "2026-10-18T20:25:06Z"}
    (folder / "zone.json").write_text(json.dumps(info))
    write_sums(folder)
    return folder


@pytest.fixture
def nancy(tmp_path):
    return make_package(tmp_path / "nancy")


# --- entry and catalogue content
def test_entry_urls_have_the_documented_form(nancy):
    entry = zone_entry(nancy, REPO)
    for f in entry["files"]:
        name = f["path"].rsplit("/", 1)[-1]
        assert f["url"] == f"https://github.com/{REPO}/releases/download/zone-nancy-v1/{name}"


def test_entry_url_uses_zone_version(tmp_path):
    entry = zone_entry(make_package(tmp_path / "p", version=7), REPO)
    assert all("/zone-nancy-v7/" in f["url"] for f in entry["files"])


def test_total_bytes_is_sum_of_sizes(nancy):
    entry = zone_entry(nancy, REPO)
    expected = sum(p.stat().st_size for p in nancy.iterdir() if p.name != "SHA256SUMS")
    assert entry["totalBytes"] == expected
    assert entry["totalBytes"] == sum(f["bytes"] for f in entry["files"])


def test_hgt_files_get_elevation_paths_and_files_are_sorted(nancy):
    paths = [f["path"] for f in zone_entry(nancy, REPO)["files"]]
    assert "elevation/N48/N48E005.hgt" in paths and "elevation/N48/N48E006.hgt" in paths
    assert paths == sorted(paths)


def test_produced_catalogue_passes_the_schema(nancy, tmp_path):
    out = tmp_path / "cat.json"
    cur = tmp_path / "cur.json"
    cur.write_text('{"formatVersion": 1, "zones": []}')
    result = make_catalogue(cur, nancy, REPO, out)
    validate_catalogue(json.loads(out.read_text()))
    assert [z["id"] for z in result["zones"]] == ["nancy"]


def test_replacing_one_of_two_zones_keeps_the_other_intact(tmp_path):
    a = zone_entry(make_package(tmp_path / "a", "nancy", 1), REPO)
    b = zone_entry(make_package(tmp_path / "b", "metz", 1, "Metz"), REPO)
    cat = update_catalogue(update_catalogue({"formatVersion": 1, "zones": []}, a), b)
    assert [z["id"] for z in cat["zones"]] == ["metz", "nancy"]
    before_metz = copy.deepcopy(cat["zones"][0])
    a2 = zone_entry(make_package(tmp_path / "a2", "nancy", 2), REPO)
    cat2 = update_catalogue(cat, a2)
    assert [(z["id"], z["version"]) for z in cat2["zones"]] == [("metz", 1), ("nancy", 2)]
    assert cat2["zones"][0] == before_metz
    validate_catalogue(cat2)


def test_update_does_not_mutate_input(tmp_path):
    a = zone_entry(make_package(tmp_path / "a"), REPO)
    cat = {"formatVersion": 1, "zones": []}
    update_catalogue(cat, a)
    assert cat["zones"] == []


@pytest.fixture
def valid_catalogue(nancy):
    return update_catalogue({"formatVersion": 1, "zones": []}, zone_entry(nancy, REPO))


def test_extra_field_is_refused(valid_catalogue):
    valid_catalogue["zones"][0]["files"][0]["extra"] = 1
    with pytest.raises(CatalogueError):
        validate_catalogue(valid_catalogue)


def test_extra_top_level_field_is_refused(valid_catalogue):
    valid_catalogue["oops"] = 1
    with pytest.raises(CatalogueError):
        validate_catalogue(valid_catalogue)


def test_short_hash_is_refused(valid_catalogue):
    valid_catalogue["zones"][0]["files"][0]["sha256"] = "ab" * 31
    with pytest.raises(CatalogueError):
        validate_catalogue(valid_catalogue)


@pytest.mark.parametrize("bad", ["../x.bin", "elevation/../x.bin", "/abs.bin"])
def test_dangerous_path_is_refused(valid_catalogue, bad):
    valid_catalogue["zones"][0]["files"][0]["path"] = bad
    with pytest.raises(CatalogueError):
        validate_catalogue(valid_catalogue)


def test_wrong_total_bytes_is_refused(valid_catalogue):
    valid_catalogue["zones"][0]["totalBytes"] += 1
    with pytest.raises(CatalogueError):
        validate_catalogue(valid_catalogue)


def test_missing_required_file_is_refused(valid_catalogue):
    z = valid_catalogue["zones"][0]
    gone = next(f for f in z["files"] if f["path"] == "terrain.pmtiles")
    z["files"].remove(gone)
    z["totalBytes"] -= gone["bytes"]
    with pytest.raises(CatalogueError):
        validate_catalogue(valid_catalogue)


def test_url_with_wrong_tag_is_refused(valid_catalogue):
    f = valid_catalogue["zones"][0]["files"][0]
    f["url"] = f["url"].replace("zone-nancy-v1", "zone-nancy-v2")
    with pytest.raises(CatalogueError):
        validate_catalogue(valid_catalogue)


def test_http_url_is_refused(valid_catalogue):
    f = valid_catalogue["zones"][0]["files"][0]
    f["url"] = f["url"].replace("https://", "http://")
    with pytest.raises(CatalogueError):
        validate_catalogue(valid_catalogue)


def test_unsorted_zones_are_refused(tmp_path):
    a = zone_entry(make_package(tmp_path / "a", "nancy"), REPO)
    b = zone_entry(make_package(tmp_path / "b", "metz", name="Metz"), REPO)
    with pytest.raises(CatalogueError):
        validate_catalogue({"formatVersion": 1, "zones": [a, b]})


def test_package_with_tampered_file_is_refused(nancy):
    (nancy / "map.pmtiles").write_bytes(b"other")
    with pytest.raises(CatalogueError):
        zone_entry(nancy, REPO)


def test_package_with_extra_file_is_refused(nancy):
    (nancy / "extra.bin").write_bytes(b"x")
    with pytest.raises(CatalogueError):
        zone_entry(nancy, REPO)


def test_bad_repo_is_refused(nancy):
    with pytest.raises(CatalogueError):
        zone_entry(nancy, "pas-un-depot")


# --- the reviewer's point: a missing or empty --current must not silently become an empty catalogue
def test_missing_current_catalogue_is_refused(nancy, tmp_path):
    out = tmp_path / "out.json"
    with pytest.raises(CatalogueError):
        make_catalogue(tmp_path / "absent.json", nancy, REPO, out)
    assert not out.exists()


def test_empty_current_catalogue_file_is_refused(nancy, tmp_path):
    cur = tmp_path / "cur.json"
    cur.write_text("")
    with pytest.raises(CatalogueError):
        make_catalogue(cur, nancy, REPO, tmp_path / "out.json")


def test_explicit_empty_catalogue_is_accepted(nancy, tmp_path):
    cur = tmp_path / "cur.json"
    cur.write_text('{"formatVersion": 1, "zones": []}')
    assert len(make_catalogue(cur, nancy, REPO, tmp_path / "out.json")["zones"]) == 1


def test_invalid_current_catalogue_is_refused(nancy, tmp_path):
    cur = tmp_path / "cur.json"
    cur.write_text('{"formatVersion": 2, "zones": []}')
    with pytest.raises(CatalogueError):
        make_catalogue(cur, nancy, REPO, tmp_path / "out.json")


# --- next-version
@pytest.mark.parametrize(
    "tags, expected",
    [
        ([], 1),
        (["zone-nancy-v1", "zone-nancy-v3"], 4),
        (["zone-nancy-v1", "zone-nancy-v3", "zone-nancy-est-v9"], 4),
        (["zone-nancy-est-v9"], 1),
        (["catalogue", "zone-metz-v5"], 1),
        (["zone-nancy-v10", "zone-nancy-v9"], 11),
        (["zone-nancy-v2x", "v7"], 1),
    ],
)
def test_next_version(tags, expected):
    assert next_version("nancy", tags) == expected


def cli(*args, stdin=None, cwd=ZONES_DIR):
    return subprocess.run([sys.executable, "-m", "zonefactory", *map(str, args)], cwd=cwd, input=stdin,
                          capture_output=True, text=True)


def test_cli_next_version_reads_stdin():
    done = cli("next-version", "nancy", stdin="zone-nancy-v1\nzone-nancy-v3\nzone-nancy-est-v9\n")
    assert (done.returncode, done.stdout.strip()) == (0, "4")


def test_cli_next_version_empty_stdin():
    done = cli("next-version", "nancy", stdin="")
    assert (done.returncode, done.stdout.strip()) == (0, "1")


# --- verify
def local_catalogue(package, entry_url_root):
    """Catalogue whose urls point to the local package through file:// addresses."""
    cat = update_catalogue({"formatVersion": 1, "zones": []}, zone_entry(package, REPO))
    for f in cat["zones"][0]["files"]:
        f["url"] = f"file://{package}/{f['path'].rsplit('/', 1)[-1]}"
    return cat


def test_verify_stores_files_under_their_path(nancy, tmp_path):
    cat = local_catalogue(nancy, None)
    dest = tmp_path / "dest"
    stored = verify_zone(cat, "nancy", dest)
    assert (dest / "elevation" / "N48" / "N48E005.hgt").read_bytes() == b"hgt5"
    assert (dest / "valhalla_tiles.tar").read_bytes() == b"tar"
    assert "elevation/N48/N48E006.hgt" in stored
    assert not list(dest.rglob("*.part"))


def test_verify_wrong_hash_stops(nancy, tmp_path):
    cat = local_catalogue(nancy, None)
    cat["zones"][0]["files"][0]["sha256"] = "0" * 64
    with pytest.raises(VerifyError, match="empreinte"):
        verify_zone(cat, "nancy", tmp_path / "dest")
    assert not list((tmp_path / "dest").rglob("*.part"))


def test_verify_wrong_size_stops(nancy, tmp_path):
    cat = local_catalogue(nancy, None)
    cat["zones"][0]["files"][0]["bytes"] += 1
    with pytest.raises(VerifyError, match="taille"):
        verify_zone(cat, "nancy", tmp_path / "dest")


def test_verify_unknown_zone(nancy, tmp_path):
    with pytest.raises(VerifyError):
        verify_zone(local_catalogue(nancy, None), "metz", tmp_path / "dest")


def test_verify_unreachable_file(nancy, tmp_path):
    cat = local_catalogue(nancy, None)
    cat["zones"][0]["files"][0]["url"] = f"file://{tmp_path}/nope"
    with pytest.raises(VerifyError):
        verify_zone(cat, "nancy", tmp_path / "dest")


def test_verify_stops_at_the_first_wrong_file(nancy, tmp_path):
    cat = local_catalogue(nancy, None)
    cat["zones"][0]["files"][0]["sha256"] = "0" * 64
    dest = tmp_path / "dest"
    with pytest.raises(VerifyError):
        verify_zone(cat, "nancy", dest)
    assert not [p for p in dest.rglob("*") if p.is_file()]


def test_cli_verify_exit_codes(nancy, tmp_path):
    cat = local_catalogue(nancy, None)
    good = tmp_path / "good.json"
    good.write_text(json.dumps(cat))
    ok = cli("verify", "--catalogue", good, "--zone", "nancy", "--dest", tmp_path / "d1")
    assert ok.returncode == 0, ok.stderr
    cat["zones"][0]["files"][1]["bytes"] += 5
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps(cat))
    ko = cli("verify", "--catalogue", bad, "--zone", "nancy", "--dest", tmp_path / "d2")
    assert ko.returncode != 0 and "Erreur" in ko.stderr
