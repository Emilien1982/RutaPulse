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


BBOX = {"lonMin": 5.84, "latMin": 48.47, "lonMax": 6.52, "latMax": 48.92}


def run_build_map(tmp_path, monkeypatch, present, fail_first_download=False):
    commands = []

    def fake_run(cmd, **kw):
        commands.append(cmd)
        if fail_first_download and "--only-download" in cmd and len(commands) == 1:
            raise subprocess.CalledProcessError(1, cmd)

    monkeypatch.setattr(build, "run", fake_run)
    monkeypatch.setattr(build.time, "sleep", lambda s: None)
    work, cache = tmp_path / "work", tmp_path / "cache"
    work.mkdir()
    sources = cache / "planetiler" / "sources"
    sources.mkdir(parents=True)
    for name in present:
        (sources / name).write_bytes(b"x")
    build.build_map(work, cache, BBOX, tmp_path / "x.osm.pbf")
    return commands


def test_complete_cache_means_no_download_at_all(tmp_path, monkeypatch):
    commands = run_build_map(tmp_path, monkeypatch, build.PLANETILER_SOURCES)
    assert len(commands) == 1
    assert "--download" not in commands[0] and "--only-download" not in commands[0]
    assert "--output=/data/map.pmtiles" in commands[0]


def test_incomplete_cache_downloads_with_retries_then_builds_without_download(tmp_path, monkeypatch):
    commands = run_build_map(tmp_path, monkeypatch, build.PLANETILER_SOURCES[:2], fail_first_download=True)
    assert ["--only-download" in c for c in commands] == [True, True, False]
    assert "--download" not in commands[-1]
    assert "--output=/data/map.pmtiles" in commands[-1]


def test_failed_command_gives_a_french_message_not_a_traceback(monkeypatch, capsys):
    def boom(*a, **k):
        raise subprocess.CalledProcessError(3, ["docker", "run"])

    monkeypatch.setattr("zonefactory.__main__.build_zone", boom)
    assert main(["build", "nancy", "--version", "1", "--out", "x"]) == 1
    assert "la commande a échoué (code 3) : docker run" in capsys.readouterr().err
