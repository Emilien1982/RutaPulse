import pytest

from zonefactory.__main__ import main
from zonefactory.versions import next_version


def test_no_tag_gives_1():
    assert next_version("nancy", []) == 1


def test_largest_tag_plus_one():
    assert next_version("nancy", ["zone-nancy-v1", "zone-nancy-v3"]) == 4


def test_other_zone_with_same_prefix_does_not_count():
    assert next_version("nancy", ["zone-nancy-est-v9", "zone-nancy-v2"]) == 3
    assert next_version("nancy", ["zone-nancy-est-v9"]) == 1


def test_unrelated_tags_and_non_numbers_are_ignored():
    assert next_version("nancy", ["catalogue", "zone-nancy-vx", "zone-nancy-v2-bis", "xzone-nancy-v8"]) == 1


def test_command_reads_standard_input(monkeypatch, capsys):
    import io

    monkeypatch.setattr("sys.stdin", io.StringIO("catalogue\nzone-nancy-v1\nzone-nancy-v3\n"))
    assert main(["next-version", "nancy"]) == 0
    assert capsys.readouterr().out.strip() == "4"
