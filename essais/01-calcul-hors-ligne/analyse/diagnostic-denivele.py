#!/usr/bin/env python3
"""Diagnose the ascent gaps between the Valhalla routes and the references.

Usage: python3 diagnostic-denivele.py   (reads resultats/mac/R*.json, writes resultats/mac/diagnostic-denivele.md)

Ascent method unchanged (30 m resampling, package altitudes, 5 m hysteresis).
Hypotheses measured for each reference:
 (a) other paths: both tracks are cut at the 2 km points; per section: length, ascent
     (the climbs of the whole-track hysteresis are attributed to the section where they
     are counted, so the sections add up to the total), lateral gap to the other track;
 (b) sampling / noise: ascent with thresholds 0, 2, 5, 10 m, point counts, resampling check;
 (c) out of zone / no altitude: points outside the bbox, zero altitudes;
 (d) other: altitude read at the GPX position vs at its projection on the route, spurs
     (the route passes again on its own path), jumps in the reference.
Geometry works on tracks densified to 10 m steps (distance to a track: exact projection
on the segments next to the nearest vertex). Pure Python, no external package.
"""
import hashlib
import json
import math
from pathlib import Path

import commun

refs = commun.refs
OUT = commun.HERE / "resultats" / "mac"
CACHE = commun.WORK / "diag-heights.json"
BBOX = (5.84, 6.52, 48.47, 48.92)  # lon min, lon max, lat min, lat max
LAT0, LON0 = 48.7, 6.2
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110574.0
FAR_M = 25.0      # "far from the other track"
DIFF_SHARE = 0.2  # a section is "different" if more than 20 % of it is far from the other track
STEP = refs.STEP_M


def xy(p):
    return ((p[1] - LON0) * KX, (p[0] - LAT0) * KY)


def latlon(x, y):
    return (LAT0 + y / KY, LON0 + x / KX)


# ---------- heights (cached, Docker) ----------
_cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}


def heights(pts, chunk=1500):
    out = []
    for i in range(0, len(pts), chunk):
        part = pts[i:i + chunk]
        key = hashlib.sha1(",".join("%.6f,%.6f" % (p[0], p[1]) for p in part).encode()).hexdigest()
        if key not in _cache:
            _cache[key] = commun.valhalla("height", {"shape": [{"lat": p[0], "lon": p[1]} for p in part]})["height"]
            CACHE.write_text(json.dumps(_cache))
        out.extend(_cache[key])
    return out


