#!/usr/bin/env python3
"""Compute R1..R5 with valhalla_service (Docker) on the zone package.

Same request as the app (commun.route_request). Writes the raw Valhalla
response in resultats/mac-<nom>/R*.json.
Usage: python3 calculer-sur-mac.py <nom> [cle=valeur ...]
Example: python3 calculer-sur-mac.py roads0 use_roads=0
The key=value pairs are added to costing_options.bicycle of requete-type.json.
"""
import json
import sys
import time

import commun

if len(sys.argv) < 2:
    sys.exit(__doc__)
name = sys.argv[1]
settings = {k: float(v) for k, v in (a.split("=", 1) for a in sys.argv[2:])}
out = commun.HERE / "resultats" / ("mac-" + name)
out.mkdir(parents=True, exist_ok=True)
(out / "reglages.json").write_text(json.dumps(settings))
for rid, ref in commun.load_references().items():
    req = commun.route_request(ref, settings)
    t = time.time()
    resp = commun.valhalla("route", req)
    dt = time.time() - t
    if "trip" not in resp:
        print(rid, "ERREUR", json.dumps(resp)[:300])
        continue
    (out / (rid + ".json")).write_text(json.dumps(resp, ensure_ascii=False))
    print("%s : %d points, %.2f km, %d legs, %.1f s (conteneur compris)"
          % (rid, len(req["locations"]), resp["trip"]["summary"]["length"], len(resp["trip"]["legs"]), dt))
