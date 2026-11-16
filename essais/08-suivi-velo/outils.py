"""Throwaway helpers for essai T1 (phase 8a): call Valhalla, measure, write directions.

Valhalla runs in Docker on http://localhost:8002 (see LISEZMOI.md).
"""
import json
import math
import time
import urllib.request

URL = "http://localhost:8002"
R = 6378160.0  # Valhalla sphere radius, m
COSTING = {
    "costing": "bicycle",
    "costing_options": {"bicycle": {"bicycle_type": "mountain", "use_roads": 0}},
}
DIRECTIONS = {"language": "fr-FR", "units": "kilometers"}
MANEUVER_TYPES = {
    0: "none", 1: "start", 2: "start_right", 3: "start_left", 4: "destination",
    5: "destination_right", 6: "destination_left", 7: "becomes", 8: "continue",
    9: "slight_right", 10: "right", 11: "sharp_right", 12: "uturn_right",
    13: "uturn_left", 14: "sharp_left", 15: "left", 16: "slight_left",
    17: "ramp_straight", 18: "ramp_right", 19: "ramp_left", 20: "exit_right",
    21: "exit_left", 22: "stay_straight", 23: "stay_right", 24: "stay_left",
    25: "merge", 26: "roundabout_enter", 27: "roundabout_exit", 28: "ferry_enter",
    29: "ferry_exit", 37: "merge_right", 38: "merge_left",
}


def call(action, body):
    """POST a request; return (json, seconds)."""
    req = urllib.request.Request(
        f"{URL}/{action}", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        data = json.loads(e.read().decode() or "{}")
        data["_http_status"] = e.code
    return data, time.time() - t0


def decode6(s):
    """Decode a polyline with 6 decimals into [(lat, lon)]."""
    out, i, lat, lon = [], 0, 0, 0
    while i < len(s):
        for which in (0, 1):
            shift = res = 0
            while True:
                b = ord(s[i]) - 63
                i += 1
                res |= (b & 31) << shift
                shift += 5
                if b < 32:
                    break
            d = ~(res >> 1) if res & 1 else res >> 1
            if which == 0:
                lat += d
            else:
                lon += d
        out.append((lat / 1e6, lon / 1e6))
    return out


def hav(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dl = math.radians(b[1] - a[1])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def length(pts):
    return sum(hav(a, b) for a, b in zip(pts, pts[1:]))


def _proj(p, a, b):
    """Distance in m from p to segment ab (local flat approximation)."""
    k = math.cos(math.radians(p[0])) * math.pi / 180 * R
    m = math.pi / 180 * R
    ax, ay = (a[1] - p[1]) * k, (a[0] - p[0]) * m
    bx, by = (b[1] - p[1]) * k, (b[0] - p[0]) * m
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, -(ax * dx + ay * dy) / L))
    return math.hypot(ax + t * dx, ay + t * dy)


class Line:
    """A polyline with a grid index, to measure the distance of points to it."""

    def __init__(self, pts, cell=0.001):
        self.pts, self.cell, self.grid = pts, cell, {}
        for i, (a, b) in enumerate(zip(pts, pts[1:])):
            for lat in (a[0], b[0]):
                pass
            c0 = (int(min(a[0], b[0]) / cell) - 1, int(min(a[1], b[1]) / cell) - 1)
            c1 = (int(max(a[0], b[0]) / cell) + 1, int(max(a[1], b[1]) / cell) + 1)
            for x in range(c0[0], c1[0] + 1):
                for y in range(c0[1], c1[1] + 1):
                    self.grid.setdefault((x, y), []).append(i)

    def dist(self, p):
        cx, cy = int(p[0] / self.cell), int(p[1] / self.cell)
        best = 1e9
        for r in (0, 1, 2, 4, 8, 16):
            idx = set()
            for x in range(cx - r, cx + r + 1):
                for y in range(cy - r, cy + r + 1):
                    idx.update(self.grid.get((x, y), ()))
            for i in idx:
                best = min(best, _proj(p, self.pts[i], self.pts[i + 1]))
            if best < r * self.cell * 80000:
                break
        return best


def shape_of(resp):
    """Matched shape (all legs joined) of a route/trace_route response."""
    out = []
    for leg in resp["trip"]["legs"]:
        pts = decode6(leg["shape"])
        out.extend(pts if not out else pts[1:])
    return out


def directions_of(resp):
    """Ordered list of written directions of every leg."""
    rows = []
    for leg in resp["trip"]["legs"]:
        for m in leg["maneuvers"]:
            rows.append({
                "instruction": m.get("instruction", ""),
                "length_km": m.get("length"),
                "type": m.get("type"),
                "type_name": MANEUVER_TYPES.get(m.get("type"), "?"),
                "street_names": m.get("street_names", []),
                "begin_shape_index": m.get("begin_shape_index"),
            })
    return rows


