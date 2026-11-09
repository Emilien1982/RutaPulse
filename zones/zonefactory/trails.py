"""Marked MTB trails (OSM relations route=mtb) as a GeoJSON file.

osmium only filters the extract and converts it to OPL (osmium's text format).
Everything else is pure Python and testable without osmium.
A "part" is a group of ways linked by shared nodes. A trail with one part is
continuous, otherwise it has gaps.
A continuous trail also gets an ordered line (ADR 0020, section 2): the main
trunk, in the direction of the OSM relation, without short side branches.
"""

import json
import math
import re
import subprocess
from collections import defaultdict
from pathlib import Path

CELL_M = 500.0  # grid cell size for the gap search
MAX_RING = 100  # gap search radius: 100 cells = 50 km
MAX_ANNEX_M = 500.0  # a dead end or a small loop shorter than this is an annex, removed
MAX_REMOVED_SHARE = 0.15  # more removed than this share of length_m: the trail is refused
DROPPED_ROLES = {"alternative", "excursion", "approach", "connection"}  # member roles that are not the trunk
VALHALLA_RADIUS_M = 6378160.0  # sphere of Valhalla, as `trackLengthM` in the app


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
    """Return nodes {id: (lon, lat)}, ways {id: [node ids]}, rels {id: (tags, [(type, id, role)])}."""
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
                    ref, _, role = m[1:].partition("@")
                    members.append((m[0], int(ref), _unescape(role)))
            rels[oid] = (_parse_tags(fields.get("T", "")), members)
    return nodes, ways, rels


def dist_m(a, b) -> float:
    lat = math.radians((a[1] + b[1]) / 2)
    dx = math.radians(b[0] - a[0]) * math.cos(lat) * 6371008.8
    dy = math.radians(b[1] - a[1]) * 6371008.8
    return math.hypot(dx, dy)


def _collect_ways(rid, rels, seen_rels, dropped=False) -> list[tuple[int, str, bool]]:
    """(way id, role, dropped) of a relation, following sub-relations (each visited once).

    `dropped` is true for a way whose role, or the role of a sub-relation above it, is in DROPPED_ROLES.
    """
    if rid in seen_rels or rid not in rels:
        return []
    seen_rels.add(rid)
    result = []
    for t, ref, role in rels[rid][1]:
        out = dropped or role in DROPPED_ROLES
        if t == "w":
            result.append((ref, role, out))
        elif t == "r":
            result += _collect_ways(ref, rels, seen_rels, out)
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


def valhalla_length_m(line) -> float:
    """Length of a [lon, lat] line on the sphere of Valhalla (same formula as `trackLengthM` in the app)."""
    rad = math.pi / 180
    total = 0.0
    for (lon1, lat1), (lon2, lat2) in zip(line, line[1:]):
        h = math.sin((lat2 - lat1) * rad / 2) ** 2 + math.cos(lat1 * rad) * math.cos(lat2 * rad) * math.sin(
            (lon2 - lon1) * rad / 2
        ) ** 2
        total += 2 * VALHALLA_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))
    return total


def _seq_len(seq, nodes) -> float:
    return sum(dist_m(nodes[a], nodes[b]) for a, b in zip(seq, seq[1:]))


def _cut_pieces(way_ids, ways, nodes) -> list[tuple[int, list[int]]]:
    """Cut every way at its middle nodes that another way also uses. Pieces keep the order of the relation."""
    seqs = {w: [n for n in ways[w] if n in nodes] for w in way_ids}
    seqs = {w: s for w, s in seqs.items() if len(s) >= 2}
    users = defaultdict(set)
    for w, s in seqs.items():
        for n in s:
            users[n].add(w)
    pieces = []
    for w, s in seqs.items():
        start = 0
        for j in range(1, len(s) - 1):
            if len(users[s[j]]) > 1:
                pieces.append((w, s[start : j + 1]))
                start = j
        pieces.append((w, s[start:]))
    return pieces


def _chains(pieces, active, nodes):
    """Chains of pieces between junctions or free ends. Return (chains, degree of every node)."""
    at = defaultdict(list)  # node -> one entry per piece end
    for i in sorted(active):
        at[pieces[i][1][0]].append(i)
        at[pieces[i][1][-1]].append(i)
    deg = {n: len(v) for n, v in at.items()}
    special = sorted(n for n, d in deg.items() if d != 2)
    done, chains = set(), []
    for n in special:
        for i in at[n]:
            if i in done:
                continue
            cur, p, chain = n, i, []
            while True:
                done.add(p)
                chain.append(p)
                a, b = pieces[p][1][0], pieces[p][1][-1]
                nxt = b if a == cur else a
                if deg[nxt] != 2:
                    break
                cur, p = nxt, next(q for q in at[nxt] if q != p)
            length = sum(_seq_len(pieces[q][1], nodes) for q in chain)
            chains.append({"from": n, "to": nxt, "pieces": chain, "len": length})
    return chains, deg


