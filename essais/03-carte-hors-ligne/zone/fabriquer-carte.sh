#!/usr/bin/env bash
# Build the "Nancy" map package: OpenMapTiles vector map (Planetiler), terrain
# relief (Mapterhorn extract), 10 m contour lines (GDAL + tippecanoe), MTB
# route relations (extraire-circuits.py), carte.json and timing measures.
# Re-runnable: downloads are skipped when the file already exists; every other
# step is rebuilt on each run.
#
# Optional inputs, to avoid downloads:
#   LORRAINE_PBF  path of an existing lorraine.osm.pbf (copied, not downloaded)
#   HGT_DIR       folder holding N48E005.hgt and N48E006.hgt
#   MEASURE_Z13=0 skips the size measure of the zoom 13+ relief extract
# OUT_DIR changes the output folder (default: ./sortie). STEP_HOOK (script called
# with "start|end <step>") and TIME_LOG (file filled by /usr/bin/time) are used
# by fabriquer-paquet.sh to measure each step.
# Tools: docker, pmtiles and tippecanoe (Homebrew), osmium, python3.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT_DIR:-$HERE/sortie}"
WORK="$OUT/travail"
PKG="$OUT/nancy-carte"
PBF_URL="https://download.geofabrik.de/europe/france/lorraine-latest.osm.pbf"
BBOX="${BBOX:-5.84,48.47,6.52,48.92}"   # lon_min,lat_min,lon_max,lat_max
ZONE_NAME="${ZONE_NAME:-Nancy}"
PLANETILER_IMAGE="ghcr.io/onthegomap/planetiler:0.10.2"
PLANETILER_XMX="4g"            # Java heap for Planetiler (Docker has 7.75 GiB)
GDAL_IMAGE="ghcr.io/osgeo/gdal:alpine-small-3.10.3"
RELIEF_URL="https://download.mapterhorn.com/planet.pmtiles"
RELIEF_MAXZOOM=12
CARTE_MAXZOOM=14
CONTOUR_MINZOOM=11
CONTOUR_MAXZOOM=14
export CARTE_MAXZOOM CONTOUR_MINZOOM CONTOUR_MAXZOOM
HGT_URL="https://elevation-tiles-prod.s3.amazonaws.com/skadi"
CONTOUR_INTERVAL=10
CONTOUR_MAJOR=50

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
  python3 -c "print('%-28s %8.1f s' % ('$name', $t1 - $t0))" | tee -a "$MES"
}
mb() { python3 -c "print('%.1f' % ($1 / 1048576))"; }
# exact size in bytes: BSD stat on macOS, GNU stat on Linux
if [ "$(uname)" = Darwin ]; then STAT_SIZE=(stat -f %z); TIME_FLAG=-l; else STAT_SIZE=(stat -c %s); TIME_FLAG=-v; fi
# run a command under /usr/bin/time (peak memory) when TIME_LOG is set
tm() {
  if [ -n "${TIME_LOG:-}" ]; then
    echo "CMD $1" >> "$TIME_LOG"
    /usr/bin/time "$TIME_FLAG" -o "$TIME_LOG" -a "$@"
  else
    "$@"
  fi
}
size_of_file() { "${STAT_SIZE[@]}" "$1"; }
size_of_dir() { find "$1" -type f -exec "${STAT_SIZE[@]}" {} + | awk '{s += $1} END {print s + 0}'; }   # sum of exact file sizes (bytes)
report() { # report "label" bytes
  printf '%-28s %12d B  %8s Mo\n' "$1" "$2" "$(mb "$2")"
}

# `pmtiles version` prints "dev" for the Homebrew build: then ask Homebrew.
pmtiles_version() {
  local v
  v=$(pmtiles version 2>&1 | head -1)
  case "$v" in
    *dev*) brew list --versions pmtiles 2>/dev/null || echo "$v" ;;
    *) echo "$v" ;;
  esac
}

do_pbf() {
  if [ -s "$WORK/lorraine.osm.pbf" ]; then echo "already there"; return; fi
  if [ -n "${LORRAINE_PBF:-}" ] && [ -s "$LORRAINE_PBF" ]; then
    cp "$LORRAINE_PBF" "$WORK/lorraine.osm.pbf"; return
  fi
  curl -fL --retry 3 -o "$WORK/lorraine.osm.pbf.part" "$PBF_URL"
  mv "$WORK/lorraine.osm.pbf.part" "$WORK/lorraine.osm.pbf"
}