def compare(original, matched):
    """How far the matched shape strays from the original line."""
    line_m = Line(matched)
    line_o = Line(original)
    d = [line_m.dist(p) for p in original]          # original -> matched
    d2 = [line_o.dist(p) for p in matched[::3]]     # matched -> original
    big = sum(1 for x in d if x > 20)
    return {
        "original_points": len(original),
        "original_m": round(length(original)),
        "matched_points": len(matched),
        "matched_m": round(length(matched)),
        "length_ratio": round(length(matched) / max(1, length(original)), 3),
        "mean_gap_m": round(sum(d) / len(d), 1),
        "p95_gap_m": round(sorted(d)[int(len(d) * 0.95)], 1),
        "max_gap_m": round(max(d), 1),
        "share_original_over_20m": round(big / len(d), 3),
        "share_matched_over_20m_from_original": round(sum(1 for x in d2 if x > 20) / len(d2), 3),
    }


def smell(rows):
    """Heuristics for absurd directions."""
    out = []
    for i, r in enumerate(rows):
        t = r["type_name"]
        if t.startswith("uturn"):
            out.append((i, "demi-tour", r["instruction"]))
        if t in ("continue", "becomes", "stay_straight") and i > 0 and \
                rows[i - 1]["type_name"] == t:
            out.append((i, f"deux '{t}' de suite", r["instruction"]))
        if (r["length_km"] or 0) < 0.03 and t not in ("destination", "destination_right", "destination_left"):
            out.append((i, "direction de moins de 30 m", r["instruction"]))
    return out


def write_directions(path, title, rows):
    with open(path, "w") as f:
        f.write(f"# {title}\n\n{len(rows)} directions\n\n")
        f.write("| # | Instruction | Distance avant la suivante (m) | Manoeuvre |\n|---|---|---|---|\n")
        for i, r in enumerate(rows):
            m = round((r["length_km"] or 0) * 1000)
            f.write(f"| {i} | {r['instruction']} | {m} | {r['type_name']} ({r['type']}) |\n")


def save(path, obj):
    with open(path, "w") as f:
        json.dump(obj, f, ensure_ascii=False)


def encode6(pts):
    out, la, lo = [], 0, 0

    def e(v):
        v = ~(v << 1) if v < 0 else v << 1
        s = ""
        while v >= 32:
            s += chr((32 | (v & 31)) + 63)
            v >>= 5
        return s + chr(v + 63)

    for a, o in pts:
        ia, io = round(a * 1e6), round(o * 1e6)
        out.append(e(ia - la) + e(io - lo))
        la, lo = ia, io
    return "".join(out)


def use_share(pts):
    """Share of the length by edge 'use' (path, track, cycleway, road...) via trace_attributes."""
    body = {"encoded_polyline": encode6(pts), "shape_match": "map_snap", **COSTING,
            "filters": {"attributes": ["edge.use", "edge.length", "edge.surface"], "action": "include"}}
    r, _ = call("trace_attributes", body)
    tot, by = 0.0, {}
    for e in r.get("edges", []):
        k = e.get("use", "?")
        by[k] = by.get(k, 0) + e.get("length", 0)
        tot += e.get("length", 0)
    return {k: round(v / tot, 3) for k, v in sorted(by.items(), key=lambda x: -x[1])} if tot else r


def run_trace(num, pts, modes, hers_note=""):
    """trace_route on pts for each mode; save raw answers, direction lists, measures."""
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    out = f"{here}/resultats"
    summary = {"points": len(pts), "length_m": round(length(pts)),
               "use_share": use_share(pts)}
    for mode in modes:
        body = {"encoded_polyline": encode6(pts), "shape_match": mode, **COSTING,
                "directions_options": DIRECTIONS}
        save(f"{here}/requetes/{num}-trace_route-{mode}.json",
             {**body, "encoded_polyline": f"<polyline 6 decimales, {len(pts)} points>"})
        resp, t = call("trace_route", body)
        save(f"{out}/{num}-trace_route-{mode}-reponse.json", resp)
        if "trip" not in resp:
            summary[mode] = {"seconds": round(t, 3), "error": resp.get("error"),
                             "error_code": resp.get("error_code")}
            print(num, mode, "ERREUR", resp.get("error"))
            continue
        rows = directions_of(resp)
        write_directions(f"{out}/{num}-directions-trace_route-{mode}.md",
                         f"Essai {num} : directions de `trace_route` ({mode})", rows)
        cmp = compare(pts, shape_of(resp))
        summary[mode] = {"seconds": round(t, 3), "directions": len(rows), "compare": cmp,
                         "smell": smell(rows),
                         "types": {k: sum(1 for r in rows if r["type_name"] == k)
                                   for k in sorted({r["type_name"] for r in rows})}}
        print(num, mode, f"{t:.3f}s", len(rows), "directions", cmp)
        for s in smell(rows):
            print("    ", s)
    save(f"{out}/{num}-mesures.json", summary)
    return summary
