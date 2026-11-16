"""Same circuit 15712020 without noise (as in the zone package): directions, then compare
with the noisy GPX answer of 3-gpx.py to see which directions are caused by the noise."""
import json, os, sys, difflib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outils import *

HERE = os.path.dirname(os.path.abspath(__file__))
g = json.load(open(sys.argv[1]))
f = next(x for x in g["features"] if x["properties"]["osm_id"] == 15712020)
base = [(lat, lon) for lon, lat in f["properties"]["ordered"]]
s = run_trace("3d", base, ("map_snap",))
a = [(r["instruction"], round(r["length_km"] * 1000)) for r in directions_of(json.load(open(f"{HERE}/resultats/3d-trace_route-map_snap-reponse.json")))]
b = [(r["instruction"], round(r["length_km"] * 1000)) for r in directions_of(json.load(open(f"{HERE}/resultats/3-trace_route-map_snap-reponse.json")))]
ai = [x[0] for x in a]; bi = [x[0] for x in b]
print("noiseless:", len(a), "directions; noisy GPX:", len(b))
for l in difflib.unified_diff(ai, bi, "sans bruit", "GPX bruité", lineterm="", n=0):
    print(l)
