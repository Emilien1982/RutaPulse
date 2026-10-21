"""Marked MTB trails (OSM relations route=mtb) as a GeoJSON file.

osmium only filters the extract and converts it to OPL (osmium's text format).
Everything else is pure Python and testable without osmium.
A "part" is a group of ways linked by shared nodes. A trail with one part is
continuous, otherwise it has gaps.
"""

import json
import math
import re
import subprocess
from collections import defaultdict
from pathlib import Path

CELL_M = 500.0  # grid cell size for the gap search
MAX_RING = 100  # gap search radius: 100 cells = 50 km


def _unescape(s: str) -> str:
    return re.sub(r"%([0-9a-fA-F]+)%", lambda m: chr(int(m.group(1), 16)), s)


def _parse_tags(s: str) -> dict:
    tags = {}
    for kv in s.split(",") if s else []:
        if "=" in kv:
            k, v = kv.split("=", 1)
            tags[_unescape(k)] = _unescape(v)
    return tags


def parse_opl(text: str):
    """Return nodes {id: (lon, lat)}, ways {id: [node ids]}, rels {id: (tags, members)}."""
    nodes, ways, rels = {}, {}, {}
    for line in text.splitlines():
        f = line.split(" ")
        kind, oid = f[0][0], int(f[0][1:])
        fields = {x[0]: x[1:] for x in f[1:] if x}
        if kind == "n":
            if fields.get("x") and fields.get("y"):
                nodes[oid] = (float(fields["x"]), float(fields["y"]))
        elif kind == "w":
            ways[oid] = [int(n[1:]) for n in fields.get("N", "").split(",") if n]
        elif kind == "r":
            members = []
            for m in fields.get("M", "").split(","):
                if m:
                    members.append((m[0], int(m[1:].split("@", 1)[0])))
            rels[oid] = (_parse_tags(fields.get("T", "")), members)
    return nodes, ways, rels


def dist_m(a, b) -> float:
    lat = math.radians((a[1] + b[1]) / 2)
    dx = math.radians(b[0] - a[0]) * math.cos(lat) * 6371008.8
    dy = math.radians(b[1] - a[1]) * 6371008.8
    return math.hypot(dx, dy)


def _collect_ways(rid, rels, seen_rels) -> list[int]:
    """Way ids of a relation, following sub-relations (each visited once)."""
    if rid in seen_rels or rid not in rels:
        return []
    seen_rels.add(rid)
    result = []
    for t, ref in rels[rid][1]:
        if t == "w":
            result.append(ref)
        elif t == "r":
            result += _collect_ways(ref, rels, seen_rels)
    return result


def _find_parts(way_ids, ways) -> list[list[int]]:
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


def _max_gap(parts, ways, nodes):
    """Largest, over parts, of the distance to the nearest other part (metres).

    The search starts from every node that appears in only one way of the part.
    It looks at most MAX_RING cells (50 km) around. Returns None if a part has
    no neighbour within that radius.
    """
    if len(parts) < 2:
        return 0.0
    lat0 = next(iter(nodes.values()))[1] if nodes else 48.0
    kx = math.cos(math.radians(lat0)) * 111320.0
    ky = 110574.0

    def cell(p):
        return (int(p[0] * kx // CELL_M), int(p[1] * ky // CELL_M))

    grid = defaultdict(list)
    part_ends = []
    for i, p in enumerate(parts):
        count = defaultdict(int)
        for w in p:
            for n in ways[w]:
                count[n] += 1
        ids = [n for n in count if n in nodes]
        part_ends.append([n for n in ids if count[n] == 1] or ids)
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


def analyse(nodes, ways, rels) -> list[dict]:
    """One entry per route=mtb relation that has at least one usable way."""
    trails = []
    for rid, (tags, _members) in sorted(rels.items()):
        if tags.get("route") != "mtb":
            continue
        way_ids = [w for w in dict.fromkeys(_collect_ways(rid, rels, set())) if w in ways]
        way_ids = [w for w in way_ids if len(ways[w]) >= 2]
        if not way_ids:
            continue
        parts = _find_parts(way_ids, ways)
        length = sum(
            dist_m(nodes[a], nodes[b]) for w in way_ids for a, b in zip(ways[w], ways[w][1:]) if a in nodes and b in nodes
        )
        gap = _max_gap(parts, ways, nodes)
        trails.append(
            {
                "id": rid,
                "tags": tags,
                "ways": way_ids,
                "parts": len(parts),
                "length_m": round(length),
                "max_gap_m": None if gap is None else round(gap),
            }
        )
    return trails


def _touches_bbox(trail, ways, nodes, bbox) -> bool:
    lon0, lat0, lon1, lat1 = bbox["lonMin"], bbox["latMin"], bbox["lonMax"], bbox["latMax"]
    for w in trail["ways"]:
        for n in ways[w]:
            p = nodes.get(n)
            if p and lon0 <= p[0] <= lon1 and lat0 <= p[1] <= lat1:
                return True
    return False


def build_geojson(nodes, ways, rels, bbox: dict) -> tuple[dict, list[str]]:
    """GeoJSON of the trails that touch the bbox, and a report (French lines)."""
    trails = analyse(nodes, ways, rels)
    in_zone = [t for t in trails if _touches_bbox(t, ways, nodes, bbox)]
    features = []
    for t in in_zone:
        props = {"osm_id": t["id"]}
        for k in ("name", "ref", "network", "colour"):
            if t["tags"].get(k):
                props[k] = t["tags"][k]
        props.update(length_m=t["length_m"], parts=t["parts"], max_gap_m=t["max_gap_m"])
        lines = [[[round(nodes[n][0], 6), round(nodes[n][1], 6)] for n in ways[w] if n in nodes] for w in t["ways"]]
        lines = [ln for ln in lines if len(ln) >= 2]
        features.append(
            {"type": "Feature", "properties": props, "geometry": {"type": "MultiLineString", "coordinates": lines}}
        )
    continuous = sum(1 for t in in_zone if t["parts"] == 1)
    report = [f"{len(in_zone)} circuits balisés dans la zone ({continuous} continus, {len(in_zone) - continuous} avec coupures)"]
    report += [
        f"  {t['id']} | {t['tags'].get('name', t['tags'].get('ref', '-'))} | {t['length_m']} m | "
        f"{t['parts']} morceaux | plus grand écart {t['max_gap_m']} m"
        for t in in_zone
    ]
    return {"type": "FeatureCollection", "features": features}, report


def extract_trails(pbf: Path, bbox: dict, out: Path, work: Path) -> list[str]:
    """Run osmium on the OSM extract, write `out` (GeoJSON), return the report lines."""
    relations, full = work / "mtb-relations.osm.pbf", work / "mtb-full.osm.pbf"
    subprocess.run(
        ["osmium", "tags-filter", "-R", "--overwrite", "-o", str(relations), str(pbf), "r/route=mtb"], check=True
    )
    # exit code 1 only means "some members are outside the extract": that is fine
    done = subprocess.run(["osmium", "getid", "-r", "-O", "-o", str(full), "-I", str(relations), str(pbf)])
    if done.returncode not in (0, 1):
        raise RuntimeError("osmium getid a échoué")
    opl = subprocess.run(["osmium", "cat", "-f", "opl", str(full)], check=True, capture_output=True, text=True).stdout
    geojson, report = build_geojson(*parse_opl(opl), bbox)
    out.write_text(json.dumps(geojson, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return report
