"""Why does trace_route stop early on circuit 15712020? Try noise levels and trace_options."""
import json, math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outils import *

g = json.load(open(sys.argv[1]))
f = next(x for x in g["features"] if x["properties"]["osm_id"] == 15712020)
base = [(lat, lon) for lon, lat in f["properties"]["ordered"]]


def densify(pts, step):
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        n = max(1, int(hav(a, b) // step))
        out += [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n) for i in range(1, n + 1)]
    return out


def noisy(pts, sigma, seed=8):
    random.seed(seed)
    o = []
    for lat, lon in pts:
        d, a = random.gauss(0, sigma), random.uniform(0, 2 * math.pi)
        o.append((lat + d * math.cos(a) / 111195, lon + d * math.sin(a) / (111195 * math.cos(math.radians(lat)))))
    return o


def drift(pts, sigma=4.0, rho=0.95, seed=8):
    random.seed(seed)
    ex = ey = 0.0
    o = []
    k = sigma * math.sqrt(1 - rho * rho)
    for lat, lon in pts:
        ex, ey = rho * ex + random.gauss(0, k), rho * ey + random.gauss(0, k)
        o.append((lat + ey / 111195, lon + ex / (111195 * math.cos(math.radians(lat)))))
    return o


def go(label, pts, extra=None):
    body = {"encoded_polyline": encode6(pts), "shape_match": "map_snap", **COSTING,
            "directions_options": DIRECTIONS}
    if extra:
        body["trace_options"] = extra
    r, t = call("trace_route", body)
    if "trip" not in r:
        print(f"{label:55s} ERREUR {r.get('error')}")
        return
    legs = r["trip"]["legs"]
    m = round(r["trip"]["summary"]["length"] * 1000)
    print(f"{label:55s} {len(pts):5d} pts, original {round(length(pts)):6d} m -> rendu {m:6d} m "
          f"({m / length(pts):.0%}), legs {len(legs)}, {sum(len(l['maneuvers']) for l in legs)} directions")


go("sans bruit, tel que dans le paquet (1292 pts)", base)
go("sans bruit, tous les 8 m", densify(base, 8))
for s in (2, 4):
    go(f"bruit {s} m, tous les 8 m", noisy(densify(base, 8), s))
go("bruit 4 m, 8 m, trace_options gps_accuracy=10", noisy(densify(base, 8), 4), {"gps_accuracy": 10})
go("bruit 4 m, 8 m, gps_accuracy=10 search_radius=50", noisy(densify(base, 8), 4),
   {"gps_accuracy": 10, "search_radius": 50})
go("bruit 4 m, 8 m, gps_accuracy=20 search_radius=100", noisy(densify(base, 8), 4),
   {"gps_accuracy": 20, "search_radius": 100})
go("bruit 4 m, 8 m, gps_accuracy=10 turn_penalty=0", noisy(densify(base, 8), 4),
   {"gps_accuracy": 10, "turn_penalty_factor": 0})
go("bruit 4 m, tous les 20 m", noisy(densify(base, 20), 4))
go("erreur lente 4 m, tous les 8 m (comme 3-gpx.py)", drift(densify(base, 8)))
go("erreur lente 8 m, tous les 8 m", drift(densify(base, 8), 8))
go("erreur lente 4 m, tous les 3 m", drift(densify(base, 3)))
