"""Itinerary 2: balisé circuit of the forêt de Haye (OSM relation 11656724), ordered line
from trails.geojson of the Nancy v6 zone package (ADR 0020), given to trace_route."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outils import *

src = sys.argv[1]  # path to trails.geojson of zone Nancy v6
g = json.load(open(src))
f = next(x for x in g["features"] if x["properties"]["osm_id"] == 11656724)
pts = [(lat, lon) for lon, lat in f["properties"]["ordered"]]
print("circuit:", len(pts), "points", round(length(pts)), "m")
run_trace("2", pts, ("map_snap",))
