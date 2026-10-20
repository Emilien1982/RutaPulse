#!/usr/bin/env python3
"""Essai 1-bis, diagnostic of R4 near Clairlieu: why are the reference's tracks avoided?

Usage: python3 diagnostic-r4.py [combination-case]   (default 0-essai1-2km; reads resultats/1bis/<it>/R4.json)
Steps: (1) trace_attributes (map_snap) of the REFERENCE track; (2) keep the matched edges lying more than
25 m from the computed route; (3) group them by OSM way id and print use, surface, road_class, bike
attributes; (4) with --tags, print the raw OSM tags of those ways (osmium getid on the extract).
Writes resultats/1bis/diagnostic-r4.json (edges) and prints a table.
"""
import json
import subprocess
import sys

import commun
import importlib.util

_s = importlib.util.spec_from_file_location("diag", commun.HERE / "diagnostic-denivele.py")
diag = importlib.util.module_from_spec(_s)
_s.loader.exec_module(diag)
_m = importlib.util.spec_from_file_location("m1bis", commun.HERE / "mesurer-1bis.py")
m1 = importlib.util.module_from_spec(_m)
_m.loader.exec_module(m1)
refs = commun.refs

name = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else "0-essai1-2km"
info = commun.load_references()["R4"]
raw = refs.read_gpx(commun.ESSAI / "zone" / "references" / info["gpx"])
route = diag.Track(commun.shape_of(json.loads((m1.OUT_ROOT / name / "R4.json").read_text())))
s30 = diag.sample_30(diag.Track(raw))
treq = {"encoded_polyline": m1.encode_polyline6(s30), "costing": "bicycle",
        "costing_options": {"bicycle": {"bicycle_type": "mountain", "use_roads": 0}},
        "shape_match": "map_snap", "trace_options": {"gps_accuracy": 10, "search_radius": 60},
        "filters": {"attributes": ["edge.length", "edge.use", "edge.road_class", "edge.surface", "edge.way_id",
                                   "edge.id", "edge.bicycle_network", "edge.cycle_lane", "edge.sac_scale",
                                   "edge.begin_shape_index", "edge.end_shape_index", "edge.density",
                                   "edge.forward", "edge.speed", "shape", "matched.distance_from_trace_point"],
                    "action": "include"}}
tr = commun.valhalla("trace_attributes", treq)
if "edges" not in tr:
    sys.exit(json.dumps(tr)[:400])
