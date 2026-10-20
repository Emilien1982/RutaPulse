#!/usr/bin/env python3
"""Extract route=mtb relations from an OSM extract into a GeoJSON file.

Usage: python3 -I extraire-circuits.py LORRAINE.osm.pbf LON0,LAT0,LON1,LAT1 OUT.geojson [WORKDIR]

Needs the `osmium` command line tool. Only the standard library is used.
Writes the circuits that touch the bbox (at least one node inside it) to
OUT.geojson, and prints a report (counts, one line per circuit) on stdout.
A "part" is a group of ways linked by shared nodes. A circuit with one part
is continuous, otherwise discontinuous.
"""
import json
import math
import re
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

CELL_M = 500.0       # grid cell size for the gap search
MAX_RING = 100       # gap search radius: 100 cells = 50 km


def unescape(s):
    return re.sub(r"%([0-9a-fA-F]+)%", lambda m: chr(int(m.group(1), 16)), s)


def parse_tags(s):
    tags = {}
    if not s:
        return tags
    for kv in s.split(","):
        if "=" in kv:
            k, v = kv.split("=", 1)
            tags[unescape(k)] = unescape(v)
    return tags


def read_opl(path):
    """Return nodes {id: (lon, lat)}, ways {id: [node ids]}, rels {id: (tags, members)}."""
    out = subprocess.run(["osmium", "cat", "-f", "opl", str(path)], check=True,
                         capture_output=True, text=True).stdout
    nodes, ways, rels = {}, {}, {}
    for line in out.splitlines():
        f = line.split(" ")
        kind, oid = f[0][0], int(f[0][1:])
        fields = {x[0]: x[1:] for x in f[1:] if x}
        if kind == "n":
            if "x" in fields and "y" in fields and fields["x"]:
                nodes[oid] = (float(fields["x"]), float(fields["y"]))
        elif kind == "w":
            ways[oid] = [int(n[1:]) for n in fields.get("N", "").split(",") if n]
        elif kind == "r":
            members = []
            for m in fields.get("M", "").split(","):
                if m:
                    t = m[0]
                    ref = m[1:].split("@", 1)[0]
                    members.append((t, int(ref)))
            rels[oid] = (parse_tags(fields.get("T", "")), members)
    return nodes, ways, rels


def dist_m(a, b):
    lat = math.radians((a[1] + b[1]) / 2)
    dx = math.radians(b[0] - a[0]) * math.cos(lat) * 6371008.8
    dy = math.radians(b[1] - a[1]) * 6371008.8
    return math.hypot(dx, dy)


def collect_ways(rid, rels, seen_rels):
    """Way ids of a relation, following sub-relations (each visited once)."""
    if rid in seen_rels or rid not in rels:
        return []
    seen_rels.add(rid)
    result = []
    for t, ref in rels[rid][1]:
        if t == "w":
            result.append(ref)
        elif t == "r":
            result += collect_ways(ref, rels, seen_rels)
    return result


def find_parts(way_ids, ways):
    parent = {w: w for w in way_ids}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    owner = {}
    for w in way_ids:
        for n in ways[w]:
            if n in owner:
                parent[find(w)] = find(owner[n])
            else:
                owner[n] = w
    groups = defaultdict(list)
    for w in way_ids:
        groups[find(w)].append(w)
    return list(groups.values())


