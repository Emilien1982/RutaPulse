#!/usr/bin/env bash
# Check the zone package with a real Valhalla: start valhalla_service (Docker) on
# sortie/nancy and ask one bicycle/mountain route in the forêt de Haye.
# Expected: no error, French instructions, non-zero altitudes.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PKG="$HERE/sortie/nancy"
VER="$HERE/sortie/verif"
IMAGE="ghcr.io/valhalla/valhalla:3.9.1"
FROM="${1:-48.6905,6.1080}"
TO="${2:-48.7180,6.0750}"

[ -f "$PKG/valhalla_tiles.tar" ] || { echo "paquet absent : lancer fabriquer-zone.sh" >&2; exit 1; }
mkdir -p "$VER"

# Config that reads the package as the phone will: tile archive + elevation folder.
docker run --rm "$IMAGE" valhalla_build_config \
  --mjolnir-tile-dir /pkg/tiles-unused \
  --mjolnir-tile-extract /pkg/valhalla_tiles.tar \
  --additional-data-elevation /pkg/elevation > "$VER/valhalla.json"

python3 - "$VER/request.json" "$FROM" "$TO" <<'PY'
import json, sys
out, a, b = sys.argv[1:]
la, lo = map(float, a.split(",")); lb, lob = map(float, b.split(","))
json.dump({
    "locations": [{"lat": la, "lon": lo}, {"lat": lb, "lon": lob}],
    "costing": "bicycle",
    "costing_options": {"bicycle": {"bicycle_type": "mountain"}},
    "directions_options": {"language": "fr-FR", "units": "kilometers"},
    "elevation_interval": 30,
}, open(out, "w"))
PY

START=$(python3 -c 'import time; print(time.time())')
docker run --rm -v "$PKG:/pkg:ro" -v "$VER:/ver" "$IMAGE" \
  sh -c 'valhalla_service /ver/valhalla.json route "$(cat /ver/request.json)"' \
  > "$VER/stdout.txt" 2> "$VER/stderr.txt" || { echo "valhalla_service a échoué"; tail -20 "$VER/stderr.txt"; exit 1; }
END=$(python3 -c 'import time; print(time.time())')

python3 - "$VER/stdout.txt" "$START" "$END" <<'PY'
import json, sys
text = open(sys.argv[1]).read()
start = text.index("{")
resp = json.JSONDecoder().raw_decode(text[start:])[0]
if "error" in resp or "trip" not in resp:
    print("ERREUR :", json.dumps(resp)[:500]); sys.exit(1)
trip = resp["trip"]
leg = trip["legs"][0]
s = trip["summary"]
elev = leg.get("elevation", [])
nonzero = sum(1 for v in elev if v != 0)
print("durée totale du conteneur (démarrage compris) : %.1f s" % (float(sys.argv[3]) - float(sys.argv[2])))
print("distance : %.2f km, durée estimée : %.0f min" % (s["length"], s["time"] / 60))
print("instructions (%d) :" % len(leg["maneuvers"]))
for m in leg["maneuvers"][:3]:
    print("  -", m["instruction"])
print("altitudes : %d points (pas %s m), %d non nulles, min %s, max %s"
      % (len(elev), leg.get("elevation_interval", resp["trip"].get("elevation_interval")), nonzero,
         min(elev) if elev else None, max(elev) if elev else None))
ok = nonzero > 0
print("RÉSULTAT :", "OK" if ok else "ÉCHEC (aucune altitude)")
sys.exit(0 if ok else 1)
PY