do_hgt() {
  mkdir -p "$WORK/hgt"
  local t
  for t in N48E005 N48E006; do
    if [ -s "$WORK/hgt/$t.hgt" ]; then continue; fi
    if [ -n "${HGT_DIR:-}" ] && [ -s "$HGT_DIR/$t.hgt" ]; then
      cp "$HGT_DIR/$t.hgt" "$WORK/hgt/$t.hgt"
    else
      curl -fL --retry 3 "$HGT_URL/N48/$t.hgt.gz" | gunzip > "$WORK/hgt/$t.hgt.part"
      mv "$WORK/hgt/$t.hgt.part" "$WORK/hgt/$t.hgt"
    fi
  done
}

# Planetiler in Docker. /data = work folder for downloads and temp files,
# /input = the OSM extract (read only).
planetiler() {
  docker run --rm -e JAVA_TOOL_OPTIONS="-Xmx$PLANETILER_XMX" \
    -v "$WORK/planetiler:/data" -v "$WORK/lorraine.osm.pbf:/input/lorraine.osm.pbf:ro" \
    "$PLANETILER_IMAGE" --osm-path=/input/lorraine.osm.pbf \
    --download-dir=/data/sources --tmpdir=/data/tmp "$@"
}

do_annexes() {
  mkdir -p "$WORK/planetiler"
  planetiler --download --only-download --bounds="$BBOX"
}

do_carte() {
  rm -f "$WORK/planetiler/carte.pmtiles"
  # profile openmaptiles (default), zoom 0 to 14, overzoomed above in the app
  planetiler --download --bounds="$BBOX" --minzoom=0 --maxzoom="$CARTE_MAXZOOM" \
    --output=/data/carte.pmtiles --force
}

do_relief() {
  rm -f "$WORK/relief.pmtiles"
  tm pmtiles extract "$RELIEF_URL" "$WORK/relief.pmtiles" --bbox="$BBOX" --maxzoom="$RELIEF_MAXZOOM" --dry-run 2>&1 | tail -2
  tm pmtiles extract "$RELIEF_URL" "$WORK/relief.pmtiles" --bbox="$BBOX" --maxzoom="$RELIEF_MAXZOOM"
}

# Size of a zoom 13+ relief extract: dry run for zooms 13 to 15, real extract
# of zoom 13 (deleted afterwards). The regional file comes from download_urls.json.
do_relief_z13() {
  local url
  url=$(python3 -I - "$BBOX" <<'PY'
import json, sys, urllib.request
b = [float(x) for x in sys.argv[1].split(",")]
req = urllib.request.Request("https://download.mapterhorn.com/download_urls.json", headers={"User-Agent": "curl/8"})
items = json.load(urllib.request.urlopen(req))["items"]
for i in items:
    if i["min_zoom"] >= 13 and i["min_lon"] < b[2] and i["max_lon"] > b[0] and i["min_lat"] < b[3] and i["max_lat"] > b[1]:
        print(i["url"])
PY
)
  echo "regional files: $url"
  local z f
  for f in $url; do
    for z in 13 14 15; do
      echo "dry-run zoom 13 to $z ($f)" | tee -a "$MES"
      tm pmtiles extract "$f" /dev/null --bbox="$BBOX" --minzoom=13 --maxzoom="$z" --dry-run 2>&1 | tail -1 | tee -a "$MES"
    done
    rm -f "$WORK/relief-z13.pmtiles"
    tm pmtiles extract "$f" "$WORK/relief-z13.pmtiles" --bbox="$BBOX" --minzoom=13 --maxzoom=13 >/dev/null 2>&1
    report "relief-z13-seul (mesure)" "$(size_of_file "$WORK/relief-z13.pmtiles")" | tee -a "$MES"
    rm -f "$WORK/relief-z13.pmtiles"
  done
}

