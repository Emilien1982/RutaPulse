#!/usr/bin/env python3
"""Essai 1-bis: measure the quality of the path choice for one combination and one case.

Usage: python3 mesurer-1bis.py <combinaison> <cas> [R1 R2 ...]
       python3 mesurer-1bis.py --reference  (shares of the reference tracks themselves)
       cas: 2km (a point every 2 km, references' "points_2km") or 5pts ("points_de_passage")
       python3 mesurer-1bis.py --liste      (lists the combinations)
       python3 mesurer-1bis.py --tableau    (only rebuilds resultats/1bis/mesures.md)
Writes resultats/1bis/<combinaison>-<cas>/ (R*.json = raw Valhalla responses, ignored by git;
mesures.json = the numbers) and rebuilds resultats/1bis/mesures.md from all the mesures.json.

For each reference: route (valhalla_service, Docker), then trace_attributes on the computed shape.
shape_match is walk_or_snap (documented default: edge_walk, then map_snap). edge_walk alone fails on
every route shape of the package (error 443, tested on R4 whole and cut), so map_snap does the matching;
the coverage (sum of matched edges / route distance) is printed and tabulated to check it.

CLASSIFICATION RULE (three shares of the length, in % of the matched length)
Documentation: https://valhalla.github.io/valhalla/api/map-matching/api-reference/
(trace_attributes: "edge.use", "edge.road_class", "edge.density", "edge.length").
  - piste   : edge.use == "track" (highway=track).
  - sentier : edge.use in PATH_USES (path, footway, mountain_bike, cycleway, ...), i.e. every
              off-road use that is not a road and not a track (cycleway = separate cycle path,
              not a lane on a road), UNLESS the edge lies in a dense area:
              edge.density >= DENSITY_TOWN, then it counts as town.
  - route ou ville : everything else (use road, living_street, service_road, driveway, ...,
              whatever the road_class), and the paths in a dense area.
  edge.density is documented only as "The relative density along the edge". The threshold
  DENSITY_TOWN is set after looking at the real distribution (see mesures.json "par_use_density").
  edge.road_class (motorway ... service_other) is counted per class in mesures.json
  ("par_road_class") but does not change the three shares: a forest road and a town street share
  the same classes, so only edge.use and edge.density separate them.
LAIES RULE (a fourth share, in % of the matched length; it overlaps the three above)
  edge.surface (trace_attributes) is the surface Valhalla derived from OSM: `surface=*` if tagged, else from
  `tracktype` (observed on the package: grade2 -> compacted, grade3 -> dirt) and "compacted" for an untagged path.
  The width of a way is not available in the tiles, so a "laie" (wide, rolling forest track) can only be
  approximated by the surface:
  - laie        : (use track, or use service_road outside dense areas) with surface in
                  paved_smooth, paved, paved_rough, compacted (WIDE_SURFACES).
  - nature path : use path/mountain_bike/bridleway (any surface) or track with surface dirt, gravel, path
                  or unknown. Stored as "nature" in mesures.json, not tabulated.
  Limits: tracktype only says how good the surface is, not how wide or straight the way is; a narrow
  grade2 track counts as a laie, a wide grade4 one does not. The classification is the best available proxy.
TRACK WAYS: in the combinations 5 and 6 the lua gives use=path to the bicycle tracks, so edge.use no longer
  says "track". The edge is then recognised as a track by its OSM way id (travail/track-ways.txt, ids of the
  ways highway=track in the extract, made once with osmium); this is done for every combination, so the
  classification is the same everywhere.
Reference baseline: `--reference` runs trace_attributes (map_snap) on the reference tracks themselves
  with the same rules and writes resultats/1bis/reference/mesures.json.
Tiles: a combination with a "tuiles" key runs on analyse/travail/<tuiles>/ (valhalla_tiles.tar + elevation, made
  by fabriquer-tuiles-1bis.sh) instead of the package.
U-turns: maneuvers of trip.legs[].maneuvers with type 12 (kUturnRight) or 13 (kUturnLeft)
(route API reference, "Maneuver types").
Back-and-forth: diagnostic-denivele.py revisits() (samples every 30 m within 10 m of another
passage of the same track, runs of 3 or more).
Within 25 m: share of the route (10 m steps) within 25 m of the reference (as calibrer.py).
Distance and ascent: as analyser.py (trip.summary.length; ascent 30 m / 5 m with the package).
"""
import importlib.util
import json
import math
import subprocess
import sys
import time

