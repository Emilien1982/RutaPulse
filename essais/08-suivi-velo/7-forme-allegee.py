"""Check M1 of ADR 0021 (phase 8a, T2): the line thinned to one point every 20 m gives the
same directions as the full line, and the recorded answers of trace_route and
trace_attributes (map_snap) are the ones Jest uses.

Usage: python3 -I 7-forme-allegee.py <trails.geojson>   (Valhalla on localhost:8002)
Writes resultats/m1-<n>-trace_route-20m-reponse.json and
resultats/m1-<n>-trace_attributes-20m-reponse.json, prints a report.
"""
import json, os, sys
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outils import *

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = f"{HERE}/resultats"
ATTR = {"attributes": ["edge.use", "edge.density", "edge.begin_shape_index", "shape"],
        "action": "include"}


def space_every(pts, step=20.0):
    """Same rule as spaceEvery() of mobile/src/core/routes/track.ts: first point, a point every
    `step` m of the line (interpolated), last point."""
    out = [pts[0]]
    since = 0.0  # length walked since the last emitted point
    for a, b in zip(pts, pts[1:]):
        seg = hav(a, b)
        pos = 0.0
        while seg > 0 and since + (seg - pos) >= step:
            pos += step - since
            since = 0.0
            f = pos / seg
            out.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))
        since += seg - pos
    if out[-1] != pts[-1]:
        out.append(pts[-1])
    return out


def read_gpx(path):
    return [(float(e.get("lat")), float(e.get("lon")))
            for e in ET.parse(path).getroot().iter() if e.tag.endswith("trkpt")]


g = json.load(open(sys.argv[1]))
ordered = lambda i: [(lat, lon) for lon, lat in next(
    x for x in g["features"] if x["properties"]["osm_id"] == i)["properties"]["ordered"]]
lines = {
    "1": shape_of(json.load(open(f"{OUT}/1-route-reponse.json"))),
    "2": ordered(11656724),
    "3": read_gpx(f"{OUT}/3-gpx-simule.gpx"),
    "3d": ordered(15712020),
}
for num, pts in lines.items():
    thin = space_every(pts)
    full = json.load(open(f"{OUT}/{num}-trace_route-map_snap-reponse.json"))
    body = {"encoded_polyline": encode6(thin), "shape_match": "map_snap", **COSTING,
            "directions_options": DIRECTIONS}
    tr, t1 = call("trace_route", body)
    save(f"{OUT}/m1-{num}-trace_route-20m-reponse.json", tr)
    ta, t2 = call("trace_attributes", {"encoded_polyline": encode6(thin), "shape_match": "map_snap",
                                       **COSTING, "filters": ATTR})
    save(f"{OUT}/m1-{num}-trace_attributes-20m-reponse.json", ta)
    a = [(r["type"], r["instruction"]) for r in directions_of(full)]
    b = [(r["type"], r["instruction"]) for r in directions_of(tr)]
    shape_tr = shape_of(tr)
    shape_ta = decode6(ta["shape"]) if "shape" in ta else None
    print(f"{num}: {len(pts)} pts -> {len(thin)} pts; directions full {len(a)} / 20 m {len(b)}; "
          f"identical: {a == b}; trace_route {t1*1000:.0f} ms, trace_attributes {t2*1000:.0f} ms; "
          f"same matched shape (B6): {shape_ta == shape_tr}")
    if a != b:
        import difflib
        for l in difflib.unified_diff([x[1] for x in a], [x[1] for x in b], "full", "20 m", lineterm="", n=0):
            print("   ", l)