# Contour lines: HGT (SRTM 1 arc-second, 30 m) -> gdal_contour every 10 m with
# attribute ele -> add "major" (every 50 m) -> tippecanoe (layer contour).
# Source choice: the HGT files are the ones Valhalla already uses for climb
# (same altitudes in route and map), and need no tile decoding. No smoothing.
gdal() { docker run --rm -v "$WORK:/data" -w /data "$GDAL_IMAGE" "$@"; }

do_contours() {
  rm -f "$WORK/contours.geojsonl" "$WORK/contours-raw.geojsonl" "$WORK/dem.vrt" "$WORK/dem.tif" "$WORK/courbes.pmtiles"
  gdal gdalbuildvrt /data/dem.vrt /data/hgt/N48E005.hgt /data/hgt/N48E006.hgt
  # clip a little wider than the zone so that lines do not stop at the edge
  gdal gdal_translate -q -projwin 5.83 48.93 6.53 48.46 /data/dem.vrt /data/dem.tif
  gdal gdal_contour -q -a ele -i "$CONTOUR_INTERVAL" -snodata -32768 -f GeoJSONSeq /data/dem.tif /data/contours-raw.geojsonl
  tm python3 -I - "$WORK/contours-raw.geojsonl" "$WORK/contours.geojsonl" "$CONTOUR_MAJOR" <<'PY'
import json, sys
src, dst, major = sys.argv[1], sys.argv[2], int(sys.argv[3])
n = 0
with open(src) as f, open(dst, "w") as o:
    for line in f:
        line = line.strip().lstrip("\x1e")
        if not line:
            continue
        ft = json.loads(line)
        ele = int(round(ft["properties"]["ele"]))
        ft["properties"] = {"ele": ele, "major": 1 if ele % major == 0 else 0}
        o.write(json.dumps(ft, separators=(",", ":")) + "\n")
        n += 1
print(n, "contour lines")
PY
  tm tippecanoe -o "$WORK/courbes.pmtiles" -n courbes -N "Nancy contour lines" -l contour -Z"$CONTOUR_MINZOOM" -z"$CONTOUR_MAXZOOM" \
    --drop-densest-as-needed --simplification=4 --force -q "$WORK/contours.geojsonl"
}

do_circuits() {
  tm python3 -I "$HERE/extraire-circuits.py" "$WORK/lorraine.osm.pbf" "$BBOX" "$WORK/circuits.geojson" \
    | tee "$WORK/circuits-rapport.txt"
}

step "1-extrait-lorraine" do_pbf
step "2-altitudes-hgt" do_hgt
step "3-annexes-planetiler" do_annexes
step "4-carte" do_carte
step "5-relief" do_relief
if [ "${MEASURE_Z13:-1}" = 1 ]; then step "5b-relief-z13-mesure" do_relief_z13; fi
step "6-courbes" do_contours
step "7-circuits" do_circuits

# Put the package together
rm -rf "$PKG"; mkdir -p "$PKG"
cp "$WORK/planetiler/carte.pmtiles" "$PKG/carte.pmtiles"
cp "$WORK/relief.pmtiles" "$PKG/relief.pmtiles"
cp "$WORK/courbes.pmtiles" "$PKG/courbes.pmtiles"
cp "$WORK/circuits.geojson" "$PKG/circuits.geojson"

CARTE_B=$(size_of_file "$PKG/carte.pmtiles")
RELIEF_B=$(size_of_file "$PKG/relief.pmtiles")
COURBES_B=$(size_of_file "$PKG/courbes.pmtiles")
CIRCUITS_B=$(size_of_file "$PKG/circuits.geojson")
TOT_B=$((CARTE_B + RELIEF_B + COURBES_B))
ANNEXES_B=$(size_of_dir "$WORK/planetiler/sources")
OSM_DATE=$(osmium fileinfo -g header.option.osmosis_replication_timestamp "$WORK/lorraine.osm.pbf" 2>/dev/null || true)
[ -n "$OSM_DATE" ] || OSM_DATE=$(osmium fileinfo -g data.timestamp.last "$WORK/lorraine.osm.pbf" 2>/dev/null || echo unknown)
PBF_B=$(size_of_file "$WORK/lorraine.osm.pbf")