def _connected(pieces, active) -> bool:
    parent = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for i in active:
        parent[find(pieces[i][1][0])] = find(pieces[i][1][-1])
    return len({find(x) for x in list(parent)}) <= 1


def _walk(pieces, active, start_piece, forward):
    """Follow the pieces from one end (path) or round the loop. Return [(piece, reversed)]."""
    at = defaultdict(list)
    for i in active:
        at[pieces[i][1][0]].append(i)
        at[pieces[i][1][-1]].append(i)
    p, rev = start_piece, not forward
    seq = []
    while True:
        seq.append((p, rev))
        s = pieces[p][1]
        node = s[0] if rev else s[-1]
        nxt = [q for q in at[node] if q != p]
        if not nxt or nxt[0] == start_piece:
            return seq
        p = nxt[0]
        rev = pieces[p][1][-1] == node and pieces[p][1][0] != node


def _order_pieces(pieces, active, deg):
    """Sequence [(piece, reversed)] in the direction of the relation, and whether it is a loop."""
    first = min(active)
    others = sorted(active - {first})
    second = others[0] if others else None
    ones = sorted(n for n, d in deg.items() if d == 1)
    if second is None and ones:  # a single way: its OSM direction
        return [(first, False)], False
    if not ones:  # simple loop: starts at the beginning of the first piece, turned towards the second
        forward = True
        if second is not None:
            a, b = pieces[first][1][0], pieces[first][1][-1]
            ends2 = {pieces[second][1][0], pieces[second][1][-1]}
            forward = b in ends2 or a not in ends2
        return _walk(pieces, active, first, forward), True
    at = defaultdict(list)
    for i in active:
        at[pieces[i][1][0]].append(i)
        at[pieces[i][1][-1]].append(i)
    start = at[ones[0]][0]
    seq = _walk(pieces, active, start, pieces[start][1][0] == ones[0])
    if second is not None:
        order = [p for p, _ in seq]
        if order.index(first) > order.index(second):
            seq = [(p, not r) for p, r in reversed(seq)]
    return seq, False


def _ways_text(n: int) -> str:
    return f"{n} voie" + ("s" if n > 1 else "")


def order_trail(way_ids, dropped, roles, ways, nodes, length_m, parts) -> dict:
    """Ordered line of a trail (ADR 0020, section 2). `way_ids` are all the ways, `dropped` the ones whose role removes them.

    Return {ordered, loop, ordered_m, removed_m, refusal, notes}; `notes` are report lines (French).
    """
    refused = {"ordered": None, "loop": None, "ordered_m": None, "removed_m": None}

    def refuse(reason, note):
        return {**refused, "refusal": reason, "notes": [f"REFUS ({reason}) : {note}"]}

    if parts > 1:
        return refuse("parts", f"{parts} morceaux")
    kept = [w for w in way_ids if w not in dropped]
    notes, removed_total = [], 0.0
    role_dropped = [w for w in way_ids if w in dropped and len(ways[w]) >= 2]
    if role_dropped:
        removed_total += sum(_seq_len([n for n in ways[w] if n in nodes], nodes) for w in role_dropped)
        notes.append(f"retiré : rôle écarté, {_ways_text(len(role_dropped))}, {removed_total:.0f} m")
    pieces = _cut_pieces(kept, ways, nodes)
    active = set(range(len(pieces)))
    while active:
        chains, deg = _chains(pieces, active, nodes)
        gone = []  # (chain, reason)
        for c in chains:
            ends = sorted((deg[c["from"]], deg[c["to"]]))
            if c["from"] == c["to"] and c["len"] < MAX_ANNEX_M and deg[c["from"]] >= 3:
                gone.append((c, "petite boucle"))
            elif c["len"] < MAX_ANNEX_M and ends[0] == 1 and ends[1] >= 3:
                gone.append((c, "impasse"))
        if not gone:  # variants only when this pass removed no annex: an annex can hide a loop
            groups = defaultdict(list)
            for c in chains:
                if c["from"] != c["to"]:
                    groups[frozenset((c["from"], c["to"]))].append(c)
            for group in groups.values():
                group.sort(key=lambda c: min(c["pieces"]))
                # parallel chains that are the whole remaining graph make the loop: keep the first two
                keep = 2 if len(group) == len(chains) else 1
                gone += [(c, "variante") for c in group[keep:]]
        if not gone:
            break
        for c, reason in gone:
            active -= set(c["pieces"])
            removed_total += c["len"]
            notes.append(f"retiré : {reason}, {_ways_text(len(c['pieces']))}, {c['len']:.0f} m")
    if not active:
        return refuse("branches", "plus aucune voie après les retraits")
    if not _connected(pieces, active):
        return refuse("parts", "plusieurs morceaux après les retraits")
    _, deg = _chains(pieces, active, nodes)
    free_ends = sum(1 for d in deg.values() if d == 1)
    if any(d > 2 for d in deg.values()) or free_ends not in (0, 2):
        junctions = sum(1 for d in deg.values() if d > 2)
        return refuse("branches", f"ni chemin ni boucle après les retraits ({junctions} jonctions, {free_ends} bouts libres)")
    if length_m and removed_total > MAX_REMOVED_SHARE * length_m:
        return refuse("removedTooMuch", f"{removed_total:.0f} m retirés sur {length_m:.0f} m")
    seq, loop = _order_pieces(pieces, active, deg)
    line = []
    for p, rev in seq:
        s = pieces[p][1][::-1] if rev else pieces[p][1]
        role = roles.get(pieces[p][0])
        if (role == "forward" and rev) or (role == "backward" and not rev):
            notes.append(f"ALERTE : voie {pieces[p][0]} de rôle {role} parcourue à l'envers")
        for n in s:
            pt = [round(nodes[n][0], 6), round(nodes[n][1], 6)]
            if not line or line[-1] != pt:
                line.append(pt)
    return {
        "ordered": line,
        "loop": loop,
        "ordered_m": round(valhalla_length_m(line)),
        "removed_m": round(removed_total),
        "refusal": None,
        "notes": notes,
    }


