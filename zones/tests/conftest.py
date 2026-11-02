from types import SimpleNamespace

import pytest

from zonefactory import build, difficulty


@pytest.fixture(autouse=True)
def fake_difficulty_step(monkeypatch):
    """build_zone runs osmium for the difficulty step: tests replace it by an empty table (no osmium here).

    Only the reference seen by `build` is replaced; the `difficulty` module itself stays real.
    """

    def fake(zone_pbf, out, work):
        difficulty.write_table(out, [[] for _ in range(difficulty.LEVELS)])
        return []

    monkeypatch.setattr(build, "difficulty", SimpleNamespace(LEVELS=difficulty.LEVELS, extract_difficulty=fake))
