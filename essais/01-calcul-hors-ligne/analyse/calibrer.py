#!/usr/bin/env python3
"""Compare the calibration runs (resultats/mac-<nom>/) with the references.

Usage: python3 calibrer.py   (writes resultats/calibration.md)
Per run and reference: share of the computed route (in % of its length) within 25 m
of the reference, ascent gap, distance gap. Ascent method unchanged (30 m, 5 m).
Geometry from diagnostic-denivele.py (tracks densified to 10 m steps).
"""
import importlib.util
import json

import commun

_s = importlib.util.spec_from_file_location("diag", commun.HERE / "diagnostic-denivele.py")
diag = importlib.util.module_from_spec(_s)
_s.loader.exec_module(diag)

RUNS = [  # (folder suffix, title, why)
    ("baseline", "Baseline (réglages par défaut : use_roads 0,25, use_hills 0,25, avoid_bad_surfaces 0,25)", ""),
    ("roads0", "A : use_roads 0", ""),
    ("surf0", "B : avoid_bad_surfaces 0", ""),
    ("hills05", "C : use_hills 0,5", ""),
    ("roads0-surf0", "D : use_roads 0 + avoid_bad_surfaces 0", ""),
]
NEAR_M = 25.0
IDS = ["R1", "R2", "R3", "R4", "R5"]


def measure(folder, rid, ref, ref_track):
    resp = json.loads((folder / (rid + ".json")).read_text())
    shape = commun.shape_of(resp)
    route = diag.Track(shape)
    near = total = 0.0
    for i in range(1, len(route.pts)):
        step = route.cum[i] - route.cum[i - 1]
        total += step
        if ref_track.project(route.pts[i])[0] <= NEAR_M:
            near += step
    d = resp["trip"]["summary"]["length"]
    a = commun.ascent_of(shape)
    a_ref = ref["denivele_positif_calcule_mnt_m"]
    return {"near": near / total * 100, "d": d, "g_d": (d - ref["distance_km"]) / ref["distance_km"] * 100,
            "a": a, "g_a": (a - a_ref) / a_ref * 100, "a_ref": a_ref, "d_ref": ref["distance_km"]}


def main():
    references = commun.load_references()
    tracks = {}
    for rid, ref in references.items():
        gpx = commun.refs.read_gpx(commun.ESSAI / "zone" / "references" / ref["gpx"])
        tracks[rid] = diag.Track(gpx)
    results = {}
    for name, _, _ in RUNS:
        folder = commun.HERE / "resultats" / ("mac-" + name)
        results[name] = {rid: measure(folder, rid, references[rid], tracks[rid]) for rid in IDS}
        print(name, {k: round(v["near"], 1) for k, v in results[name].items()})
    md = ["# Calibration du profil vélo VTT (Valhalla 3.9.1, Mac)", "",
          "Mesures sur R1 à R5, points de passage tous les 2 km, D+ avec la méthode de l'essai "
          "(rééchantillonnage 30 m, hystérésis 5 m, altitudes du paquet).",
          "« À moins de 25 m » : part de la longueur calculée dont les points (pas de 10 m) sont à 25 m "
          "ou moins de la référence. Écarts = (calculé - référence) / référence.", ""]
    synth = []
    for name, title, _ in RUNS:
        r = results[name]
        md += ["## " + title, "", "| Réf. | À moins de 25 m | Dist. réf. (km) | Dist. calculée (km) | Écart dist. | "
               "D+ réf. (m) | D+ calculé (m) | Écart D+ |", "|---|---|---|---|---|---|---|---|"]
        for rid in IDS:
            x = r[rid]
            md.append("| %s | %.1f %% | %.2f | %.2f | %+.1f %% | %d | %.0f | %+.1f %% |" % (
                rid, x["near"], x["d_ref"], x["d"], x["g_d"], x["a_ref"], x["a"], x["g_a"]))
        md.append("")
        sub = [r[i] for i in IDS[1:]]
        ok_d = sum(abs(x["g_d"]) <= 5 for x in sub)
        ok_a = sum(abs(x["g_a"]) <= 10 for x in sub)
        ok_d_all = ok_d + (abs(r["R1"]["g_d"]) <= 5)
        ok_a_all = ok_a + (abs(r["R1"]["g_a"]) <= 10)
        synth.append((name, title.split(" (")[0], sum(x["near"] for x in sub) / 4, sum(x["g_d"] for x in sub) / 4,
                      sum(abs(x["g_a"]) for x in sub) / 4, sum(x["g_a"] for x in sub) / 4, ok_d, ok_a, ok_d_all, ok_a_all,
                      r["R1"]["near"]))
    md += ["## Synthèse", "",
           "Moyennes sur R2 à R5 (R1 à part : sa référence, reconstruite d'OSM, a 20 sauts de plus de 100 m). "
           "Nombres de références dans la tolérance : sur R2 à R5 (sur 4), et entre parenthèses sur R1 à R5 (sur 5).", "",
           "| Combinaison | Moy. à moins de 25 m | Moy. écart dist. | Moy. écart D+ (valeur abs.) | Moy. écart D+ (signé) | "
           "Dist. ± 5 % | D+ ± 10 % | R1 à moins de 25 m |", "|---|---|---|---|---|---|---|---|"]
    for n, t, near, gd, ga_abs, ga, okd, oka, okd5, oka5, r1 in synth:
        md.append("| %s | %.1f %% | %+.1f %% | %.1f %% | %+.1f %% | %d/4 (%d/5) | %d/4 (%d/5) | %.1f %% |" % (
            t, near, gd, ga_abs, ga, okd, okd5, oka, oka5, r1))
    # rule fixed in advance
    best = max(s[2] for s in synth)
    tied = [s for s in synth if best - s[2] < 2.0]
    win = min(tied, key=lambda s: s[4])
    md += ["", "## Règle de choix (fixée d'avance)", "",
           "Meilleure moyenne de « à moins de 25 m » sur R2 à R5. Si l'écart est de moins de 2 points, "
           "le plus petit écart moyen de D+ en valeur absolue.", "",
           "Meilleure moyenne : %.1f %%. Combinaisons à moins de 2 points : %s." % (best, ", ".join(s[1] for s in tied)),
           "", "**Retenue : %s** (dossier `mac-%s`)." % (win[1], win[0]), ""]
    (commun.HERE / "resultats" / "calibration.md").write_text("\n".join(md), encoding="utf-8")
    print("retenue:", win[0])


if __name__ == "__main__":
    main()