shape = commun.decode_polyline6(tr["shape"])
rows = {}
runs, cur = [], None
tot = far_tot = 0.0
for e in tr["edges"]:
    pts = shape[e["begin_shape_index"]:e["end_shape_index"] + 1]
    mid = pts[len(pts) // 2]
    d = route.project(mid)[0]
    far = d > 25
    L = e["length"] * 1000
    tot += L
    if far:
        far_tot += L
        if cur is None:
            cur = {"a": pts[0], "b": pts[-1], "m": 0.0, "ways": [], "mix": {}, "pts": []}
            runs.append(cur)
        cur["b"] = pts[-1]
        cur["m"] += L
        cur["ways"].append((e.get("way_id"), e.get("use")))
        k = "%s/%s" % (e.get("use"), e.get("surface"))
        cur["mix"][k] = cur["mix"].get(k, 0) + L
        cur["pts"].extend(pts)
    else:
        cur = None
    w = e.get("way_id")
    r = rows.setdefault(w, {"way_id": w, "use": e.get("use"), "surface": e.get("surface"), "road_class": e.get("road_class"),
                             "bicycle_network": e.get("bicycle_network"), "sac_scale": e.get("sac_scale"),
                             "density": e.get("density"), "m_total": 0.0, "m_far": 0.0, "lat": mid[0], "lon": mid[1]})
    r["m_total"] += L
    if far:
        r["m_far"] += L
print("trace de la référence : %.1f km sur %.1f km de GPX, dont %.1f km à plus de 25 m de l'itinéraire calculé"
      % (tot / 1000, info["distance_km"], far_tot / 1000))
far_rows = sorted([r for r in rows.values() if r["m_far"] > 0], key=lambda r: -r["m_far"])
by_use = {}
for r in far_rows:
    k = "%s|%s|%s" % (r["use"], r["surface"], r["road_class"])
    by_use[k] = by_use.get(k, 0) + r["m_far"]
print("Voies de la référence évitées, par use|surface|road_class (m) :")
for k, v in sorted(by_use.items(), key=lambda kv: -kv[1]):
    print("  %-45s %7.0f" % (k, v))
print("Voies (way_id) : plus longues évitées")
for r in far_rows[:25]:
    print("  way %s %-12s surf=%-12s class=%-14s net=%s sac=%s : %.0f m évités / %.0f m (%.5f, %.5f)" % (
        r["way_id"], r["use"], r["surface"], r["road_class"], r["bicycle_network"], r["sac_scale"], r["m_far"], r["m_total"], r["lat"], r["lon"]))
# what the computed route does near the main avoided ways (trace of the route with shapes)
rtr = commun.valhalla("trace_attributes", {**{k: v for k, v in treq.items() if k != "encoded_polyline"},
                                          "encoded_polyline": m1.encode_polyline6(route.pts[::3]),
                                          "trace_options": {"gps_accuracy": 5, "search_radius": 30}})
rsh = commun.decode_polyline6(rtr["shape"])
print("Itinéraire calculé près des 8 plus longues voies évitées (arêtes à moins de 120 m du milieu) :")
import math
for r in far_rows[:8]:
    near = []
    for e in rtr["edges"]:
        pts = rsh[e["begin_shape_index"]:e["end_shape_index"] + 1]
        m = pts[len(pts) // 2]
        d = math.hypot((m[0] - r["lat"]) * 110574, (m[1] - r["lon"]) * 73000)
        if d < 120:
            near.append("%s/%s/%s %dm" % (e["use"], e["surface"], e["road_class"], e["length"] * 1000))
    print("  way %s (%s %s) : %s" % (r["way_id"], r["use"], r["surface"], near or "rien à moins de 120 m"))
(m1.OUT_ROOT / "diagnostic-r4.json").write_text(json.dumps(far_rows, ensure_ascii=False, indent=1))
if "--tags" in sys.argv:
    ids = ["w%s" % r["way_id"] for r in far_rows[:25]]
    out = subprocess.run(["osmium", "getid", "-f", "opl", str(commun.ESSAI / "zone/sortie/travail/nancy.osm.pbf")] + ids,
                         capture_output=True, text=True).stdout
    for l in out.splitlines():
        if l.startswith("w"):
            p = l.split(" ")
            tags = [x for x in p if x.startswith("T")]
            print(p[0], tags[0][1:] if tags else "")

# Local test: route (break to break) between the two ends of each long run of avoided reference edges.
print("Test local : itinéraire direct entre les deux bouts de chaque tronçon évité de plus de 400 m")
refrun = diag.Track(raw)
for r in [r for r in runs if r["m"] >= 400]:
    q = {"locations": [{"lat": r["a"][0], "lon": r["a"][1], "type": "break"}, {"lat": r["b"][0], "lon": r["b"][1], "type": "break"}],
         "costing": "bicycle", "costing_options": {"bicycle": {"bicycle_type": "mountain", "use_roads": 0}}}
    out = commun.valhalla("route", q)
    if "trip" not in out:
        print("  erreur", json.dumps(out)[:200]); continue
    t = diag.Track(commun.shape_of(out))
    near = sum(t.cum[i] - t.cum[i - 1] for i in range(1, len(t.pts)) if refrun.project(t.pts[i])[0] <= 25) / t.cum[-1] * 100
    tt = commun.valhalla("trace_attributes", {"encoded_polyline": m1.encode_polyline6(t.pts[::3]), "costing": "bicycle",
          "costing_options": q["costing_options"], "shape_match": "map_snap", "trace_options": {"gps_accuracy": 5, "search_radius": 30},
          "filters": {"attributes": ["edge.length", "edge.use", "edge.surface"], "action": "include"}})
    dmix = {}
    for e in tt.get("edges", []):
        k = "%s/%s" % (e["use"], e["surface"])
        dmix[k] = dmix.get(k, 0) + e["length"] * 1000
    fm = lambda m: ", ".join("%s %.0f" % kv for kv in sorted(m.items(), key=lambda kv: -kv[1]))
    dpl = lambda pts: commun.ascent_of(pts)
    print("  tronçon réf. %.0f m (%.5f %.5f), D+ réf %.0f m [%s]\n    -> direct %.0f m, D+ %.0f m [%s], %.0f %% à moins de 25 m de la réf."
          % (r["m"], r["a"][0], r["a"][1], dpl(r["pts"]), fm(r["mix"]), t.cum[-1], dpl(commun.shape_of(out)), fm(dmix), near))
