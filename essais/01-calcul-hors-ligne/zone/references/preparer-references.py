#!/usr/bin/env python3
"""Prepare the 5 reference itineraries of essay 1.

R1, R2: OSM relations. The ways are read from the local Lorraine extract with
osmium, the longest chain of ways is rebuilt and written as GPX.
R3-R5: GPX downloaded from VisuGPX.

Output: gpx/R*.gpx and references.json (name, source, distance, announced
ascent, computed ascent, 5 waypoints at 0/25/50/75/100 % of the length).

Ascent method (same everywhere): the track is resampled every 30 m, then
the ascent is the sum of the climbs, using a 5 m hysteresis: a reference
altitude moves only when the altitude differs from it by 5 m or more, which
drops the small GPS / DEM noise. Two ascents are given:
  - "gpx": from the altitudes recorded in the GPX (absent for R1, R2);
  - "mnt": from the skadi elevation tiles of the zone, read through
    valhalla_service (action height, Docker). Skipped if the zone is not built.

Usage: python3 preparer-references.py   (no argument, no external package)
"""
import json
import math
import subprocess
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
ZONE = HERE.parent
WORK = ZONE / "sortie" / "travail"
GPX_DIR = HERE / "gpx"
PBF = WORK / "lorraine.osm.pbf"
IMAGE = "ghcr.io/valhalla/valhalla:3.9.1"
UA = "vtt-nav-essai-1/0.1 (test personnel)"
HYST_M = 5.0
STEP_M = 30.0

REFS = [
    {"id": "R1", "kind": "osm", "relation": 11656724,
     "name": "Circuit VTT balisé de la forêt de Haye (Velaine-en-Haye)",
     "source": "https://www.openstreetmap.org/relation/11656724",
     "ascent_announced": None},
    {"id": "R2", "kind": "osm", "relation": 15712020,
     "name": "Petite Suisse Lorraine à VTT",
     "source": "https://www.openstreetmap.org/relation/15712020",
     "distance_announced_km": 35, "ascent_announced": 260},
    {"id": "R3", "kind": "gpx", "name": "Forêt de Haye",
     "source": "https://www.visugpx.com/A7jnmrvO13",
     "url": "https://www.visugpx.com/dl/A7jnmrvO13-foret-de-haye.gpx",
     "distance_announced_km": 25, "ascent_announced": 270},
    {"id": "R4", "kind": "gpx", "name": "Rando VTT Ludres, 13 avril 2014",
     "source": "https://www.visugpx.com/1397404889",
     "url": "https://www.visugpx.com/dl/1397404889-rando-vtt-ludres-13-avril-2014.gpx",
     "ascent_announced": 590},
    {"id": "R5", "kind": "gpx", "name": "La Pompéenne",
     "source": "https://www.visugpx.com/DaKN8WtCIZ",
     "url": "https://www.visugpx.com/dl/DaKN8WtCIZ-la-pompeenne.gpx",
     "distance_announced_km": 44, "ascent_announced": 860},
]


# ---------- geometry ----------
def haversine(a, b):
    """Distance in metres between (lat, lon) points a and b."""
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp = p2 - p1
    dl = math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371008.8 * math.asin(math.sqrt(h))


def length_m(pts):
    return sum(haversine(pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def resample(pts, step=STEP_M):
    """Points (lat, lon, ele|None) every `step` metres along the track."""
    out = [pts[0]]
    carry = 0.0  # distance already walked since the last output point
    for a, b in zip(pts, pts[1:]):
        d = haversine(a, b)
        if d == 0:
            continue
        pos = step - carry
        while pos <= d:
            t = pos / d
            ele = None if a[2] is None or b[2] is None else a[2] + t * (b[2] - a[2])
            out.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), ele))
            pos += step
        carry = d - (pos - step)
    return out


def ascent(elevations, hyst=HYST_M):
    """Sum of climbs with a hysteresis (see module docstring)."""
    ref = elevations[0]
    total = 0.0
    for e in elevations[1:]:
        if e - ref >= hyst:
            total += e - ref
            ref = e
        elif ref - e >= hyst:
            ref = e
    return total


def point_at(pts, cum, target):
    """(lat, lon) at `target` metres along the track (cum = cumulative lengths)."""
    i = 1
    while i < len(cum) - 1 and cum[i] < target:
        i += 1
    seg = cum[i] - cum[i - 1]
    t = 0 if seg == 0 else (target - cum[i - 1]) / seg
    a, b = pts[i - 1], pts[i]
    return round(a[0] + t * (b[0] - a[0]), 6), round(a[1] + t * (b[1] - a[1]), 6)


def cumulative(pts):
    cum = [0.0]
    for i in range(len(pts) - 1):
        cum.append(cum[-1] + haversine(pts[i], pts[i + 1]))
    return cum


def waypoints(pts):
    """5 points at 0, 25, 50, 75, 100 % of the length."""
    cum = cumulative(pts)
    res = []
    for frac in (0, 0.25, 0.5, 0.75, 1):
        lat, lon = point_at(pts, cum, frac * cum[-1])
        res.append({"percent": int(frac * 100), "lat": lat, "lon": lon})
    return res


