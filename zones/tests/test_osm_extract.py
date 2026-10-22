import pytest

from zonefactory.__main__ import main
from zonefactory.build import dated_url, md5_file

BASE = "https://download.geofabrik.de/europe/france/"


def test_latest_becomes_dated_with_utc_date_of_osm_date():
    assert dated_url(BASE + "lorraine-latest.osm.pbf", "2026-10-18T20:25:06Z") == BASE + "lorraine-261018.osm.pbf"


def test_utc_date_is_used_near_midnight():
    assert dated_url(BASE + "alsace-latest.osm.pbf", "2026-01-01T00:00:00Z") == BASE + "alsace-260101.osm.pbf"


@pytest.mark.parametrize("url", [BASE + "lorraine-261018.osm.pbf", "https://example.org/x.osm.pbf"])
def test_other_addresses_are_kept(url):
    assert dated_url(url, "2026-10-18T20:25:06Z") == url


def test_md5_of_abc(tmp_path):
    (tmp_path / "f").write_bytes(b"abc")
    assert md5_file(tmp_path / "f") == "900150983cd24fb0d6963f7d28e17f72"


def test_osm_url_option_must_be_an_https_pbf_address(capsys):
    code = main(["build", "nancy", "--version", "1", "--out", "x", "--osm-url", "http://a/b.osm.pbf"])
    assert code == 1
    assert "--osm-url" in capsys.readouterr().err
