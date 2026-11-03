"""Tests written from the spec (p05b, C2/C3) and ADR 0018 section 1, independent of the developer's tests."""

import json

import pytest

from zonefactory import difficulty
from zonefactory.catalogue import validate_catalogue, zone_entry
from zonefactory.checksums import write_sums

from tests.test_catalogue import REPO, catalogue_of, make_package

# Raw mtb:scale values seen in the real data: taginfo (https://taginfo.openstreetmap.org/keys/mtb%3Ascale#values)
# and the Nancy zone (osmium control: values 0, 0+, 1, 1+, 2, 2+, 2-, 3, 3+, 4, 5, 6).
# Spec rule: "+" or "-" counts in the whole level; outside 0-6 is rejected and counted.


@pytest.mark.parametrize(
    "value, level",
    [("0", 0), ("0-", 0), ("0+", 0), ("2-", 2), ("3+", 3), ("5", 5), ("6", 6), ("6+", 6), (" 4 ", 4), ("\t1", 1)],
)
def test_levels_accepted(value, level):
    assert difficulty.parse_level(value) == level


@pytest.mark.parametrize("value", ["7", "-1", "1;2", "1 ST", "s1", "", "  ", "10", "1+-", "+1", "S1", "1,5", "2 -"])
def test_values_rejected(value):
    assert difficulty.parse_level(value) is None


# Real Nancy ways (ids from the osmium control of /Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t2/, table
# difficulty.json): S0 51196394, S3 308641830, S4 592183290, S5 264743810, S6 498849998 and 552224078.
# Unrelated lines: a way without mtb:scale, a node with mtb:scale, an older version of a way.
NANCY_OPL = "\n".join(
    [
        "w552224078 v3 dV c1 t2026-01-01T00:00:00Z i1 uX Thighway=path,mtb:scale=6 Nn1,n2",
        "w498849998 v1 Thighway=path,mtb:scale=6+ Nn1,n2",
        "w264743810 v1 Thighway=path,mtb:scale=5 Nn1,n2",
        "w592183290 v1 Thighway=track,mtb:scale=4 Nn1,n2",
        "w308641830 v1 Thighway=path,mtb:scale=3+ Nn1,n2",
        "w51196394 v1 Thighway=path,mtb:scale=0- Nn1,n2",
        "w999 v1 Thighway=path Nn1,n2",
        "w1000 v1 Thighway=path,mtb:scale=7 Nn1,n2",
        "w1001 v1 Thighway=path,mtb:scale=1%20%ST Nn1,n2",
        "w1002 v1 Thighway=path,mtb:scale=-1 Nn1,n2",
        "w1003 v1 Thighway=path,mtb:scale=%20% Nn1,n2",
        "n77 v1 x6.1 y48.6 Tmtb:scale=2",
    ]
)


def test_table_from_real_nancy_ways():
    ways, rejected = difficulty.table_from_opl(NANCY_OPL)
    assert ways == [[51196394], [], [], [308641830], [592183290], [264743810], [498849998, 552224078]]
    assert dict(rejected) == {"7": 1, "1 ST": 1, "-1": 1, " ": 1}


def test_table_written_has_seven_lists_and_is_compact(tmp_path):
    ways, _ = difficulty.table_from_opl(NANCY_OPL)
    path = tmp_path / "difficulty.json"
    difficulty.write_table(path, ways)
    text = path.read_text(encoding="utf-8")
    assert "\n" not in text and " " not in text
    data = json.loads(text)
    assert data["formatVersion"] == 1 and len(data["waysByLevel"]) == 7
    assert data["waysByLevel"][6] == [498849998, 552224078]


# Catalogue (C3): a package with difficulty.json gives a valid entry that contains it.


def package_with_difficulty(folder, with_file=True):
    make_package(folder)
    if with_file:
        (folder / "difficulty.json").write_text('{"formatVersion":1,"waysByLevel":[[],[],[],[],[],[],[]]}')
        write_sums(folder)
    return folder


def test_catalogue_entry_contains_difficulty(tmp_path):
    folder = package_with_difficulty(tmp_path / "p")
    entry = zone_entry(folder, REPO)
    item = next(f for f in entry["files"] if f["path"] == "difficulty.json")
    assert item["bytes"] == (folder / "difficulty.json").stat().st_size
    assert item["url"].endswith("/zone-nancy-v1/difficulty.json")
    assert entry["totalBytes"] == sum(f["bytes"] for f in entry["files"])
    validate_catalogue(catalogue_of(entry))


def test_catalogue_total_bytes_grows_with_difficulty(tmp_path):
    without = zone_entry(package_with_difficulty(tmp_path / "a", False), REPO)
    with_ = zone_entry(package_with_difficulty(tmp_path / "b"), REPO)
    size = (tmp_path / "b" / "difficulty.json").stat().st_size
    assert with_["totalBytes"] == without["totalBytes"] + size
    assert [f["path"] for f in with_["files"]] == sorted(f["path"] for f in with_["files"])
    validate_catalogue(catalogue_of(without))  # a package without it stays valid (older zones)
