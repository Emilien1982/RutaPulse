import json

import pytest

from tests.test_catalogue import REPO, make_package
from zonefactory.__main__ import main
from zonefactory.catalogue import zone_entry
from zonefactory.verify import VerifyError, verify_zone


@pytest.fixture
def served(tmp_path):
    """A package and a catalogue whose addresses are file:// addresses."""
    package = make_package(tmp_path / "release")
    entry = zone_entry(package, REPO)
    for f in entry["files"]:
        f["url"] = (package / f["url"].rsplit("/", 1)[1]).as_uri()
    return package, {"formatVersion": 1, "zones": [entry]}


def test_good_package_is_stored_under_its_paths(tmp_path, served):
    _, catalogue = served
    stored = verify_zone(catalogue, "nancy", tmp_path / "dest")
    assert "elevation/N48/N48E005.hgt" in stored
    assert (tmp_path / "dest" / "elevation" / "N48" / "N48E005.hgt").read_bytes() == b"nancy-N48E005.hgt"
    assert not list((tmp_path / "dest").rglob("*.part"))


def test_wrong_hash_is_detected(tmp_path, served):
    package, catalogue = served
    (package / "map.pmtiles").write_bytes(b"nancy-map.pmtiles".replace(b"m", b"M"))  # same size, other bytes
    with pytest.raises(VerifyError, match="empreinte fausse pour map.pmtiles"):
        verify_zone(catalogue, "nancy", tmp_path / "dest")
    assert not (tmp_path / "dest" / "map.pmtiles").exists()


def test_wrong_size_is_detected(tmp_path, served):
    package, catalogue = served
    (package / "trails.geojson").write_bytes(b"short")
    with pytest.raises(VerifyError, match="taille fausse pour trails.geojson"):
        verify_zone(catalogue, "nancy", tmp_path / "dest")


def test_unknown_zone_and_unsafe_path(tmp_path, served):
    _, catalogue = served
    with pytest.raises(VerifyError, match="absente"):
        verify_zone(catalogue, "metz", tmp_path / "dest")
    catalogue["zones"][0]["files"][0]["path"] = "../evil"
    with pytest.raises(VerifyError, match="refusé"):
        verify_zone(catalogue, "nancy", tmp_path / "dest")


def test_command_with_local_catalogue_file(tmp_path, served, capsys):
    _, catalogue = served
    (tmp_path / "c.json").write_text(json.dumps(catalogue))
    assert main(["verify", "--catalogue", str(tmp_path / "c.json"), "--zone", "nancy", "--dest", str(tmp_path / "d")]) == 0
    assert "correcte" in capsys.readouterr().out


def test_command_exit_code_is_not_zero_on_wrong_file(tmp_path, served, capsys):
    package, catalogue = served
    (package / "LICENCES.md").write_bytes(b"x")
    (tmp_path / "c.json").write_text(json.dumps(catalogue))
    assert main(["verify", "--catalogue", str(tmp_path / "c.json"), "--zone", "nancy", "--dest", str(tmp_path / "d")]) == 1
    assert "Erreur" in capsys.readouterr().err


def test_catalogue_is_checked_against_the_schema_but_file_urls_pass(tmp_path, served):
    _, catalogue = served
    catalogue["zones"][0]["files"][0]["sha256"] = "abc"
    with pytest.raises(VerifyError, match="sha256"):
        verify_zone(catalogue, "nancy", tmp_path / "dest")


def test_cut_download_gives_a_french_message(tmp_path, served, monkeypatch):
    import http.client

    from zonefactory import verify

    _, catalogue = served

    def cut(url):
        raise http.client.IncompleteRead(b"ab")

    monkeypatch.setattr(verify, "_open", cut)
    with pytest.raises(VerifyError, match="téléchargement impossible"):
        verify_zone(catalogue, "nancy", tmp_path / "dest")
