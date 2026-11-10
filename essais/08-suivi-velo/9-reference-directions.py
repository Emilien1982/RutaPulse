"""Reference lists of directions for the Jest test of phase 8a (T2, criterion C2).

Written from the recorded answers of the engine (resultats/m1-*) with a short, independent
Python version of the rules of ADR 0021 (sections 1.3 and 1.4): the type table, the kind of
way, the U-turn rule, the 20 m rule, the stretch the engine did not match. The texts are those
of mock-up 30. It does not use any code of the app.

Usage: python3 -I 9-reference-directions.py   (after 8-fixtures.py; no Valhalla needed)
Writes mobile/src/core/tracking/fixtures/reference-<n>.json.
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outils import *

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = f"{HERE}/resultats"
DEST = os.path.abspath(f"{HERE}/../../mobile/src/core/tracking/fixtures")

GESTURE = {
    9: "Légèrement à droite", 18: "Légèrement à droite", 20: "Légèrement à droite", 37: "Légèrement à droite",
    16: "Légèrement à gauche", 19: "Légèrement à gauche", 21: "Légèrement à gauche", 38: "Légèrement à gauche",
    10: "Tournez à droite", 15: "Tournez à gauche",
    11: "Virage serré à droite", 14: "Virage serré à gauche",
    23: "À la fourche, à droite", 24: "À la fourche, à gauche",
    22: "Continuez tout droit", 12: "Faites demi-tour", 13: "Faites demi-tour",
}
TRAIL_USES = {"path", "footway", "mountain_bike", "cycleway", "pedestrian", "bridleway", "steps", "sidewalk"}
WAY = {"trail": "sur le sentier", "track": "sur la piste", "road": "sur la route"}


def way_of(edge):
    if edge.get("use") == "track":
        return "track"
    if edge.get("use") in TRAIL_USES and edge.get("density", 0) < 6:
        return "trail"
    return "road"


def cumulative(pts):
    cum = [0.0]
    for a, b in zip(pts, pts[1:]):
        cum.append(cum[-1] + hav(a, b))
    return cum


def along(pts, cum, p, lo=0.0, hi=1e18):
    """Distance along the line of the closest point, on the segments between lo and hi (m)."""
    best = (1e18, 0.0)
    k = math.cos(math.radians(p[0])) * math.pi / 180 * R
    m = math.pi / 180 * R
    for i in range(len(pts) - 1):
        if cum[i + 1] < lo or cum[i] > hi:
            continue
        a, b = pts[i], pts[i + 1]
        ax, ay = (a[1] - p[1]) * k, (a[0] - p[0]) * m
        bx, by = (b[1] - p[1]) * k, (b[0] - p[0]) * m
        dx, dy = bx - ax, by - ay
        L = dx * dx + dy * dy
        t = 0 if L == 0 else max(0, min(1, -(ax * dx + ay * dy) / L))
        d = math.hypot(ax + t * dx, ay + t * dy)
        if d < best[0]:
            best = (d, cum[i] + t * (cum[i + 1] - cum[i]))
    return best[1], best[0]


def point_at(pts, cum, d):
    d = max(0.0, min(d, cum[-1]))
    i = 0
    while i < len(pts) - 2 and cum[i + 1] < d:
        i += 1
    seg = cum[i + 1] - cum[i]
    f = (d - cum[i]) / seg if seg else 0
    return (pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f)


def bearing(a, b):
    dx = (b[1] - a[1]) * math.cos(math.radians((a[0] + b[0]) / 2))
    return (math.degrees(math.atan2(dx, b[0] - a[0])) + 360) % 360


def turn_diff(a, b):
    d = abs(a - b) % 360
    return 360 - d if d > 180 else d


def to_latlon(line_json):
    return decode6(line_json["polyline6"])


for num in ("1", "2", "3", "3d"):
    pts = to_latlon(json.load(open(f"{DEST}/line-{num}.json")))
    cum = cumulative(pts)
    tr = json.load(open(f"{OUT}/m1-{num}-trace_route-20m-reponse.json"))
    ta = json.load(open(f"{OUT}/m1-{num}-trace_attributes-20m-reponse.json"))
    matched = shape_of(tr)
    mline = Line(matched)
    pline = Line(pts)
    # stretch of our line that the engine did not match (> 20 m for more than 100 m)
    free, run, n = [], None, int(cum[-1] // 10)
    for k in range(n + 2):
        d = min(k * 10.0, cum[-1])
        far = mline.dist(point_at(pts, cum, d)) > 20
        if far and run is None:
            run = [d, d]
        elif far:
            run[1] = d
        if (not far or d >= cum[-1]) and run is not None:
            if run[1] - run[0] > 100:
                free.append({"fromM": round(run[0]), "toM": round(cum[-1] if far else d), "reason": "noMatch"})
            run = None
        if d >= cum[-1]:
            break
    # kind of way: the indices agree on the start both shapes share
    ta_shape = decode6(ta["shape"])
    k = 0
    while k < min(len(ta_shape), len(matched)) and ta_shape[k] == matched[k]:
        k += 1
    ways = {}
    for e in ta["edges"]:
        if e["begin_shape_index"] < k:
            ways[e["begin_shape_index"]] = way_of(e)
    mcum = cumulative(matched)
    directions = []
    # the maneuvers are placed in order, each one near the one before (a route can come back
    # to where it started): from 50 m before the last place, to a little more than the length
    # the engine gives between the two
    last_at, last_matched = 0.0, 0.0
    for m in tr["trip"]["legs"][0]["maneuvers"]:
        text = GESTURE.get(m["type"])
        if m["type"] == 26:
            n_exit = m.get("roundabout_exit_count", 1)
            text = "Au rond-point, 1re sortie" if n_exit == 1 else f"Au rond-point, {n_exit}e sortie"
        if text is None:
            continue
        p = matched[m["begin_shape_index"]]
        step = max(0.0, mcum[m["begin_shape_index"]] - last_matched)
        at, gap = along(pts, cum, p, last_at - 50, last_at + 1.5 * step + 500)
        if gap <= 20:
            last_at, last_matched = at, mcum[m["begin_shape_index"]]
        if gap > 20 or any(f["fromM"] < at < f["toM"] for f in free):
            continue
        if m["type"] in (12, 13):
            if turn_diff(bearing(point_at(pts, cum, at - 20), point_at(pts, cum, at)),
                         bearing(point_at(pts, cum, at), point_at(pts, cum, at + 20))) <= 150:
                continue
        elif m["type"] != 26 and m["begin_shape_index"] in ways:
            text += " " + WAY[ways[m["begin_shape_index"]]]
        directions.append({"atM": round(at), "text": text})
    for f in free:
        directions.append({"atM": f["fromM"], "text": "Suivez le tracé"})
    directions.sort(key=lambda x: x["atM"])
    directions.append({"atM": round(cum[-1]), "text": "Arrivée"})
    json.dump({"free": free, "directions": directions}, open(f"{DEST}/reference-{num}.json", "w"),
              ensure_ascii=False, indent=1)
    print(num, "line", round(cum[-1]), "m;", len(directions), "directions; free", free)
