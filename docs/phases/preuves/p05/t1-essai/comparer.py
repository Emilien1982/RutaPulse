"""THROWAWAY (phase 5, T1). Compares the raw answers iOS / Android / Mac, step by step, and the two
elevation sources (route elevation_interval vs height resample 30). Usage (from this folder):
python3 -I comparer.py
"""
import json, math
from pathlib import Path

H = Path(__file__).resolve().parent


def load(d, step):
    p = H / d / f"a-{step}.json"
    return json.loads(p.read_text())["response"] if p.exists() else None


def same(a, b, tol=1e-6):
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(same(a[k], b[k], tol) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(same(x, y, tol) for x, y in zip(a, b))
    if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
        return abs(a - b) <= tol
    return a == b


def code(r):
    return r.get("code") if isinstance(r, dict) else None


steps = [r["step"] for r in json.loads((H / "ios/a-resume.json").read_text())]
print("step | ios=android | ios=mac")
for s in steps:
    i, a, m = load("ios", s), load("android", s), load("mac", s)
    ia = same(i, a) or (code(i) is not None and code(i) == code(a))
    im = "non lancé" if m is None else (same(i, m) or (code(i) is not None and code(i) == code(m)))
    if m is not None and code(m) is None and code(i) is None and not im and isinstance(m, dict) and "trip" in m:
        im = same(i["trip"]["legs"], m["trip"]["legs"])
    print(f"{s:34s} {ia!s:6s} {im!s}")


def _up(e, hyst=5.0):  # method of essay 1 (hysteresis 5 m)
    ref, total = e[0], 0.0
    for v in e[1:]:
        if v - ref >= hyst:
            total += v - ref; ref = v
        elif ref - v >= hyst:
            ref = v
    return total


def ascent(h):
    return round(_up(h), 1), round(_up([-v for v in h]), 1)


print("\nElevation: route elevation_interval 30 vs height resample 30 (precision 0 and 1), iOS")
print("tag | n route/n height | max |diff| route-height(p1) | max |diff| route-height(p0) | D+ D- route | D+ D- p1 | D+ D- p0")
for t in ["AB", "P3", "R1", "R2", "R3", "R4", "R5"]:
    r = load("ios", f"{t}-route-elev30")["trip"]["legs"]
    el = [v for leg in r for v in leg["elevation"]]
    h0 = load("ios", f"{t}-height-resample30")["height"]
    h1 = load("ios", f"{t}-height-resample30-p1")["height"]
    n = min(len(el), len(h1))
    d1 = max(abs(a - b) for a, b in zip(el, h1))
    d0 = max(abs(a - b) for a, b in zip(el, h0))
    print(t, len(el), len(h1), round(d1, 2), round(d0, 2), ascent(el), ascent(h1), ascent(h0))

print("\nTrace coverage (sum edge.length / route length), walk_or_snap, iOS")
for t in ["AB", "P3", "R1", "R2", "R3", "R4", "R5"]:
    km = sum(l["summary"]["length"] for l in load("ios", f"{t}-route-elev30")["trip"]["legs"])
    e = load("ios", f"{t}-trace-walk_or_snap")["edges"]
    s = sum(x["length"] for x in e)
    print(t, round(km, 3), round(s, 3), round(s / km * 100, 2), "%")

print("\nD+ / D- (seuil 5 m) per platform, from height resample 30: precision 0 | precision 1 ; and from route elevation_interval 30")
for t in ["AB", "P3", "R1", "R2", "R3", "R4", "R5"]:
    cells = []
    for d in ["ios", "android", "mac"]:
        p0 = ascent(load(d, f"{t}-height-resample30")["height"])
        p1 = ascent(load(d, f"{t}-height-resample30-p1")["height"])
        el = ascent([v for leg in load(d, f"{t}-route-elev30")["trip"]["legs"] for v in leg["elevation"]])
        cells.append(f"{d}: p0 {p0} | p1 {p1} | route {el}")
    print(t, " ;; ".join(cells))

print("\nReference of essay 1 on the Mac (own resample 30 m + height): D+ D-  | route elevation_interval | height resample30 p0 | p1  (iOS)")
for t in ["AB", "P3", "R1", "R2", "R3", "R4", "R5"]:
    ref = json.loads((H / f"mac/essai1-{t}.json").read_text())
    el = ascent([v for leg in load("ios", f"{t}-route-elev30")["trip"]["legs"] for v in leg["elevation"]])
    print(t, (round(ref["dplus"], 1), round(ref["dminus"], 1)), el, ascent(load("ios", f"{t}-height-resample30")["height"]),
          ascent(load("ios", f"{t}-height-resample30-p1")["height"]))
