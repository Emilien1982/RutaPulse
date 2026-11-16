"""Part B5 (phase 8a): no real MTB GPX is available, so a SIMULATED recording of the marked circuit
15712020 'Petite Suisse Lorraine a VTT' (not the Haye one), 1 point per second at 4 m/s (one point
every 4 m), with a slow GPS error (AR(1), correlation ~33 s). Thinned to one point every 20 m,
sent to trace_route (map_snap), then the share of the track WITHOUT direction is measured.
Usage: python3 -I b5-gpx-simule.py <trails.geojson>   (Valhalla on localhost:8002)"""
import json, math, os, random, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from outils import *
import re
ns = {}
exec(re.search(r"def space_every.*?return out\n", open(f"{HERE}/../7-forme-allegee.py").read(), re.S).group(0), {"hav": hav}, ns)
space_every = ns["space_every"]

g = json.load(open(sys.argv[1]))
f = next(x for x in g["features"] if x["properties"]["osm_id"] == 15712020)
base = [(lat, lon) for lon, lat in f["properties"]["ordered"]]


def at_speed(pts, step=4.0):  # one point per second at 4 m/s
    out, since = [pts[0]], 0.0
    for a, b in zip(pts, pts[1:]):
        seg = hav(a, b); pos = 0.0
        while seg > 0 and since + (seg - pos) >= step:
            pos += step - since; since = 0.0; k = pos / seg
            out.append((a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k))
        since += seg - pos
    return out


def noisy(seed, sigma_axis, rho=0.97):
    random.seed(seed)
    k = sigma_axis * math.sqrt(1 - rho * rho)
    ex = ey = 0.0
    out, errs = [], []
    for lat, lon in at_speed(base):
        ex, ey = rho * ex + random.gauss(0, k), rho * ey + random.gauss(0, k)
        errs.append(math.hypot(ex, ey))
        out.append((lat + ey / 111195, lon + ex / (111195 * math.cos(math.radians(lat)))))
    return out, errs


print("track of reference:", round(length(base)), "m,", len(at_speed(base)), "points at 1 point/s, 4 m/s")
rows = []
for sigma, seeds in ((3.0, (1, 2, 3, 4, 5)), (2.2, (1, 2, 3)), (3.6, (1, 2, 3))):
    for seed in seeds:
        pts, errs = noisy(seed, sigma)
        thin = space_every(pts)
        body = {"encoded_polyline": encode6(thin), "shape_match": "map_snap", **COSTING, "directions_options": DIRECTIONS}
        resp, t = call("trace_route", body)
        if "trip" not in resp:
            print(f"sigma {sigma} seed {seed}: REFUSED {resp}")
            continue
        matched = shape_of(resp)
        c = compare(pts, matched)
        d = [Line(matched).dist(p) for p in pts]
        # length of the track (original points) whose point is > 20 m from the matched path
        cum = [0.0]
        for a, b in zip(pts, pts[1:]):
            cum.append(cum[-1] + hav(a, b))
        far = sum(cum[i + 1] - cum[i] for i in range(len(pts) - 1) if d[i] > 20 and d[i + 1] > 20)
        dirs = directions_of(resp)
        # the end of the matched path along the track
        m_end = max(i for i in range(len(d)) if d[i] <= 20)
        row = dict(sigma_axis=sigma, seed=seed, mean_err_m=round(sum(errs) / len(errs), 1), track_m=round(cum[-1]),
                   thin_points=len(thin), matched_m=c["matched_m"], ratio=c["length_ratio"],
                   far_m=round(far), far_share=round(far / cum[-1], 3), directions=len(dirs),
                   last_point_within_20m_km=round(cum[m_end] / 1000, 2), ms=round(t * 1000), smells=len(smell(dirs)))
        rows.append(row)
        print(row)
        if sigma == 3.0 and seed == 1:
            save(f"{HERE}/preuves/b5-trace_route-reponse-seed1.json", resp)
            write_directions(f"{HERE}/preuves/b5-directions-seed1.md", "B5 (SIMULE) Petite Suisse, bruit 3 m/axe, graine 1", dirs)
            with open(f"{HERE}/preuves/b5-gpx-simule-seed1.gpx", "w") as fh:
                fh.write('<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="essai-08-b5-SIMULE" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Petite Suisse (SIMULE)</name><trkseg>\n')
                fh.write("\n".join(f'<trkpt lat="{a:.6f}" lon="{o:.6f}"/>' for a, o in pts))
                fh.write("\n</trkseg></trk></gpx>\n")
            for i, j, c2 in [(i, 0, 0) for i in ()]: pass
            print("   smells:", smell(dirs))
json.dump(rows, open(f"{HERE}/preuves/b5-mesures.json", "w"), indent=1)
