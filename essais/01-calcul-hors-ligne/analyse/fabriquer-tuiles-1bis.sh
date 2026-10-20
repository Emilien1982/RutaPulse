#!/usr/bin/env bash
# Essai 1-bis: build separate Valhalla tiles (3.9.1, with elevation) for one combination.
# Usage: ./fabriquer-tuiles-1bis.sh 5-lua-piste | 6-lua-mtb
# Output: travail/tuiles-<comb>/ (valhalla_tiles.tar + elevation), same layout as the zone package.
# Input: the same OSM extract as the package (zone/sortie/travail/nancy.osm.pbf); the package is not touched.
set -euo pipefail
COMB="$1"
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/../zone/sortie/travail"
OUT="$HERE/travail/tuiles-$COMB"
WORK="$OUT/work"
IMAGE="ghcr.io/valhalla/valhalla:3.9.1"
case "$COMB" in
  5-lua-piste) LUA=graph-5-lua-piste.lua; PBF="$SRC/nancy.osm.pbf" ;;
  6-lua-mtb)   LUA=graph-6-lua-mtb.lua;   PBF="$HERE/travail/nancy-mtb.osm.pbf" ;;
  *) echo "combinaison inconnue"; exit 1 ;;
esac
[ "$COMB" = 6-lua-mtb ] && [ ! -f "$PBF" ] && python3 "$HERE/marquer-mtb.py" "$SRC/nancy.osm.pbf" "$PBF"
rm -rf "$OUT"; mkdir -p "$WORK"
cp "$PBF" "$WORK/nancy.osm.pbf"; cp "$SRC/admins.sqlite" "$WORK/"; cp -R "$SRC/elevation" "$WORK/elevation"
vd() { docker run --rm -v "$WORK:/data" -v "$HERE/lua:/lua:ro" -w /data "$IMAGE" "$@"; }
t() { python3 -c 'import time; print(time.time())'; }
T0=$(t)
vd valhalla_build_config --mjolnir-tile-dir /data/valhalla_tiles --mjolnir-tile-extract /data/valhalla_tiles.tar \
  --mjolnir-admin /data/admins.sqlite --additional-data-elevation /data/elevation \
  --mjolnir-graph-lua-name "/lua/$LUA" > "$WORK/valhalla.json"
grep -n graph_lua "$WORK/valhalla.json"
T1=$(t)
vd valhalla_build_tiles -c /data/valhalla.json /data/nancy.osm.pbf > "$OUT/build.log" 2>&1
T2=$(t)
vd valhalla_build_extract -c /data/valhalla.json -v >> "$OUT/build.log" 2>&1
T3=$(t)
mv "$WORK/valhalla_tiles.tar" "$OUT/"; mv "$WORK/elevation" "$OUT/elevation"; cp "$WORK/valhalla.json" "$OUT/"
rm -rf "$WORK"
python3 - "$T0" "$T1" "$T2" "$T3" "$OUT" <<'PY'
import sys, os
t0, t1, t2, t3 = map(float, sys.argv[1:5]); out = sys.argv[5]
sz = os.path.getsize(out + "/valhalla_tiles.tar")
print("config %.1f s, tuiles %.1f s, archive %.1f s, total %.1f s; valhalla_tiles.tar %d octets (%.1f Mo)"
      % (t1 - t0, t2 - t1, t3 - t2, t3 - t0, sz, sz / 1048576))
PY
