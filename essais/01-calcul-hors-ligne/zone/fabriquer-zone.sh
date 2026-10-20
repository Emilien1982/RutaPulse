#!/usr/bin/env bash
# Build the "Nancy" zone package: Valhalla routing tiles (with elevation),
# skadi elevation tiles, zone.json and timing measures.
# Re-runnable: downloads and extracts are skipped when the file already exists
# (set FORCE=1 to rebuild everything except the Geofabrik download).
# Optional: OUT_DIR changes the output folder (default: ./sortie). STEP_HOOK
# (path of a script called with "start|end <step>") and TIME_LOG (file filled by
# /usr/bin/time) are used by essais/03-carte-hors-ligne/zone/fabriquer-paquet.sh.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT_DIR:-$HERE/sortie}"
WORK="$OUT/travail"
PKG="$OUT/nancy"
PBF_URL="https://download.geofabrik.de/europe/france/lorraine-latest.osm.pbf"
BBOX="${BBOX:-5.84,48.47,6.52,48.92}"   # lon_min,lat_min,lon_max,lat_max
IMAGE="ghcr.io/valhalla/valhalla:3.9.1"
ZONE_NAME="${ZONE_NAME:-Nancy}"

mkdir -p "$WORK" "$PKG"
MES="$OUT/mesures.txt"
: > "$MES"

now() { python3 -c 'import time; print(f"{time.time():.3f}")'; }
step() { # step "name" command...
  local name="$1"; shift
  local t0 t1
  echo "== $name"
  if [ -n "${STEP_HOOK:-}" ]; then "$STEP_HOOK" start "$name"; fi
  t0=$(now)
  "$@"
  t1=$(now)
  if [ -n "${STEP_HOOK:-}" ]; then "$STEP_HOOK" end "$name"; fi
  python3 -c "print('%-24s %8.1f s' % ('$name', $t1 - $t0))" | tee -a "$MES"
}
mb() { python3 -c "print('%.1f' % ($1 / 1048576))"; }
# exact size in bytes: BSD stat on macOS, GNU stat on Linux
if [ "$(uname)" = Darwin ]; then STAT_SIZE=(stat -f %z); TIME_FLAG=-l; else STAT_SIZE=(stat -c %s); TIME_FLAG=-v; fi
size_of_file() { "${STAT_SIZE[@]}" "$1"; }
size_of_dir() { find "$1" -type f -exec "${STAT_SIZE[@]}" {} + | awk '{s += $1} END {print s + 0}'; }   # sum of exact file sizes (bytes)

# Run a command under /usr/bin/time (peak memory) when TIME_LOG is set.
tm() {
  if [ -n "${TIME_LOG:-}" ]; then
    echo "CMD $1" >> "$TIME_LOG"
    /usr/bin/time "$TIME_FLAG" -o "$TIME_LOG" -a "$@"
  else
    "$@"
  fi
}

# Run a Valhalla tool in Docker; the whole work dir is mounted on /data.
vdocker() { docker run --rm -v "$WORK:/data" -w /data "$IMAGE" "$@"; }

do_download() {
  if [ -s "$WORK/lorraine.osm.pbf" ]; then echo "already there"; return; fi
  curl -fL --retry 3 -o "$WORK/lorraine.osm.pbf.part" "$PBF_URL"
  mv "$WORK/lorraine.osm.pbf.part" "$WORK/lorraine.osm.pbf"
}

do_extract() {
  rm -f "$WORK/nancy.osm.pbf"
  tm osmium extract -b "$BBOX" --strategy=smart -o "$WORK/nancy.osm.pbf" "$WORK/lorraine.osm.pbf"
}

do_config() {
  # Config for the Valhalla tools: tiles in /data/valhalla_tiles, elevation in /data/elevation.
  vdocker valhalla_build_config \
    --mjolnir-tile-dir /data/valhalla_tiles \
    --mjolnir-tile-extract /data/valhalla_tiles.tar \
    --mjolnir-admin /data/admins.sqlite \
    --additional-data-elevation /data/elevation \
    > "$WORK/valhalla.json"
}

do_admins() {
  # Admin boundaries (country rules) read from the extract. Timezones are not built.
  rm -f "$WORK/admins.sqlite"
  vdocker valhalla_build_admins -c /data/valhalla.json /data/nancy.osm.pbf
}

do_elevation() {
  rm -rf "$WORK/elevation"; mkdir -p "$WORK/elevation"
  vdocker valhalla_build_elevation --from-bbox="$BBOX" --decompress -c /data/valhalla.json
}

do_tiles() {
  rm -rf "$WORK/valhalla_tiles" "$WORK/valhalla_tiles.tar"
  vdocker valhalla_build_tiles -c /data/valhalla.json /data/nancy.osm.pbf
}

do_archive() {
  rm -f "$WORK/valhalla_tiles.tar"
  vdocker valhalla_build_extract -c /data/valhalla.json -v
}

step "1-telechargement" do_download
step "2-decoupe" do_extract
do_config
step "3a-admins" do_admins
step "3b-altitude" do_elevation
step "4-tuiles" do_tiles
step "5-archive" do_archive

# Put the package together
rm -rf "$PKG"; mkdir -p "$PKG"
mv "$WORK/valhalla_tiles.tar" "$PKG/valhalla_tiles.tar"
cp -R "$WORK/elevation" "$PKG/elevation"

TAR_B=$(size_of_file "$PKG/valhalla_tiles.tar")
ELE_B=$(size_of_dir "$PKG/elevation")
TOT_B=$((TAR_B + ELE_B))
PBF_B=$(size_of_file "$WORK/nancy.osm.pbf")
OSM_DATE=$(osmium fileinfo -g header.option.osmosis_replication_timestamp "$WORK/lorraine.osm.pbf" 2>/dev/null || true)
[ -n "$OSM_DATE" ] || OSM_DATE=$(osmium fileinfo -g data.timestamp.last "$WORK/lorraine.osm.pbf" 2>/dev/null || echo unknown)

python3 - "$PKG/zone.json" "$ZONE_NAME" "$BBOX" "$OSM_DATE" "$TAR_B" "$ELE_B" "$TOT_B" <<'PY'
import json, sys
path, name, bbox, date, tar_b, ele_b, tot_b = sys.argv[1:]
lon0, lat0, lon1, lat1 = map(float, bbox.split(","))
json.dump({
    "name": name,
    "bbox": {"lonMin": lon0, "latMin": lat0, "lonMax": lon1, "latMax": lat1},
    "osmDate": date,
    "valhallaVersion": "3.9.1",
    "sizes": {"tarBytes": int(tar_b), "elevationBytes": int(ele_b), "totalBytes": int(tot_b)},
}, open(path, "w"), indent=2, ensure_ascii=False)
PY

{
  echo
  echo "Tailles (octets / Mo)"
  printf '%-24s %12d B  %8s Mo\n' "extrait-osm-nancy" "$PBF_B" "$(mb "$PBF_B")"
  printf '%-24s %12d B  %8s Mo\n' "valhalla_tiles.tar" "$TAR_B" "$(mb "$TAR_B")"
  printf '%-24s %12d B  %8s Mo\n' "elevation" "$ELE_B" "$(mb "$ELE_B")"
  printf '%-24s %12d B  %8s Mo\n' "total (tar+altitude)" "$TOT_B" "$(mb "$TOT_B")"
  echo "date OSM: $OSM_DATE"
} | tee -a "$MES"