def max_gap(parts, ways, nodes):
    """Largest, over parts, of the distance to the nearest other part (metres).

    The search starts from every node that appears in only one way of the part
    (way interiors and free ends: nearly all nodes). It looks at most
    MAX_RING cells (50 km) around. Returns None if a part has no neighbour
    within that radius (gap larger than 50 km).
    """
    if len(parts) < 2:
        return 0.0
    lat0 = next(iter(nodes.values()))[1] if nodes else 48.0
    kx = math.cos(math.radians(lat0)) * 111320.0
    ky = 110574.0

    def cell(p):
        return (int(p[0] * kx // CELL_M), int(p[1] * ky // CELL_M))

    grid = defaultdict(list)
    part_nodes, part_ends = [], []
    for i, p in enumerate(parts):
        count = defaultdict(int)
        for w in p:
            for n in ways[w]:
                count[n] += 1
        ids = [n for n in count if n in nodes]
        ends = [n for n in ids if count[n] == 1] or ids
        part_nodes.append(ids)
        part_ends.append(ends)
        for n in ids:
            grid[cell(nodes[n])].append((n, i))

    gap = [math.inf] * len(parts)
    for i, ends in enumerate(part_ends):
        for e in ends:
            ce = cell(nodes[e])
            best, best_part = math.inf, None
            for r in range(MAX_RING + 1):
                if (r - 1) * CELL_M >= best:
                    break
                for dx in range(-r, r + 1):
                    for dy in range(-r, r + 1):
                        if max(abs(dx), abs(dy)) != r:
                            continue
                        for n, j in grid.get((ce[0] + dx, ce[1] + dy), ()):
                            if j != i:
                                d = dist_m(nodes[e], nodes[n])
                                if d < best:
                                    best, best_part = d, j
            if best_part is not None:
                gap[i] = min(gap[i], best)
                gap[best_part] = min(gap[best_part], best)
    if any(g == math.inf for g in gap):
        return None
    return max(gap)


def analyse(path_pbf, work):
    r_pbf, full_pbf = work / "mtb-relations.osm.pbf", work / "mtb-full.osm.pbf"
    subprocess.run(["osmium", "tags-filter", "-R", "--overwrite", "-o", str(r_pbf),
                    str(path_pbf), "r/route=mtb"], check=True)
    # exit code 1 only means "some members are outside the extract": that is fine
    done = subprocess.run(["osmium", "getid", "-r", "-O", "-o", str(full_pbf),
                           "-I", str(r_pbf), str(path_pbf)])
    if done.returncode not in (0, 1):
        sys.exit("osmium getid failed")
    nodes, ways, rels = read_opl(full_pbf)
    circuits = []
    for rid, (tags, members) in sorted(rels.items()):
        if tags.get("route") != "mtb":
            continue
        way_ids = [w for w in dict.fromkeys(collect_ways(rid, rels, set())) if w in ways]
        way_ids = [w for w in way_ids if len(ways[w]) >= 2]
        if not way_ids:
            continue
        parts = find_parts(way_ids, ways)
        length = sum(dist_m(nodes[a], nodes[b]) for w in way_ids
                     for a, b in zip(ways[w], ways[w][1:]) if a in nodes and b in nodes)
        gap = max_gap(parts, ways, nodes)
        gap = None if gap is None else round(gap)
        circuits.append({
            "id": rid, "tags": tags, "ways": way_ids, "parts": len(parts),
            "length_m": round(length), "max_gap_m": gap,
        })
    sub_ids = {ref for _, (_, ms) in rels.items() for t, ref in ms if t == "r"}
    return circuits, nodes, ways, sub_ids


def in_bbox(c, ways, nodes, bbox):
    lon0, lat0, lon1, lat1 = bbox
    for w in c["ways"]:
        for n in ways[w]:
            p = nodes.get(n)
            if p and lon0 <= p[0] <= lon1 and lat0 <= p[1] <= lat1:
                return True
    return False


def summary(label, cs, sub_ids):
    cont = sum(1 for c in cs if c["parts"] == 1)
    nested = sum(1 for c in cs if c["id"] in sub_ids)
    print(f"{label}: {len(cs)} circuits, {cont} continus, {len(cs) - cont} discontinus, "
          f"{nested} sont aussi sous-relation d'un autre circuit")


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    pbf, bbox_s, out = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
    bbox = tuple(float(x) for x in bbox_s.split(","))
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(sys.argv[4]) if len(sys.argv) > 4 else Path(tmp)
        work.mkdir(parents=True, exist_ok=True)
        circuits, nodes, ways, sub_ids = analyse(pbf, work)
    zone = [c for c in circuits if in_bbox(c, ways, nodes, bbox)]
    features = []
    for c in zone:
        t = c["tags"]
        props = {"osm_id": c["id"]}
        for k in ("name", "ref", "network", "colour"):
            if t.get(k):
                props[k] = t[k]
        props.update(length_m=c["length_m"], parts=c["parts"], max_gap_m=c["max_gap_m"])
        lines = [[[round(nodes[n][0], 6), round(nodes[n][1], 6)] for n in ways[w] if n in nodes]
                 for w in c["ways"]]
        lines = [ln for ln in lines if len(ln) >= 2]
        features.append({"type": "Feature", "properties": props,
                         "geometry": {"type": "MultiLineString", "coordinates": lines}})
    out.write_text(json.dumps({"type": "FeatureCollection", "features": features},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    summary("Zone " + bbox_s, zone, sub_ids)
    summary("Lorraine (information)", circuits, sub_ids)
    big = sum(1 for c in circuits if c["max_gap_m"] is None or c["max_gap_m"] > 100)
    none = sum(1 for c in circuits if c["max_gap_m"] is None)
    print(f"Lorraine : {big} circuits avec un écart max > 100 m (dont {none} sans voisin à moins de 50 km)")
    print("Circuits de la zone (id | nom | longueur m | morceaux | plus grand écart m)")
    for c in zone:
        print(f"{c['id']} | {c['tags'].get('name', c['tags'].get('ref', '-'))} | "
              f"{c['length_m']} | {c['parts']} | {c['max_gap_m']}")


if __name__ == "__main__":
    main()
