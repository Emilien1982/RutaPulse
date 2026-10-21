import subprocess

import pytest

from zonefactory import build
from zonefactory.__main__ import main


def failing(times):
    calls = []

    def action():
        calls.append(1)
        if len(calls) <= times:
            raise subprocess.CalledProcessError(1, ["docker"])
        return "ok"

    return action, calls


def test_retry_succeeds_after_two_failures(monkeypatch):
    sleeps = []
    monkeypatch.setattr(build.time, "sleep", sleeps.append)
    action, calls = failing(2)
    assert build.retry(action, attempts=3, wait_seconds=7) == "ok"
    assert len(calls) == 3 and sleeps == [7, 7]


def test_retry_gives_up_after_the_last_attempt(monkeypatch):
    monkeypatch.setattr(build.time, "sleep", lambda s: None)
    action, calls = failing(5)
    with pytest.raises(subprocess.CalledProcessError):
        build.retry(action, attempts=3)
    assert len(calls) == 3


def test_planetiler_download_is_retried_then_map_is_built(tmp_path, monkeypatch):
    commands = []

    def fake_run(cmd, **kw):
        commands.append(cmd)
        if "--only-download" in cmd and len(commands) == 1:
            raise subprocess.CalledProcessError(1, cmd)

    monkeypatch.setattr(build, "run", fake_run)
    monkeypatch.setattr(build.time, "sleep", lambda s: None)
    work, cache = tmp_path / "work", tmp_path / "cache"
    work.mkdir()
    bbox = {"lonMin": 5.84, "latMin": 48.47, "lonMax": 6.52, "latMax": 48.92}
    build.build_map(work, cache, bbox, tmp_path / "x.osm.pbf")
    assert ["--only-download" in c for c in commands] == [True, True, False]
    assert "--output=/data/map.pmtiles" in commands[-1]


def test_failed_command_gives_a_french_message_not_a_traceback(monkeypatch, capsys):
    def boom(*a, **k):
        raise subprocess.CalledProcessError(3, ["docker", "run"])

    monkeypatch.setattr("zonefactory.__main__.build_zone", boom)
    assert main(["build", "nancy", "--version", "1", "--out", "x"]) == 1
    assert "la commande a échoué (code 3) : docker run" in capsys.readouterr().err
