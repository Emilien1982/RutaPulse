"""Copy the useful parts of the recorded answers into the Jest fixtures of
mobile/src/core/tracking/fixtures/ (phase 8a, T2).

Usage: python3 -I 8-fixtures.py <trails.geojson>
Lines are written as polyline with 6 decimals (lossless for these files); the
engine answers keep only the fields the app reads (no texts, no names).
"""
import json, os, sys
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outils import *

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = f"{HERE}/resultats"
DEST = os.path.abspath(f"{HERE}/../../mobile/src/core/tracking/fixtures")
os.makedirs(DEST, exist_ok=True)

g = json.load(open(sys.argv[1]))
ordered = lambda i: [(lat, lon) for lon, lat in next(
    x for x in g["features"] if x["properties"]["osm_id"] == i)["properties"]["ordered"]]
gpx = [(float(e.get("lat")), float(e.get("lon")))
       for e in ET.parse(f"{OUT}/3-gpx-simule.gpx").getroot().iter() if e.tag.endswith("trkpt")]
lines = {"1": shape_of(json.load(open(f"{OUT}/1-route-reponse.json"))),
         "2": ordered(11656724), "3": gpx, "3d": ordered(15712020)}


def dump(name, obj):
    with open(f"{DEST}/{name}", "w") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


for num, pts in lines.items():
    dump(f"line-{num}.json", {"polyline6": encode6(pts), "points": len(pts)})
    tr = json.load(open(f"{OUT}/m1-{num}-trace_route-20m-reponse.json"))
    legs = []
    for leg in tr["trip"]["legs"]:
        legs.append({"shape": leg["shape"], "maneuvers": [
            {k: m[k] for k in ("type", "begin_shape_index", "end_shape_index", "length",
                               "roundabout_exit_count") if k in m} for m in leg["maneuvers"]]})
    dump(f"trace-route-{num}.json", {"trip": {"status": 0, "legs": legs}})
    ta = json.load(open(f"{OUT}/m1-{num}-trace_attributes-20m-reponse.json"))
    dump(f"trace-attributes-{num}.json", {
        "shape": ta["shape"],
        "edges": [{k: e[k] for k in ("use", "density", "begin_shape_index") if k in e}
                  for e in ta["edges"]]})
print("done", sorted(os.listdir(DEST)))