# ---------- track ----------
class Track:
    """Densified track (steps <= 10 m) with cumulative length and a grid on the vertices."""

    def __init__(self, raw):
        self.raw = raw
        pts = [raw[0][:2]]
        for a, b in zip(raw, raw[1:]):
            n = max(1, math.ceil(refs.haversine(a, b) / 10.0))
            for k in range(1, n + 1):
                t = k / n
                pts.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
        self.pts = pts
        self.xy = [xy(p) for p in pts]
        self.cum = refs.cumulative(pts)
        self.grid = {}
        for i, (x, y) in enumerate(self.xy):
            self.grid.setdefault((int(x // 40), int(y // 40)), []).append(i)

    def nearest_vertex(self, x, y, rmax=400.0):
        cx, cy = int(x // 40), int(y // 40)
        best, bi = rmax * rmax, None
        for ring in range(int(rmax // 40) + 2):
            if bi is not None and (ring - 1) * 40 > math.sqrt(best):
                break
            for gx in range(cx - ring, cx + ring + 1):
                for gy in range(cy - ring, cy + ring + 1):
                    if max(abs(gx - cx), abs(gy - cy)) != ring:
                        continue
                    for i in self.grid.get((gx, gy), ()):
                        d = (self.xy[i][0] - x) ** 2 + (self.xy[i][1] - y) ** 2
                        if d < best:
                            best, bi = d, i
        return bi

    def project(self, p):
        """(distance m, cum m, (lat, lon)) of the projection of p on the track; distance inf if > 400 m."""
        x, y = xy(p)
        i = self.nearest_vertex(x, y)
        if i is None:
            return math.inf, None, None
        best = (math.hypot(self.xy[i][0] - x, self.xy[i][1] - y), self.cum[i], self.xy[i])
        for j in (i - 1, i):
            if j < 0 or j + 1 >= len(self.xy):
                continue
            (ax, ay), (bx, by) = self.xy[j], self.xy[j + 1]
            dx, dy = bx - ax, by - ay
            L2 = dx * dx + dy * dy
            t = 0 if L2 == 0 else max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / L2))
            px, py = ax + t * dx, ay + t * dy
            d = math.hypot(px - x, py - y)
            if d < best[0]:
                best = (d, self.cum[j] + t * (self.cum[j + 1] - self.cum[j]), (px, py))
        return best[0], best[1], latlon(*best[2])

    def at(self, c):
        """Index of the vertex at cumulative length c."""
        lo, hi = 0, len(self.cum) - 1
        while lo < hi:
            m = (lo + hi) // 2
            if self.cum[m] < c:
                lo = m + 1
            else:
                hi = m
        return lo


def ascent_split(h, hyst=refs.HYST_M):
    """Same as refs.ascent, but returns the climb counted at each index."""
    inc = [0.0] * len(h)
    ref = h[0]
    for i in range(1, len(h)):
        e = h[i]
        if e - ref >= hyst:
            inc[i] = e - ref
            ref = e
        elif ref - e >= hyst:
            ref = e
    return inc


def sample_30(track):
    """Resampled points (30 m) of a track: [(lat, lon)], same function as the references."""
    return [(p[0], p[1]) for p in refs.resample([(p[0], p[1], None) for p in track.raw])]


def candidates(route, q, radius=60.0):
    """Best vertex of each pass of the route within `radius` m of q: [(index, distance)]."""
    x, y = xy(q)
    out, run = [], None
    for i, (vx, vy) in enumerate(route.xy):
        d = math.hypot(vx - x, vy - y)
        if d <= radius:
            run = (d, i) if run is None or d < run[0] else run
        elif run is not None:
            out.append((run[1], run[0]))
            run = None
    if run is not None:
        out.append((run[1], run[0]))
    if not out:
        i = min(range(len(route.xy)), key=lambda i: math.hypot(route.xy[i][0] - x, route.xy[i][1] - y))
        out.append((i, math.hypot(route.xy[i][0] - x, route.xy[i][1] - y)))
    return out


def waypoints_on_route(route, ref, pts2):
    """Cumulative length on the reference and on the route of each 2 km point.

    On the route, each point may be passed several times: choose the passes in increasing order
    that best keep the 2 km spacing of the reference (dynamic programming, cost = |length - 2 km|
    + distance of the pass to the point). First and last point are the start and the end.
    """
    on_ref = [0.0] + [ref.cum[ref.at(p["km"] * 1000)] for p in pts2[1:-1]] + [ref.cum[-1]]
    cands = [[(0, 0.0)]] + [candidates(route, (p["lat"], p["lon"])) for p in pts2[1:-1]] + [[(len(route.cum) - 1, 0.0)]]
    best = [{i: (d, None) for i, d in cands[0]}]
    for k in range(1, len(cands)):
        cur = {}
        for i, d in cands[k]:
            opts = [(cost + abs((route.cum[i] - route.cum[j]) - (on_ref[k] - on_ref[k - 1])) + d, j)
                    for j, (cost, _) in best[k - 1].items() if j <= i]
            if opts:
                cur[i] = min(opts)
        if not cur:  # no ordered pass: keep the nearest pass, whatever its order
            i, d = min(cands[k], key=lambda c: c[1])
            cur[i] = (min(v[0] for v in best[k - 1].values()) + d, min(best[k - 1], key=lambda j: best[k - 1][j][0]))
        best.append(cur)
    i = min(best[-1], key=lambda i: best[-1][i][0])
    idx = [i]
    for k in range(len(cands) - 1, 0, -1):
        i = best[k][i][1]
        idx.append(i)
    idx.reverse()
    return on_ref, [route.cum[i] for i in idx]


def revisits(track, s30):
    """Indices of 30 m samples lying within 10 m of the track at another place (> 150 m of path away),
    kept only in runs of >= 3 samples (go-and-back spurs, not simple crossings)."""
    flag = []
    for k, p in enumerate(s30):
        x, y = xy(p)
        c0 = k * STEP
        hit = False
        cx, cy = int(x // 40), int(y // 40)
        for gx in (cx - 1, cx, cx + 1):
            for gy in (cy - 1, cy, cy + 1):
                for i in track.grid.get((gx, gy), ()):
                    if abs(track.cum[i] - c0) > 150 and math.hypot(track.xy[i][0] - x, track.xy[i][1] - y) <= 10:
                        hit = True
        flag.append(hit)
    keep, k = [False] * len(flag), 0
    while k < len(flag):
        if flag[k]:
            e = k
            while e < len(flag) and flag[e]:
                e += 1
            if e - k >= 3:
                for j in range(k, e):
                    keep[j] = True
            k = e
        else:
            k += 1
    return keep


def counts_c(raw, hs):
    out = sum(1 for p in raw if not (BBOX[0] <= p[1] <= BBOX[1] and BBOX[2] <= p[0] <= BBOX[3]))
    return out, sum(1 for v in hs if v is None), sum(1 for v in hs if v == 0)


def jumps(raw):
    d = [refs.haversine(a, b) for a, b in zip(raw, raw[1:])]
    return max(d), sum(1 for v in d if v > 100)


SUMMARY = []


def diagnose(rid, ref_info, resp):
    ref_raw = refs.read_gpx(commun.ESSAI / "zone" / "references" / ref_info["gpx"])
    ref = Track(ref_raw)
    route = Track(commun.shape_of(resp))
    r30, v30 = sample_30(ref), sample_30(route)
    hr, hv = heights(r30), heights(v30)
    a_ref, a_route = refs.ascent(hr), refs.ascent(hv)
    assert abs(a_ref - ref_info["denivele_positif_calcule_mnt_m"]) < 1, (a_ref, ref_info["denivele_positif_calcule_mnt_m"])
    inc_r, inc_v = ascent_split(hr), ascent_split(hv)
    assert abs(sum(inc_r) - a_ref) < 1e-6 and abs(sum(inc_v) - a_route) < 1e-6
    md = ["## %s — %s" % (rid, ref_info["nom"]), ""]
    gap = a_route - a_ref
    md.append("D+ référence %.0f m, D+ calculé %.0f m, écart %+.0f m (%+.1f %%). Distance réf. %.2f km, calculée %.2f km."
              % (a_ref, a_route, gap, gap / a_ref * 100, ref.cum[-1] / 1000, route.cum[-1] / 1000))
    md.append("")

    # distance of each 30 m sample to the other track
    dv = [ref.project(p)[0] for p in v30]          # route sample -> reference
    dr = [route.project(p)[0] for p in r30]        # reference sample -> route

    # (a) sections
    on_ref, on_route = waypoints_on_route(route, ref, ref_info["points_2km"])
    rows, tot = [], {"diff": 0.0, "same": 0.0}
    lat_gain = 0.0
    # (d) heights of the reference read at its projection on the route (where the route is within 25 m)
    proj = [route.project(p) for p in r30]
    sub_pts = [pr[2] if pr[0] <= FAR_M else None for pr in proj]
    near = [i for i, q in enumerate(sub_pts) if q is not None]
    hq = heights([sub_pts[i] for i in near]) if near else []
    hr_sub = list(hr)
    for i, h in zip(near, hq):
        hr_sub[i] = h
    inc_rs = ascent_split(hr_sub)
    diffs = [hr_sub[i] - hr[i] for i in near]
    for k in range(len(on_ref) - 1):
        rs, re_ = on_ref[k], on_ref[k + 1]
        vs, ve = on_route[k], on_route[k + 1]
        ir = [i for i in range(len(r30)) if rs <= i * STEP < re_]
        iv = [i for i in range(len(v30)) if vs <= i * STEP < ve]
        if k == len(on_ref) - 2:
            ir = [i for i in range(len(r30)) if rs <= i * STEP]
            iv = [i for i in range(len(v30)) if vs <= i * STEP]
        sh_route = sum(1 for i in iv if dv[i] > FAR_M) / max(1, len(iv))
        sh_ref = sum(1 for i in ir if dr[i] > FAR_M) / max(1, len(ir))
        haus = max([dv[i] for i in iv] + [dr[i] for i in ir] + [0])
        ar, av = sum(inc_r[i] for i in ir), sum(inc_v[i] for i in iv)
        ars = sum(inc_rs[i] for i in ir)
        is_diff = sh_route > DIFF_SHARE or sh_ref > DIFF_SHARE
        tot["diff" if is_diff else "same"] += av - ar
        if not is_diff:
            lat_gain += ars - ar
        rows.append((k + 1, (re_ - rs) / 1000, (ve - vs) / 1000, ar, av, sh_route, sh_ref, haus, is_diff, ars))
    md.append("### (a) Tronçons coupés aux points de 2 km")
    md.append("")
    md.append("Les montées comptées par l'hystérésis sur la trace entière sont attribuées au tronçon où elles tombent "
              "(la somme des tronçons égale le D+ total). « Hors réf. » = part du tronçon calculé à plus de 25 m de la "
              "référence ; « Réf. hors route » = l'inverse. Tronçon « autre chemin » si l'une des deux parts dépasse 20 %. "
              "Hausdorff = plus grand écart latéral entre les deux tracés sur le tronçon (échantillons de 30 m).")
    md.append("")
    md.append("| Tr. | Long. réf. (km) | Long. calc. (km) | D+ réf. (m) | D+ calc. (m) | Écart D+ (m) | Hors réf. | Réf. hors route | Hausdorff (m) | Autre chemin |")
    md.append("|---|---|---|---|---|---|---|---|---|---|")
    for r in rows:
        md.append("| %d | %.2f | %.2f | %.0f | %.0f | %+.0f | %.0f %% | %.0f %% | %s | %s |" % (
            r[0], r[1], r[2], r[3], r[4], r[4] - r[3], r[5] * 100, r[6] * 100, (">400" if r[7] == math.inf else "%.0f" % r[7]), "oui" if r[8] else "non"))
    md.append("")
    md.append("Écart de D+ porté par les tronçons « autre chemin » : **%+.0f m** ; par les tronçons sur le même chemin : **%+.0f m** (total %+.0f m)."
              % (tot["diff"], tot["same"], gap))
    top = sorted(rows, key=lambda r: -abs(r[4] - r[3]))[:3]
    md.append("Trois plus gros écarts de tronçon : " + ", ".join("T%d (%+.0f m%s)" % (r[0], r[4] - r[3], ", autre chemin" if r[8] else "") for r in top) + ".")
    md.append("")

    # (b)
    md.append("### (b) Échantillonnage et bruit")
    md.append("")
    md.append("| | Points bruts | Points à 30 m | Pas moyen (m) | Long. rééchantillonnée / long. brute | D+ seuil 0 | seuil 2 | seuil 5 (méthode) | seuil 10 |")
    md.append("|---|---|---|---|---|---|---|---|---|")
    for name, tr, s, h in (("Référence", ref, r30, hr), ("Calculé", route, v30, hv)):
        raw_len = refs.length_m([p[:2] for p in tr.raw])
        rs_len = refs.length_m(s)
        md.append("| %s | %d | %d | %.1f | %.3f | %.0f | %.0f | %.0f | %.0f |" % (
            name, len(tr.raw), len(s), rs_len / max(1, len(s) - 1), rs_len / raw_len,
            *[refs.ascent(h, t) for t in (0, 2, 5, 10)]))
    md.append("")
    md.append("Les deux tracés passent par la même fonction `refs.resample` (30 m) et les mêmes altitudes du paquet. "
              "Le pas moyen est mesuré en ligne droite entre échantillons (un peu moins de 30 m dans les virages).")
    md.append("")

    # (c)
    md.append("### (c) Hors zone et sans altitude")
    md.append("")
    md.append("| | Points bruts hors bbox | Altitudes absentes | Altitudes égales à 0 |")
    md.append("|---|---|---|---|")
    for name, tr, h in (("Référence", ref, hr), ("Calculé", route, hv)):
        o, n, z = counts_c(tr.raw, h)
        md.append("| %s | %d | %d | %d |" % (name, o, n, z))
    md.append("")

    # (d)
    md.append("### (d) Autres causes")
    md.append("")
    mx, nj = jumps(ref_raw)
    md.append("- Référence : plus grand saut entre deux points GPX consécutifs %.0f m, %d saut(s) de plus de 100 m ; "
              "début-fin à %.0f m." % (mx, nj, refs.haversine(ref_raw[0], ref_raw[-1])))
    if diffs:
        md.append("- Altitude du paquet à la position GPX vs à sa projection sur la route (%d points à moins de 25 m, soit %.0f %% de la trace) : "
                  "écart moyen %+.2f m, écart absolu moyen %.2f m, %.0f %% des points à plus de 5 m d'écart."
                  % (len(diffs), len(diffs) / len(r30) * 100, sum(diffs) / len(diffs),
                     sum(abs(d) for d in diffs) / len(diffs), sum(1 for d in diffs if abs(d) > 5) / len(diffs) * 100))
    a_ref_sub = sum(inc_rs)
    md.append("- D+ de la référence recalculé avec les altitudes lues sur la route : %.0f m (au lieu de %.0f m), soit %+.0f m en tout, "
              "dont **%+.0f m** sur les tronçons sur le même chemin." % (a_ref_sub, a_ref, a_ref_sub - a_ref, lat_gain))
    kv, kr = revisits(route, v30), revisits(ref, r30)
    md.append("- Allers-retours (échantillons à moins de 10 m d'un autre passage de la même trace, en séquences de 3 ou plus) : "
              "route %d échantillons (%.2f km), dont %.0f m de D+ ; référence %d échantillons (%.2f km), dont %.0f m de D+."
              % (sum(kv), sum(kv) * STEP / 1000, sum(i for i, f in zip(inc_v, kv) if f),
                 sum(kr), sum(kr) * STEP / 1000, sum(i for i, f in zip(inc_r, kr) if f)))
    md.append("")
    resid = tot["same"] - lat_gain
    md.append("### Bilan")
    md.append("")
    md.append("Écart total %+.0f m = autres chemins %+.0f m + D+ recalculé avec les altitudes lues sur la route %+.0f m (écart d'altitude de l'ordre de 0,1 m : simple bascule du seuil de 5 m, pas un décalage latéral) + reste sur chemins communs "
              "(bruit, phase de l'échantillonnage, allers-retours) %+.0f m." % (gap, tot["diff"], lat_gain, resid))
    md.append("")
    SUMMARY.append((rid, ref_info["nom"], gap, tot["diff"], lat_gain, resid, nj, sum(1 for r in rows if r[8]), len(rows)))
    print(rid, "écart %+.0f m = autres chemins %+.0f + bascule de seuil %+.0f + reste %+.0f" % (gap, tot["diff"], lat_gain, resid))
    return md


def main():
    infos = commun.load_references()
    md = ["# Diagnostic des écarts de dénivelé (essai 1, T3b, Mac)", "",
          "Généré par `diagnostic-denivele.py`. Méthode de D+ inchangée (30 m, hystérésis 5 m, altitudes du paquet). "
          "Distances latérales mesurées sur des tracés densifiés à 10 m ; seuil « loin » 25 m.", ""]
    for rid, info in infos.items():
        resp = json.loads((OUT / (rid + ".json")).read_text())
        md += diagnose(rid, info, resp)
    md += ["## Conclusions", "",
           "Pour chaque référence : écart de D+ (calculé - référence) réparti entre les tronçons sur un autre chemin, "
           "la bascule du seuil de 5 m (recalcul avec les altitudes lues sur la route) et le reste.", "",
           "| Réf. | Écart D+ (m) | Autres chemins (m) | Bascule de seuil (m) | Reste (m) | Tronçons autre chemin | Sauts GPX > 100 m |",
           "|---|---|---|---|---|---|---|"]
    for rid, nom, gap, d, l, r, nj, nd, nt in SUMMARY:
        md.append("| %s | %+.0f | %+.0f | %+.0f | %+.0f | %d / %d | %d |" % (rid, gap, d, l, r, nd, nt, nj))
    md += ["", "Lecture : le bruit d'échantillonnage (b), les altitudes manquantes ou hors zone (c) et le décalage latéral de la trace (d) "
           "n'expliquent presque rien. L'écart vient des tronçons où l'itinéraire emprunte d'autres chemins que la référence. "
           "Les sauts de plus de 100 m entre points GPX (R1 : 20, R2 : 39, R3 : 49) peuvent venir d'un échantillonnage clairsemé "
           "(R3 : 563 points pour 25 km) ou de trous dans la chaîne OSM (R1, R2) : le script ne les départage pas. "
           "Les tronçons « autre chemin » ne dépendent que des points de passage tous les 2 km : entre deux points, "
           "Valhalla choisit son chemin."]
    (OUT / "diagnostic-denivele.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("écrit", OUT / "diagnostic-denivele.md")


if __name__ == "__main__":
    main()