import commun

_s = importlib.util.spec_from_file_location("diag", commun.HERE / "diagnostic-denivele.py")
diag = importlib.util.module_from_spec(_s)
_s.loader.exec_module(diag)
refs = commun.refs

OUT_ROOT = commun.HERE / "resultats" / "1bis"
DENSITY_TOWN = 6  # observed (essai 1, 2km, R1-R5): paths and tracks sit at 0-4 in the forest, cycleways and footways at 5-6 in town
NEAR_M = 25.0
UTURN_TYPES = (12, 13)
TRACK_USES = {"track"}
PATH_USES = {"path", "footway", "mountain_bike", "cycleway", "pedestrian", "bridleway", "steps", "sidewalk"}
WIDE_SURFACES = {"paved_smooth", "paved", "paved_rough", "compacted"}
LAIE_USES = {"track", "service_road"}
TRACK_WAYS_FILE = commun.WORK / "track-ways.txt"
IDS = ["R1", "R2", "R3", "R4", "R5"]

# Combinations. "costing": merged into costing_options.bicycle of requete-type.json
# (bicycle_type mountain, use_roads 0). "type": type of the intermediate points.
# "heading": tolerance in degrees (2km case only: in the 5pts case a user gives no heading,
# so the combination is then identical to the one without heading). "loc": added to each location.
COMBOS = {
    "0-essai1": {"desc": "Réglage de l'essai 1 (mountain, use_roads 0, points through)", "type": "through"},
    "0b-break": {"desc": "Comme l'essai 1 mais intermédiaires break (app de T2), pour chiffrer l'effet de through",
                 "type": "break"},
    "1-cap": {"desc": "Cap de la référence + tolérance 45° à chaque point (sauf l'arrivée)", "type": "through",
              "heading": 45},
    "2-rayon": {"desc": "radius 50 m à chaque point", "type": "through", "loc": {"radius": 50}},
    "3-rayon-libre": {"desc": "radius 50 m et rank_candidates false", "type": "through",
                      "loc": {"radius": 50, "rank_candidates": False}},
    "4-nature": {"desc": "use_living_streets 0 et avoid_bad_surfaces 0", "type": "through",
                 "costing": {"use_living_streets": 0.0, "avoid_bad_surfaces": 0.0}},
    "5-lua-piste": {"desc": "Tuiles: lua où les highway=track ouverts au vélo ont le coût d'un chemin (use path)",
                    "type": "through", "tuiles": "tuiles-5-lua-piste"},
    "6-lua-mtb": {"desc": "Tuiles: comme 5, et chemins/pistes mtb:scale 0-2 ou membres d'une relation route=mtb "
                          "traités comme chemins réservés au vélo", "type": "through", "tuiles": "tuiles-6-lua-mtb"},
}


# ---------- polyline ----------
def encode_polyline6(pts):
    out, plat, plon = [], 0, 0
    for lat, lon in pts:
        la, lo = round(lat * 1e6), round(lon * 1e6)
        for v in (la - plat, lo - plon):
            v = ~(v << 1) if v < 0 else v << 1
            while v >= 0x20:
                out.append(chr((0x20 | (v & 0x1F)) + 63))
                v >>= 5
            out.append(chr(v + 63))
        plat, plon = la, lo
    return "".join(out)


