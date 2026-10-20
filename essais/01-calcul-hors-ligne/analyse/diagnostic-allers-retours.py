#!/usr/bin/env python3
"""Essai 1-bis: where do the large "back-and-forth" lengths of the 5-points case come from?

Usage: python3 diagnostic-allers-retours.py [combination-case] [R4 R5 ...]   (default 0-essai1-5pts R4 R5)
Reads resultats/1bis/<combination-case>/R*.json (route responses). For each route:
  - the runs flagged by diagnostic-denivele.revisits() (30 m samples within 10 m of another passage, >150 m of
    path away, runs of 3+): position along the route, length, coordinates;
  - the direction of the two passages (bearing difference: ~180 degrees = same way travelled back);
  - the leg (between two points of the request) of each passage, and the distance of the route to the
    intermediate points.
"""
import importlib.util
import json
import math
import sys

import commun

_s = importlib.util.spec_from_file_location("diag", commun.HERE / "diagnostic-denivele.py")
diag = importlib.util.module_from_spec(_s)
_s.loader.exec_module(diag)
refs = commun.refs

name = sys.argv[1] if len(sys.argv) > 1 else "0-essai1-5pts"
ids = sys.argv[2:] or ["R4", "R5"]
for rid in ids:
    resp = json.loads((commun.HERE / "resultats" / "1bis" / name / (rid + ".json")).read_text())
    locs = resp["request"]["locations"]
    route = diag.Track(commun.shape_of(resp))
    s30 = diag.sample_30(route)
    flag = diag.revisits(route, s30)
    # cumulative position (m) of each leg end on the route
    leg_end, acc = [], 0.0
    for leg in resp["trip"]["legs"]:
        acc += leg["summary"]["length"] * 1000
        leg_end.append(acc)
    runs, k = [], 0
    while k < len(flag):
        if flag[k]:
            e = k
            while e < len(flag) and flag[e]:
                e += 1
            runs.append((k, e))
            k = e
        else:
            k += 1
    tot = sum(e - k for k, e in runs) * diag.STEP
    print("== %s %s : %d runs, %.2f km flagged (route %.2f km), %d locations (%s)" % (
        name, rid, len(runs), tot / 1000, route.cum[-1] / 1000, len(locs), ", ".join(l["type"] for l in locs)))
    print("   legs ends (km): " + ", ".join("%.2f" % (x / 1000) for x in leg_end))
    for k, e in runs:
        a, b = s30[k], s30[e - 1]
        L = (e - k) * diag.STEP
        # the other passage: nearest vertex of the route far in path, for the middle sample
        mid = s30[(k + e) // 2]
        x, y = diag.xy(mid)
        c0 = ((k + e) // 2) * diag.STEP
        best = None
        for i, (vx, vy) in enumerate(route.xy):
            if abs(route.cum[i] - c0) > 150:
                d = math.hypot(vx - x, vy - y)
                if best is None or d < best[0]:
                    best = (d, i)
        i2 = best[1]
        c1 = route.cum[i2]
        def brg(c):
            i = route.at(c)
            p, q = route.pts[max(0, i - 3)], route.pts[min(len(route.pts) - 1, i + 3)]
            dy, dx = (q[0] - p[0]) * 110574, (q[1] - p[1]) * 73000
            return (math.degrees(math.atan2(dx, dy)) + 360) % 360
        diff = abs((brg(c0) - brg(c1) + 180) % 360 - 180)
        leg_of = lambda c: next((j for j, le in enumerate(leg_end) if c <= le), len(leg_end) - 1)
        dloc = [min(math.hypot(vx - diag.xy((l["lat"], l["lon"]))[0], vy - diag.xy((l["lat"], l["lon"]))[1])
                    for vx, vy in route.xy[max(0, route.at(c0) - 60):route.at(c0) + 60] or route.xy[:1]) for l in locs]
        print("   %.2f km at route km %.2f (leg %d) and km %.2f (leg %d), (%.5f, %.5f)->(%.5f, %.5f), bearing diff %.0f deg, "
              "nearest request point within 600 m: %s"
              % (L / 1000, c0 / 1000, leg_of(c0) + 1, c1 / 1000, leg_of(c1) + 1, a[0], a[1], b[0], b[1], diff,
                 ",".join("P%d@%.0fm" % (j + 1, d) for j, d in enumerate(dloc) if d < 600) or "none"))

    # request points: straight distances, and distance from the route to each of them, with the route position
    d = lambda p, q: math.hypot(*(a - b for a, b in zip(diag.xy(p), diag.xy(q))))
    P = [(l["lat"], l["lon"]) for l in locs]
    print("   points of the request: " + "; ".join("P%d (%.5f, %.5f) at %d %% of the reference" % (
        j + 1, p[0], p[1], pt["percent"]) for j, (p, pt) in enumerate(zip(P, commun.load_references()[rid]["points_de_passage"]))))
    print("   straight distances (m): P1-P5 %.0f, P2-P4 %.0f, P1-P2 %.0f, P2-P3 %.0f, P3-P4 %.0f"
          % (d(P[0], P[4]), d(P[1], P[3]), d(P[0], P[1]), d(P[1], P[2]), d(P[2], P[3])))
    for j, p in enumerate(P):
        best = min(range(len(route.pts)), key=lambda i: d(route.pts[i], p))
        print("   P%d: route passes at %.0f m, at route km %.2f" % (j + 1, d(route.pts[best], p), route.cum[best] / 1000))
    half = sum(e - k for k, e in runs) * diag.STEP / 2 / 1000
    print("   => retraced length (each pair counted once): %.2f km of %.2f km" % (half, route.cum[-1] / 1000))