{
  echo
  echo "Tailles (octets / Mo)"
  report "extrait-lorraine.osm.pbf" "$PBF_B"
  report "annexes-planetiler" "$ANNEXES_B"
  for f in "$WORK"/planetiler/sources/*; do
    [ -f "$f" ] && report "  annexe $(basename "$f")" "$(size_of_file "$f")"
  done
  report "carte.pmtiles" "$CARTE_B"
  report "relief.pmtiles" "$RELIEF_B"
  report "courbes.pmtiles" "$COURBES_B"
  report "total carte+relief+courbes" "$TOT_B"
  report "circuits.geojson" "$CIRCUITS_B"
  echo "date OSM: $OSM_DATE"
  echo
  echo "Circuits"
  cat "$WORK/circuits-rapport.txt"
} | tee -a "$MES"

# Relief sources that cover the zone: ask the Mapterhorn coverage tiles (zoom 10)
# for the "source" names and take their entries in attribution.json.
python3 -I - "$PKG/carte.json" "$ZONE_NAME" "$BBOX" "$OSM_DATE" "$CARTE_B" "$RELIEF_B" "$COURBES_B" "$CIRCUITS_B" "$TOT_B" \
  "$PLANETILER_IMAGE" "$GDAL_IMAGE" "$RELIEF_MAXZOOM" "$CONTOUR_MAJOR" "$(pmtiles_version)" "$(tippecanoe --version 2>&1 | head -1)" <<'PY'
import gzip, json, math, os, re, subprocess, sys, urllib.request
(path, name, bbox, date, carte_b, relief_b, courbes_b, circuits_b, tot_b,
 planetiler_image, gdal_image, relief_maxzoom, contour_major, pmtiles_version, tippecanoe_version) = sys.argv[1:]
relief_maxzoom = int(relief_maxzoom)
lon0, lat0, lon1, lat1 = map(float, bbox.split(","))
UA = {"User-Agent": "curl/8"}

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA)).read()

attribution = json.loads(get("https://download.mapterhorn.com/attribution.json"))
known = {a["source"]: a for a in attribution}
z = 10
def tile(lon, lat):
    n = 2 ** z
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
x0, y1 = tile(lon0, lat0)
x1, y0 = tile(lon1, lat1)
found = set()
for x in range(x0, x1 + 1):
    for y in range(y0, y1 + 1):
        data = get(f"https://single-archive-tiles.mapterhorn.com/coverage/{z}/{x}/{y}.mvt")
        try:
            data = gzip.decompress(data)
        except OSError:
            pass
        found |= {s.decode() for s in re.findall(rb"[a-z0-9]{2,30}", data) if s.decode() in known}
relief_sources = [{k: known[s][k] for k in ("source", "name", "producer", "license", "resolution", "website")} for s in sorted(found)]

json.dump({
    "name": name,
    "bbox": {"lonMin": lon0, "latMin": lat0, "lonMax": lon1, "latMax": lat1},
    "osmDate": date,
    "files": {
        "carte.pmtiles": {"bytes": int(carte_b), "zoom": [0, int(os.environ["CARTE_MAXZOOM"])], "schema": "OpenMapTiles"},
        "relief.pmtiles": {"bytes": int(relief_b), "zoom": [0, relief_maxzoom], "encoding": "terrarium", "tileSize": 512},
        "courbes.pmtiles": {"bytes": int(courbes_b), "zoom": [int(os.environ["CONTOUR_MINZOOM"]), int(os.environ["CONTOUR_MAXZOOM"])], "layer": "contour", "attributes": ["ele", "major"], "majorEveryMeters": int(contour_major)},
        "circuits.geojson": {"bytes": int(circuits_b)},
    },
    "totalBytes": int(tot_b),
    "attributions": {
        "map": ["© OpenStreetMap", "© OpenMapTiles"],
        "relief": "© Mapterhorn (https://mapterhorn.com/attribution)",
        "reliefSources": relief_sources,
        "contours": "SRTM 1 arc-second (NASA), via AWS Terrain Tiles (skadi)",
    },
    "tools": {
        "planetiler": planetiler_image,
        "gdal": gdal_image,
        "tippecanoe": tippecanoe_version,
        "pmtiles": pmtiles_version,
    },
}, open(path, "w"), indent=2, ensure_ascii=False)
PY
echo "Paquet : $PKG"
