"""Part B (phase 8a): write the exact trace_route requests (one point every 20 m, map_snap)
and the Mac answers, for the 4 reference itineraries, in the JSON bundle the throwaway app reads.
Usage: python3 -I b4-requetes.py <trails.geojson>   (Valhalla on localhost:8002)"""
import json, os, sys, re
HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.dirname(HERE)
sys.path.insert(0, A)
from outils import *
src = open(f"{A}/7-forme-allegee.py").read()
ns = {}
exec(re.search(r"def space_every.*?return out\n", src, re.S).group(0), {"hav": hav}, ns)
exec(re.search(r"def read_gpx.*?\n\n\n", src, re.S).group(0).replace("ET.", "__import__('xml.etree.ElementTree').etree.ElementTree."), {}, ns)
g = json.load(open(sys.argv[1]))
ordered = lambda i: [(lat, lon) for lon, lat in next(
    x for x in g["features"] if x["properties"]["osm_id"] == i)["properties"]["ordered"]]
R = f"{A}/resultats"
lines = {"1": shape_of(json.load(open(f"{R}/1-route-reponse.json"))), "2": ordered(11656724),
         "3": ns["read_gpx"](f"{R}/3-gpx-simule.gpx"), "3d": ordered(15712020)}
bundle = {}
for num, pts in lines.items():
    body = {"encoded_polyline": encode6(ns["space_every"](pts)), "shape_match": "map_snap", **COSTING,
            "directions_options": DIRECTIONS}
    json.dump(body, open(f"{HERE}/requetes/b4-{num}-trace_route.json", "w"))
    ta = {"encoded_polyline": body["encoded_polyline"], "shape_match": "map_snap", **COSTING,
          "filters": {"attributes": ["edge.use", "edge.density", "edge.begin_shape_index", "shape"], "action": "include"}}
    json.dump(ta, open(f"{HERE}/requetes/b4-{num}-trace_attributes.json", "w"))
    r, t = call("trace_route", body)
    json.dump(r, open(f"{HERE}/preuves/mac-{num}-trace_route-reponse.json", "w"))
    r2, t2 = call("trace_attributes", ta)
    json.dump(r2, open(f"{HERE}/preuves/mac-{num}-trace_attributes-reponse.json", "w"))
    bundle[num] = {"trace_route": body, "trace_attributes": ta}
    print(num, len(body["encoded_polyline"]), f"{t*1000:.0f} ms", f"{t2*1000:.0f} ms")
json.dump(bundle, open(f"{HERE}/requetes/bundle.json", "w"))