def points_every(pts, step=2000.0, min_gap=300.0):
    """One point every `step` metres, start and end included.

    A regular point closer than `min_gap` to the end is dropped (no near duplicate).
    """
    cum = cumulative(pts)
    total = cum[-1]
    dists = []
    d = 0.0
    while d < total:
        dists.append(d)
        d += step
    if len(dists) > 1 and total - dists[-1] < min_gap:
        dists.pop()
    dists.append(total)
    res = []
    for d in dists:
        lat, lon = point_at(pts, cum, d)
        res.append({"km": round(d / 1000, 2), "lat": lat, "lon": lon})
    return res


# ---------- GPX ----------
def read_gpx(path):
    root = ET.parse(path).getroot()
    pts = []
    for tag in ("trkpt", "rtept"):
        for el in root.iter():
            if el.tag.split("}")[-1] != tag:
                continue
            ele = None
            for c in el:
                if c.tag.split("}")[-1] == "ele" and c.text:
                    ele = float(c.text)
            pts.append((float(el.get("lat")), float(el.get("lon")), ele))
        if pts:
            break
    return pts


def write_gpx(path, name, pts):
    with open(path, "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<gpx version="1.1" creator="vtt-nav essai 1" xmlns="http://www.topografix.com/GPX/1/1">\n')
        f.write("<trk><name>%s</name><trkseg>\n" % name.replace("&", "&amp;"))
        for lat, lon, _ in pts:
            f.write('<trkpt lat="%.7f" lon="%.7f"/>\n' % (lat, lon))
        f.write("</trkseg></trk>\n</gpx>\n")


# ---------- OSM relations ----------
def load_relation(rel_id):
    """Return (tags, {way_id: [(lat, lon), ...]}) read with osmium."""
    out = WORK / ("relation-%d.osm" % rel_id)
    subprocess.run(["osmium", "getid", "-r", "-t", "--overwrite", "-o", str(out),
                    str(PBF), "r%d" % rel_id], check=True)
    root = ET.parse(out).getroot()
    nodes = {n.get("id"): (float(n.get("lat")), float(n.get("lon"))) for n in root.iter("node")}
    ways = {w.get("id"): w for w in root.iter("way")}
    rel = next(r for r in root.iter("relation") if r.get("id") == str(rel_id))
    tags = {t.get("k"): t.get("v") for t in rel.iter("tag")}
    members = [m.get("ref") for m in rel.iter("member") if m.get("type") == "way"]
    geoms = {}
    missing = []
    for wid in members:
        w = ways.get(wid)
        if w is None:
            missing.append(wid)
            continue
        refs = [nd.get("ref") for nd in w.iter("nd")]
        geoms[wid] = [(r, nodes[r]) for r in refs if r in nodes]
    return tags, members, geoms, missing


def longest_chain(geoms):
    """Longest chain of ways joined end to end (depth-first search with a step cap).

    Returns (list of (way_id, reversed?), length in metres).
    """
    info = {}
    for wid, g in geoms.items():
        if len(g) >= 2:
            info[wid] = (g[0][0], g[-1][0], length_m([p for _, p in g]))
    by_end = {}
    for wid, (a, b, _) in info.items():
        by_end.setdefault(a, []).append((wid, False))
        by_end.setdefault(b, []).append((wid, True))
    best = ([], 0.0)
    steps = [0]

    def dfs(chain, used, end_node, total):
        nonlocal best
        steps[0] += 1
        if total > best[1]:
            best = (list(chain), total)
        if steps[0] > 3_000_000:
            return
        for wid, rev in by_end.get(end_node, []):
            if wid in used:
                continue
            a, b, ln = info[wid]
            used.add(wid)
            chain.append((wid, rev))  # rev: way walked from its last node to its first
            dfs(chain, used, a if rev else b, total + ln)
            chain.pop()
            used.discard(wid)

    for wid, (a, b, ln) in info.items():
        for rev in (False, True):
            steps[0] = 0
            dfs([(wid, rev)], {wid}, a if rev else b, ln)
    return best, info


def components(geoms):
    """Number of groups of ways connected by shared nodes."""
    parent = {w: w for w in geoms}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    owner = {}
    for wid, g in geoms.items():
        for r, _ in g:
            if r in owner:
                parent[find(wid)] = find(owner[r])
            else:
                owner[r] = wid
    groups = {}
    for w in geoms:
        groups.setdefault(find(w), []).append(w)
    return list(groups.values())


def osm_reference(ref):
    tags, members, geoms, missing = load_relation(ref["relation"])
    (chain, chain_len), info = longest_chain(geoms)
    pts = []
    for wid, rev in chain:
        seg = [p for _, p in geoms[wid]]
        if rev:
            seg.reverse()
        pts.extend(seg if not pts else seg[1:])
    used = {w for w, _ in chain}
    unused = sorted({w for w in members if w not in used})
    sum_ways = sum(v[2] for v in info.values())
    comps = components(geoms)
    remarks = [
        "chaîne la plus longue : %.1f km avec %d voies sur %d" % (chain_len / 1000, len(chain), len(members)),
        "somme des longueurs de toutes les voies : %.1f km" % (sum_ways / 1000),
        "composantes connexes (groupes de voies reliées) : %d, voies par groupe : %s"
        % (len(comps), sorted((len(c) for c in comps), reverse=True)),
    ]
    if unused:
        remarks.append("voies non utilisées (%d) : %s" % (len(unused), ", ".join(unused)))
    if missing:
        remarks.append("voies absentes de l'extrait : %s" % ", ".join(missing))
    if len(chain) >= 2 and chain[0] and pts and haversine(pts[0], pts[-1]) < 100:
        remarks.append("la chaîne forme une boucle (fin à moins de 100 m du départ)")
    tags_info = {k: v for k, v in tags.items() if k in ("name", "ref", "distance", "ascent", "descent", "operator", "network")}
    remarks.append("tags de la relation : %s" % json.dumps(tags_info, ensure_ascii=False))
    if tags.get("name"):
        ref["name"] = tags["name"] if ref["id"] == "R1" else ref["name"]
    return [(a, b, None) for a, b in pts], remarks


def gpx_reference(ref):
    GPX_DIR.mkdir(exist_ok=True)
    path = GPX_DIR / (ref["id"] + ".gpx")
    if not path.exists():
        req = urllib.request.Request(ref["url"], headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            path.write_bytes(r.read())
    pts = read_gpx(path)
    remarks = []
    if all(p[2] is None for p in pts):
        remarks.append("le GPX n'a pas d'altitude")
    return pts, remarks


# ---------- altitude from the zone tiles ----------
def dem_heights(pts, chunk=1500):
    """Altitudes of (lat, lon) points through valhalla_service (action height). None if unavailable.

    The request goes in a file read by the container; points are sent by chunks
    to stay under the command-line size limit.
    """
    cfg = WORK / "valhalla.json"
    if not cfg.exists() or not (WORK / "elevation").exists():
        return None
    heights = []
    for i in range(0, len(pts), chunk):
        part = pts[i:i + chunk]
        (WORK / "height-request.json").write_text(
            json.dumps({"shape": [{"lat": p[0], "lon": p[1]} for p in part]}))
        r = subprocess.run(
            ["docker", "run", "--rm", "-v", "%s:/data" % WORK, IMAGE, "sh", "-c",
             "valhalla_service /data/valhalla.json height \"$(cat /data/height-request.json)\""],
            capture_output=True, text=True)
        if r.returncode != 0:
            print("height failed:", r.stderr[-500:], file=sys.stderr)
            return None
        h = None
        for line in reversed(r.stdout.strip().splitlines()):
            if line.strip().startswith("{"):
                h = json.loads(line).get("height")
                break
        if not h or len(h) != len(part) or any(v is None for v in h):
            return None
        heights.extend(h)
    return heights


def main():
    GPX_DIR.mkdir(exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    result = []
    for ref in REFS:
        print("==", ref["id"], ref["name"], flush=True)
        if ref["kind"] == "osm":
            if not PBF.exists():
                sys.exit("missing %s : lancer fabriquer-zone.sh d'abord" % PBF)
            pts, remarks = osm_reference(ref)
            write_gpx(GPX_DIR / (ref["id"] + ".gpx"), ref["name"], pts)
        else:
            pts, remarks = gpx_reference(ref)
        dist_km = length_m([p for p in pts]) / 1000
        rs = resample(pts)
        asc_gpx = None
        if all(p[2] is not None for p in pts):
            asc_gpx = ascent([p[2] for p in resample(pts)])
        heights = dem_heights(rs)
        asc_dem = ascent(heights) if heights else None
        if heights is None:
            remarks.append("dénivelé MNT non calculé (zone non fabriquée ou Docker absent)")
        entry = {
            "id": ref["id"],
            "nom": ref["name"],
            "source": ref["source"],
            "gpx": "gpx/%s.gpx" % ref["id"],
            "distance_km": round(dist_km, 2),
            "distance_annoncee_km": ref.get("distance_announced_km"),
            "denivele_positif_annonce_m": ref["ascent_announced"],
            "denivele_positif_calcule_gpx_m": None if asc_gpx is None else round(asc_gpx),
            "denivele_positif_calcule_mnt_m": None if asc_dem is None else round(asc_dem),
            "methode_denivele": "rééchantillonnage tous les %d m, hystérésis %d m" % (STEP_M, HYST_M),
            "points_de_passage": waypoints(pts),
            "points_2km": points_every(pts),
            "remarques": remarks,
        }
        result.append(entry)
        print(json.dumps({k: entry[k] for k in entry if k not in ("points_de_passage", "points_2km")}, ensure_ascii=False, indent=1))
    (HERE / "references.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("écrit", HERE / "references.json")


if __name__ == "__main__":
    main()