def analyse(nodes, ways, rels) -> list[dict]:
    """One entry per route=mtb relation that has at least one usable way."""
    trails = []
    for rid, (tags, _members) in sorted(rels.items()):
        if tags.get("route") != "mtb":
            continue
        listed = {}  # way id -> [role, dropped]; a way is dropped only if every mention is dropped
        for w, role, dropped in _collect_ways(rid, rels, set()):
            if w in listed:
                listed[w][1] = listed[w][1] and dropped
            else:
                listed[w] = [role, dropped]
        way_ids = [w for w in listed if w in ways and len(ways[w]) >= 2]
        if not way_ids:
            continue
        parts = _find_parts(way_ids, ways)
        length = sum(
            dist_m(nodes[a], nodes[b]) for w in way_ids for a, b in zip(ways[w], ways[w][1:]) if a in nodes and b in nodes
        )
        gap = _max_gap(parts, ways, nodes)
        order = order_trail(
            way_ids,
            {w for w in way_ids if listed[w][1]},
            {w: listed[w][0] for w in way_ids},
            ways,
            nodes,
            length,
            len(parts),
        )
        trails.append(
            {
                "id": rid,
                "tags": tags,
                "ways": way_ids,
                "parts": len(parts),
                "length_m": round(length),
                "max_gap_m": None if gap is None else round(gap),
                "order": order,
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
        props.update({k: t["order"][k] for k in ("ordered", "loop", "ordered_m", "removed_m", "refusal")})
        lines = [[[round(nodes[n][0], 6), round(nodes[n][1], 6)] for n in ways[w] if n in nodes] for w in t["ways"]]
        lines = [ln for ln in lines if len(ln) >= 2]
        features.append(
            {"type": "Feature", "properties": props, "geometry": {"type": "MultiLineString", "coordinates": lines}}
        )
    continuous = sum(1 for t in in_zone if t["parts"] == 1)
    report = [f"{len(in_zone)} circuits balisés dans la zone ({continuous} continus, {len(in_zone) - continuous} avec coupures)"]
    for t in in_zone:
        report.append(
            f"  {t['id']} | {t['tags'].get('name', t['tags'].get('ref', '-'))} | {t['length_m']} m | "
            f"{t['parts']} morceaux | plus grand écart {t['max_gap_m']} m"
        )
        order = t["order"]
        if order["refusal"] is None:
            share = 100 * order["removed_m"] / t["length_m"] if t["length_m"] else 0
            report.append(
                f"    ligne ordonnée : {'boucle' if order['loop'] else 'aller simple'}, {order['ordered_m']} m, "
                f"{order['removed_m']} m retirés ({share:.1f} %)"
            )
        report += [f"    {note}" for note in order["notes"]]
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
