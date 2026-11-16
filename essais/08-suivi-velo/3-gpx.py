"""Itinerary 3: a GPX. The repo has no long real GPX (only 3-4 point test files), so this
script (a) builds a GPX that looks like a phone recording: circuit 15712020 (Petite Suisse
Lorraine, 35 km) cut every ~8 m with a slowly drifting GPS error of 4 m (seed fixed), then reads it back as
a GPX; (b) also tries the repo's test file strava.gpx (3 points); (c) tests the point limit."""
import json, math, os, random, sys
import xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outils import *

HERE = os.path.dirname(os.path.abspath(__file__))
src, repo_gpx = sys.argv[1], sys.argv[2]


def read_gpx(path):
    return [(float(e.get("lat")), float(e.get("lon")))
            for e in ET.parse(path).getroot().iter() if e.tag.endswith("trkpt")]


def densify(pts, step):
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        n = max(1, int(hav(a, b) // step))
        for i in range(1, n + 1):
            out.append((a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n))
    return out


g = json.load(open(src))
f = next(x for x in g["features"] if x["properties"]["osm_id"] == 15712020)
base = [(lat, lon) for lon, lat in f["properties"]["ordered"]]
random.seed(8)
# GPS error that drifts slowly (each point close to the previous error), about 4 m
rho, sigma = 0.95, 4.0
ex = ey = 0.0
noisy = []
for lat, lon in densify(base, 8):
    k = sigma * math.sqrt(1 - rho * rho)
    ex, ey = rho * ex + random.gauss(0, k), rho * ey + random.gauss(0, k)
    noisy.append((lat + ey / 111195, lon + ex / (111195 * math.cos(math.radians(lat)))))
gpx = ['<?xml version="1.0" encoding="UTF-8"?>',
       '<gpx version="1.1" creator="essai-08" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Petite Suisse (simule)</name><trkseg>']
gpx += [f'<trkpt lat="{a:.6f}" lon="{o:.6f}"/>' for a, o in noisy]
gpx += ["</trkseg></trk></gpx>"]
path = f"{HERE}/resultats/3-gpx-simule.gpx"
open(path, "w").write("\n".join(gpx))
pts = read_gpx(path)
print("gpx simule:", len(pts), "points", round(length(pts)), "m; reference", round(length(base)), "m")
run_trace("3", pts, ("map_snap",))

# the real (tiny) test file of the repo
tiny = read_gpx(repo_gpx)
print("strava.gpx:", len(tiny), "points")
run_trace("3b", tiny, ("map_snap",))

# point limit: 17 000 points (limit max_shape = 16 000)
big = densify(base, 2.0)
print("limite:", len(big), "points")
resp, t = call("trace_route", {"encoded_polyline": encode6(big), "shape_match": "map_snap", **COSTING,
                               "directions_options": DIRECTIONS})
save(f"{HERE}/resultats/3c-limite-points-reponse.json",
     {"points": len(big), "seconds": round(t, 2), "error": resp.get("error"), "has_trip": "trip" in resp})
print("limite:", resp.get("error"), "trip" in resp, round(t, 2))
