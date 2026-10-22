#!/usr/bin/env python3
"""C7 check (phase 1, T5): route R1..R5 on a zone package, with the method of essay 1.

Usage: python3 comparer.py <package folder> <result name>
The package folder must have the phone layout (valhalla_tiles.tar, elevation/N48/*.hgt):
use `zonefactory verify` to get it. Same request as essay 1 (use_roads=0, setting A).
Writes zones/out/t5/resultats/<name>.json with, per reference: distance, ascent, the
encoded `shape` of each leg and a SHA-256 of all the shapes.
"""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
ANALYSE = ROOT / "essais" / "01-calcul-hors-ligne" / "analyse"
OUT = ROOT / "zones" / "out" / "t5"

sys.path.insert(0, str(ANALYSE))
import commun  # noqa: E402  (essay 1 helpers)

package, name = Path(sys.argv[1]).resolve(), sys.argv[2]
commun.PKG = package
commun.WORK = OUT / "travail" / name  # valhalla.json and temp files stay out of the essay folder
commun.WORK.mkdir(parents=True, exist_ok=True)

results = {}
for rid, ref in commun.load_references().items():
    resp = commun.valhalla("route", commun.route_request(ref, {"use_roads": 0.0}))
    shapes = [leg["shape"] for leg in resp["trip"]["legs"]]
    pts = commun.shape_of(resp)
    results[rid] = {
        "distance_km": resp["trip"]["summary"]["length"],
        "ascent_m": commun.ascent_of(pts),
        "legs": len(shapes),
        "points": len(pts),
        "shapes": shapes,
        "shape_sha256": hashlib.sha256("\n".join(shapes).encode()).hexdigest(),
    }
    r = results[rid]
    print(f"{rid} {r['distance_km']:.2f} km  D+ {r['ascent_m']}  {r['legs']} legs  {r['points']} pts  {r['shape_sha256'][:12]}", flush=True)
(OUT / "resultats").mkdir(exist_ok=True)
(OUT / "resultats" / f"{name}.json").write_text(json.dumps(results))
