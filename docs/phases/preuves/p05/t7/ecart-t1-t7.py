"""Explain the D+ gap between the T1 trial and T7 (phase 5), R1 to R5.

T1 computed one route through all points (`through`); the app computes one
leg per pair of points (`break`), as since phase 4. Same points, other path.
Run from docs/phases/preuves/p05/t7/: python3 -I ecart-t1-t7.py
"""
import json


def load(x):
    while isinstance(x, str):
        x = json.loads(x)
    return x


def ascent(heights):
    """Essay 1 method, 5 m threshold (ADR 0017, section 4)."""
    ref, total = heights[0], 0
    for h in heights[1:]:
        if h - ref >= 5:
            total += h - ref
            ref = h
        elif ref - h >= 5:
            ref = h
    return total


def resolved(step):
    r = load(step["response"])
    return load(r.get("resolved", r)) if isinstance(r, dict) else r


for ref in ["R1", "R2", "R3", "R4", "R5"]:
    t1_route = json.load(open(f"../t1-essai/ios/a-{ref}-route-base.json"))
    t1_height = json.load(open(f"../t1-essai/ios/a-{ref}-height-resample30-range.json"))
    t1_km = resolved(t1_route)["trip"]["summary"]["length"]
    t1_points = [(p["lat"], p["lon"]) for p in t1_route["request"]["locations"]]
    t1_heights = [p[1] for p in resolved(t1_height)["range_height"]]

    app = json.load(open(f"references/passage-1/banc-p05/refs-{ref}.json"))
    legs = app["troncons"]
    app_km = sum(leg["route"]["distance_km"] for leg in legs)
    app_points = [(p["lat"], p["lon"]) for p in app["points"]]
    joined = []
    for leg in legs:
        joined += [p[1] for p in resolved(leg["altitudes"]["brut"])["range_height"]]

    print(
        f"{ref}: memes points {t1_points == app_points} | "
        f"T1 {t1_km:.2f} km, {len(t1_heights)} altitudes, D+ {ascent(t1_heights)} | "
        f"app {app_km:.2f} km ({len(legs)} troncons), {len(joined)} altitudes, "
        f"D+ recalcule {ascent(joined)}, D+ app {app['calcul_ts']['d_plus_m']} | "
        f"ecart distance {app_km - t1_km:+.2f} km"
    )