# ---------- request ----------
def bearing(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dl = math.radians(b[1] - a[1])
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def ref_heading(raw, cum, at_m, half=40.0):
    """Heading (degrees from north) of the reference at `at_m` metres, over +-`half` m."""
    a = refs.point_at(raw, cum, max(0.0, at_m - half))
    b = refs.point_at(raw, cum, min(cum[-1], at_m + half))
    return round(bearing(a, b))


def build_request(ref, combo, cas):
    req = commun.route_request(ref, combo.get("costing"))
    pts = ref["points_2km"] if cas == "2km" else ref["points_de_passage"]
    last = len(pts) - 1
    raw = cum = None
    if combo.get("heading") and cas == "2km":
        raw = refs.read_gpx(commun.ESSAI / "zone" / "references" / ref["gpx"])
        cum = refs.cumulative(raw)
    locs = []
    for i, p in enumerate(pts):
        loc = {"lat": p["lat"], "lon": p["lon"], "type": "break" if i in (0, last) else combo["type"]}
        loc.update(combo.get("loc", {}))
        if raw is not None and i != last:
            loc["heading"] = ref_heading(raw, cum, p["km"] * 1000)
            loc["heading_tolerance"] = combo["heading"]
        locs.append(loc)
    req["locations"] = locs
    return req


# ---------- classification ----------
_track_ways = None


def track_ways():
    """Ids of the OSM ways highway=track of the extract (cached in travail/track-ways.txt)."""
    global _track_ways
    if _track_ways is None:
        if not TRACK_WAYS_FILE.exists():
            out = subprocess.run(["osmium", "tags-filter", "-f", "opl", str(commun.ESSAI / "zone/sortie/travail/nancy.osm.pbf"),
                                  "w/highway=track"], capture_output=True, text=True, check=True).stdout
            TRACK_WAYS_FILE.write_text("\n".join(l.split(" ")[0][1:] for l in out.splitlines() if l.startswith("w")))
        _track_ways = set(int(x) for x in TRACK_WAYS_FILE.read_text().split())
    return _track_ways


def use_of(edge):
    """edge.use, but "track" for the ways highway=track whatever the lua made of them."""
    if edge.get("way_id") in track_ways():
        return "track"
    return edge.get("use", "?")


def is_laie(edge):
    use = use_of(edge)
    if use == "track":
        return edge.get("surface") in WIDE_SURFACES
    return use == "service_road" and edge.get("surface") in WIDE_SURFACES and edge.get("density", 0) < DENSITY_TOWN


def is_nature(edge):
    use = use_of(edge)
    if use == "track":
        return edge.get("surface") not in WIDE_SURFACES
    return use in PATH_USES - {"footway", "pedestrian", "steps", "sidewalk", "cycleway"} and edge.get("density", 0) < DENSITY_TOWN


def classify(edge):
    use = use_of(edge)
    if use in TRACK_USES:
        return "piste"
    if use in PATH_USES and edge.get("density", 0) < DENSITY_TOWN:
        return "sentier"
    return "route_ville"


def trace_edges(resp, req):
    pts = commun.shape_of(resp)
    treq = {"encoded_polyline": encode_polyline6(pts), "costing": "bicycle",
            "costing_options": req["costing_options"], "shape_match": "walk_or_snap",
            "filters": {"attributes": ["edge.length", "edge.use", "edge.road_class", "edge.density",
                                       "edge.way_id", "edge.surface"], "action": "include"}}
    return commun.valhalla("trace_attributes", treq)


def shares(trace, route_km):
    edges = trace.get("edges", [])
    tot = sum(e.get("length", 0) for e in edges)
    by = {"route_ville": 0.0, "piste": 0.0, "sentier": 0.0}
    laie = nature = 0.0
    by_class, by_use, by_density = {}, {}, {}
    for e in edges:
        l = e.get("length", 0)
        by[classify(e)] += l
        laie += l if is_laie(e) else 0
        nature += l if is_nature(e) else 0
        by_class[e.get("road_class", "?")] = by_class.get(e.get("road_class", "?"), 0) + l
        by_use[use_of(e)] = by_use.get(use_of(e), 0) + l
        k = "%s|%s" % (use_of(e), e.get("density", "?"))
        by_density[k] = by_density.get(k, 0) + l
    r = lambda d: {k: round(v, 3) for k, v in sorted(d.items())}
    return {
        "matched_km": round(tot, 3), "coverage": tot / route_km if route_km else 0,
        "pct": {k: (v / tot * 100 if tot else 0) for k, v in by.items()},
        "laies": laie / tot * 100 if tot else 0, "nature": nature / tot * 100 if tot else 0,
        "par_road_class": r(by_class), "par_use": r(by_use), "par_use_density": r(by_density),
    }


# ---------- measures ----------
def measure(rid, info, req, resp, trace, ref_track):
    shape = commun.shape_of(resp)
    route = diag.Track(shape)
    near = total = 0.0
    for i in range(1, len(route.pts)):
        step = route.cum[i] - route.cum[i - 1]
        total += step
        if ref_track.project(route.pts[i])[0] <= NEAR_M:
            near += step
    d = resp["trip"]["summary"]["length"]
    up = commun.ascent_of(shape)
    uturns = sum(1 for leg in resp["trip"]["legs"] for m in leg["maneuvers"] if m["type"] in UTURN_TYPES)
    back = diag.revisits(route, diag.sample_30(route))
    sh = shares(trace, d)
    a_ref = info["denivele_positif_calcule_mnt_m"]
    return {
        "id": rid, "points": len(req["locations"]), "d_ref": info["distance_km"], "d": d,
        "g_d": (d - info["distance_km"]) / info["distance_km"] * 100,
        "a_ref": a_ref, "a": up, "g_a": (up - a_ref) / a_ref * 100,
        "near": near / total * 100, "uturns": uturns, "back_km": sum(back) * diag.STEP / 1000,
        "route_ville": sh["pct"]["route_ville"], "piste": sh["pct"]["piste"], "sentier": sh["pct"]["sentier"],
        "laies": sh["laies"], "nature": sh["nature"],
        "coverage": sh["coverage"], "detail": {k: sh[k] for k in ("par_road_class", "par_use", "par_use_density")},
    }


def run(name, cas, only=None):
    combo = COMBOS[name]
    commun.PKG = (commun.WORK / combo["tuiles"]) if combo.get("tuiles") else commun.ESSAI / "zone" / "sortie" / "nancy"
    out = OUT_ROOT / ("%s-%s" % (name, cas))
    out.mkdir(parents=True, exist_ok=True)
    infos = commun.load_references()
    rows = []
    for rid in only or IDS:
        info = infos[rid]
        req = build_request(info, combo, cas)
        t0 = time.time()
        resp = commun.valhalla("route", req)
        if "trip" not in resp:
            print(rid, "ERREUR route", json.dumps(resp)[:300])
            continue
        trace = trace_edges(resp, req)
        if "edges" not in trace:
            print(rid, "ERREUR trace_attributes", json.dumps(trace)[:300])
            continue
        (out / (rid + ".json")).write_text(json.dumps({"request": req, **resp}, ensure_ascii=False))
        (out / (rid + "-trace.json")).write_text(json.dumps(trace, ensure_ascii=False))
        gpx = refs.read_gpx(commun.ESSAI / "zone" / "references" / info["gpx"])
        row = measure(rid, info, req, resp, trace, diag.Track(gpx))
        rows.append(row)
        print("%s %s %s : %.2f km (réf %.2f, %+.1f %%), D+ %.0f, <25 m %.1f %%, route/ville %.1f %%, piste %.1f %%, "
              "sentier %.1f %%, laies %.1f %%, demi-tours %d, allers-retours %.2f km, trace couvre %.1f %% (%.0f s)"
              % (name, cas, rid, row["d"], row["d_ref"], row["g_d"], row["a"], row["near"], row["route_ville"],
                 row["piste"], row["sentier"], row["laies"], row["uturns"], row["back_km"], row["coverage"] * 100, time.time() - t0))
    if only:  # partial run: merge with the previous file
        f = out / "mesures.json"
        old = {r["id"]: r for r in json.loads(f.read_text())["lignes"]} if f.exists() else {}
        old.update({r["id"]: r for r in rows})
        rows = [old[i] for i in IDS if i in old]
    (out / "mesures.json").write_text(json.dumps({"combinaison": name, "cas": cas, "desc": combo["desc"],
                                                   "lignes": rows}, ensure_ascii=False, indent=1))


def run_reference():
    """Shares of the reference tracks themselves (trace_attributes, map_snap, same rules)."""
    commun.PKG = commun.ESSAI / "zone" / "sortie" / "nancy"
    out = OUT_ROOT / "reference"
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    for rid, info in commun.load_references().items():
        raw = refs.read_gpx(commun.ESSAI / "zone" / "references" / info["gpx"])
        pts = diag.sample_30(diag.Track(raw))
        req = {"encoded_polyline": encode_polyline6(pts), "costing": "bicycle", "shape_match": "map_snap",
               "costing_options": {"bicycle": {"bicycle_type": "mountain", "use_roads": 0}},
               "trace_options": {"gps_accuracy": 10, "search_radius": 60},
               "filters": {"attributes": ["edge.length", "edge.use", "edge.road_class", "edge.density",
                                          "edge.way_id", "edge.surface"], "action": "include"}}
        tr = commun.valhalla("trace_attributes", req)
        if "edges" not in tr:
            print(rid, "ERREUR", json.dumps(tr)[:300])
            continue
        (out / (rid + "-trace.json")).write_text(json.dumps(tr, ensure_ascii=False))
        sh = shares(tr, info["distance_km"])
        rows.append({"id": rid, "d_ref": info["distance_km"], "d": info["distance_km"], "route_ville": sh["pct"]["route_ville"],
                     "piste": sh["pct"]["piste"], "sentier": sh["pct"]["sentier"], "laies": sh["laies"], "nature": sh["nature"],
                     "coverage": sh["coverage"], "detail": {k: sh[k] for k in ("par_road_class", "par_use", "par_use_density")}})
        print("référence %s : route/ville %.1f %%, piste %.1f %%, sentier %.1f %%, laies %.1f %%, trace couvre %.1f %% du GPX"
              % (rid, sh["pct"]["route_ville"], sh["pct"]["piste"], sh["pct"]["sentier"], sh["laies"], sh["coverage"] * 100))
    (out / "mesures.json").write_text(json.dumps({"combinaison": "référence", "cas": "-", "desc": "Trace de référence elle-même",
                                                   "lignes": rows}, ensure_ascii=False, indent=1))
    tables()


# ---------- tables ----------
def avg(rows, key):
    return sum(r[key] for r in rows) / len(rows) if rows else float("nan")


def tables():
    allruns = [json.loads(f.read_text()) for f in sorted(OUT_ROOT.glob("*/mesures.json"))]
    ref_run = [r for r in allruns if r["combinaison"] == "référence"]
    runs = [r for r in allruns if r["combinaison"] != "référence"]
    order = {n: i for i, n in enumerate(COMBOS)}
    runs.sort(key=lambda r: (order.get(r["combinaison"], 99), r["cas"]))
    md = ["# Essai 1-bis : mesures du choix des chemins", "",
          "Généré par `mesurer-1bis.py`. Une ligne par combinaison, cas et référence ; moyennes R2 à R5 ; R1 à part "
          "(sa référence, reconstruite d'OSM, a des sauts de plus de 100 m). Règles de classement (route/ville, piste, "
          "sentier, laies) : en tête du script. « Laies » = pistes et routes de service à surface revêtue ou compactée "
          "(approximation par la surface, la largeur n'est pas dans les tuiles) ; ce pourcentage recoupe piste et route/ville.", "",
          "| Combinaison | Cas | Réf. | Dist. (km) | Écart dist. | D+ (m) | Écart D+ | À moins de 25 m | Route/ville | "
          "Piste | Sentier | Laies | Demi-tours | Allers-retours (km) |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]

    def line(n, c, r, x):
        return "| %s | %s | %s | %.2f | %+.1f %% | %.0f | %+.1f %% | %.1f %% | %.1f %% | %.1f %% | %.1f %% | %.1f %% | %s | %.2f |" % (
            n, c, r, x["d"], x["g_d"], x["a"], x["g_a"], x["near"], x["route_ville"], x["piste"], x["sentier"], x["laies"],
            x["uturns"] if isinstance(x["uturns"], int) else "%.2f" % x["uturns"], x["back_km"])

    keys = ("d", "g_d", "a", "g_a", "near", "route_ville", "piste", "sentier", "laies", "uturns", "back_km")
    synth = []
    for run_ in runs:
        n, c, rows = run_["combinaison"], run_["cas"], run_["lignes"]
        sub = [r for r in rows if r["id"] != "R1"]
        for r in rows:
            md.append(line(n, c, r["id"], r))
        if sub:
            md.append(line(n, c, "**moy. R2-R5**", {k: avg(sub, k) for k in keys}))
            synth.append((n, c, sub, rows))
    md += ["", "## Trace de référence elle-même (ligne de base)", "",
           "`trace_attributes` (map_snap) sur la trace GPX de chaque référence, mêmes règles. Couverture = somme des arêtes "
           "rapprochées / distance de la référence.", "",
           "| Réf. | Distance réf. (km) | Route/ville | Piste | Sentier | Laies | Couverture |", "|---|---|---|---|---|---|---|"]
    for run_ in ref_run:
        rs = run_["lignes"]
        for r in rs:
            md.append("| %s | %.2f | %.1f %% | %.1f %% | %.1f %% | %.1f %% | %.1f %% |" % (
                r["id"], r["d_ref"], r["route_ville"], r["piste"], r["sentier"], r["laies"], r["coverage"] * 100))
        sub = [r for r in rs if r["id"] != "R1"]
        if sub:
            md.append("| **moy. R2-R5** | %.2f | %.1f %% | %.1f %% | %.1f %% | %.1f %% | %.1f %% |" % tuple(
                avg(sub, k) * (100 if k == "coverage" else 1) for k in ("d_ref", "route_ville", "piste", "sentier", "laies", "coverage")))
    md += ["", "## Synthèse par combinaison et par cas", "",
           "Moyennes sur R2 à R5. Demi-tours : total R2 à R5 (R1 entre parenthèses). Distance à ± 10 % : nombre de références "
           "sur R2 à R5 (sur 4), R1 entre parenthèses. La première ligne est la référence elle-même.", "",
           "| Combinaison | Cas | Piste + sentier | Route/ville | Laies | Demi-tours | Dist. ± 10 % | À moins de 25 m |",
           "|---|---|---|---|---|---|---|---|"]
    for run_ in ref_run:
        sub = [r for r in run_["lignes"] if r["id"] != "R1"]
        r1 = [r for r in run_["lignes"] if r["id"] == "R1"]
        md.append("| **référence (trace GPX)** | - | %.1f %% | %.1f %% | %.1f %% | - | - | - |" % (
            avg(sub, "piste") + avg(sub, "sentier"), avg(sub, "route_ville"), avg(sub, "laies")))
        if r1:
            md.append("| référence R1 seule | - | %.1f %% | %.1f %% | %.1f %% | - | - | - |" % (
                r1[0]["piste"] + r1[0]["sentier"], r1[0]["route_ville"], r1[0]["laies"]))
    for n, c, sub, rows in synth:
        r1 = [r for r in rows if r["id"] == "R1"]
        r1_u = " (R1 %d)" % r1[0]["uturns"] if r1 else ""
        r1_d = " (R1 %s)" % ("oui" if abs(r1[0]["g_d"]) <= 10 else "non") if r1 else ""
        md.append("| %s | %s | %.1f %% | %.1f %% | %.1f %% | %d%s | %d/%d%s | %.1f %% |" % (
            n, c, avg(sub, "piste") + avg(sub, "sentier"), avg(sub, "route_ville"), avg(sub, "laies"),
            sum(r["uturns"] for r in sub), r1_u, sum(abs(r["g_d"]) <= 10 for r in sub), len(sub), r1_d, avg(sub, "near")))
    cov = [r["coverage"] for x in runs for r in x["lignes"]]
    md += ["", "Part de la longueur de l'itinéraire couverte par `trace_attributes` (somme des arêtes / distance), minimum "
           "sur toutes les lignes d'itinéraire : %.1f %%." % (min(cov or [0]) * 100), ""]
    (OUT_ROOT / "mesures.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("écrit", OUT_ROOT / "mesures.md")


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    if a[0] == "--liste":
        for n, c in COMBOS.items():
            print(n, "-", c["desc"])
        return
    if a[0] == "--tableau":
        return tables()
    if a[0] == "--reference":
        return run_reference()
    if len(a) < 2 or a[0] not in COMBOS or a[1] not in ("2km", "5pts"):
        sys.exit(__doc__)
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    run(a[0], a[1], a[2:] or None)
    tables()


if __name__ == "__main__":
    main()
