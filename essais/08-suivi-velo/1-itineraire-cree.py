"""Itinerary 1: route created like the app (waypoints), then trace_route on its shape."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outils import *

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = f"{HERE}/resultats"
# Waypoints in the forêt de Haye / Nancy area (lat, lon); first and last are 'break'.
WP = [(48.7274, 5.9781), (48.7100, 5.9950), (48.6850, 6.0300), (48.6600, 6.0550),
      (48.6950, 6.0600), (48.7150, 6.0200), (48.7274, 5.9781)]
last = len(WP) - 1
req = {"locations": [{"lat": a, "lon": o, "type": "break" if i in (0, last) else "through",
                      "search_cutoff": 200} for i, (a, o) in enumerate(WP)],
       **COSTING, "directions_options": DIRECTIONS}
save(f"{HERE}/requetes/1-route.json", req)
route, t = call("route", req)
if "trip" not in route:
    print("route failed", route); sys.exit(1)
save(f"{OUT}/1-route-reponse.json", route)
shape = shape_of(route)
rows_route = directions_of(route)
write_directions(f"{OUT}/1-directions-route-reference.md",
                 "Itinéraire 1 : directions de `route` (référence, ce que l'app a déjà aujourd'hui)", rows_route)
print(f"route: {t:.2f}s, {len(shape)} points, {length(shape):.0f} m, {len(rows_route)} directions")

run_trace("1", shape, ("map_snap", "edge_walk"))
# Same directions as route? (route is the reference for this itinerary)
tr = json.load(open(f"{OUT}/1-trace_route-map_snap-reponse.json"))
a = [m["instruction"] for m in directions_of(route)]
b = [m["instruction"] for m in directions_of(tr)]
print("same instructions as route:", a == b, len(a), len(b))
