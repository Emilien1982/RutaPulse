#!/usr/bin/env python3
"""Compare the recorded route responses of a folder with the references.

Usage: python3 analyser.py <dossier>   (reads R*.json, writes <dossier>/tableau.md)
Distance: trip.summary.length and length recomputed from the decoded shape.
Ascent: same method as the references (30 m resampling, 5 m hysteresis,
package altitudes through valhalla_service height). Gaps are against the
reference distance and the reference ascent computed on the package ("mnt").
"""
import json
import sys
from pathlib import Path

import commun


def gap(value, ref):
    return (value - ref) / ref * 100


def verdict(g, tol):
    return "OK" if abs(g) <= tol else "NON"


def main():
    folder = Path(sys.argv[1])
    refs = commun.load_references()
    rows = []
    for rid, ref in refs.items():
        f = folder / (rid + ".json")
        if not f.exists():
            print(rid, ": fichier absent, ignoré")
            continue
        resp = json.loads(f.read_text())
        shape = commun.shape_of(resp)
        d_sum = resp["trip"]["summary"]["length"]
        d_shape = commun.refs.length_m(shape) / 1000
        up = commun.ascent_of(shape)
        rows.append({
            "id": rid, "nom": ref["nom"], "d_ref": ref["distance_km"], "d_sum": d_sum, "d_shape": d_shape,
            "a_ref": ref["denivele_positif_calcule_mnt_m"], "a": up,
            "g_d": gap(d_sum, ref["distance_km"]), "g_a": gap(up, ref["denivele_positif_calcule_mnt_m"]),
            "points": len(ref["points_2km"]),
        })
        print(rid, "distance %.2f km (réf %.2f), D+ %.0f m (réf %d)" % (d_sum, ref["distance_km"], up, rows[-1]["a_ref"]))
    md = ["# Analyse de `%s`" % folder.name, "",
          "Écarts calculés par rapport à la référence (distance de la trace, D+ avec les altitudes du paquet).", "",
          "| Réf. | Points | Dist. réf. (km) | Dist. Valhalla (km) | Dist. forme (km) | Écart dist. | ±5 % | "
          "D+ réf. (m) | D+ calculé (m) | Écart D+ | ±10 % |",
          "|---|---|---|---|---|---|---|---|---|---|---|"]
    for r in rows:
        md.append("| %s | %d | %.2f | %.2f | %.2f | %+.1f %% | %s | %d | %.0f | %+.1f %% | %s |" % (
            r["id"], r["points"], r["d_ref"], r["d_sum"], r["d_shape"], r["g_d"], verdict(r["g_d"], 5),
            r["a_ref"], r["a"], r["g_a"], verdict(r["g_a"], 10)))
    md += ["", "Verdict de distance : écart de `trip.summary.length` à la distance de la référence.", ""]
    (folder / "tableau.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("écrit", folder / "tableau.md")


if __name__ == "__main__":
    main()
