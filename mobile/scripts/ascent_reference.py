"""Reference D+ / D- for the T3 check of ADR 0017 (rerunnable).
Method of comparer.py (T1 trial): hysteresis 5 m on the `range_height` altitudes of
the real `height` answers kept in src/core/routing/fixtures/infos/.
Usage (from mobile/): python3 -I scripts/ascent_reference.py
"""
import json
from pathlib import Path

FIXTURES = Path(__file__).resolve().parent.parent / "src/core/routing/fixtures/infos"


def _up(e, hyst=5.0):
    ref, total = e[0], 0.0
    for v in e[1:]:
        if v - ref >= hyst:
            total += v - ref
            ref = v
        elif ref - v >= hyst:
            ref = v
    return total


for path in sorted(FIXTURES.glob("*height*range*.json")):
    r = json.loads(path.read_text())["response"]
    h = [p[1] for p in r.get("range_height", [])]
    if not h or any(v is None for v in h):
        print(f"{path.name}: n/a")
        continue
    print(f"{path.name}: n={len(h)} dplus={_up(h):g} dminus={_up([-v for v in h]):g} min={min(h)} max={max(h)}")


# Terrain shares: rule of ADR 0017 section 3, largest-remainder rounding (ties: road, track, trail).
TRAIL = {"path", "footway", "mountain_bike", "cycleway", "pedestrian", "bridleway", "steps", "sidewalk"}


def classify(e):
    use, density = e.get("use"), e.get("density", 0)
    if use == "track":
        return "track"
    return "trail" if use in TRAIL and density < 6 else "road"


def shares(edges):
    km = {"road": 0.0, "track": 0.0, "trail": 0.0}
    for e in edges:
        km[classify(e)] += e["length"]
    total = sum(km.values())
    names = list(km)
    exact = [km[n] / total * 100 for n in names]
    res = [int(x + 1e-9) for x in exact]
    order = sorted(range(3), key=lambda i: (-(exact[i] - res[i]) if abs(exact[i] - res[i]) > 1e-9 else 0, i))
    order = sorted(range(3), key=lambda i: (-round(exact[i] - res[i], 9), i))
    for i in order[: 100 - sum(res)]:
        res[i] += 1
    return dict(zip(names, res))


for path in sorted(FIXTURES.glob("*trace*walk_or_snap.json")):
    edges = json.loads(path.read_text())["response"].get("edges")
    if edges:
        print(f"{path.name}: shares(road,track,trail)={shares(edges)}")
