#!/usr/bin/env bash
# Build a COMPLETE zone package (Valhalla routing tiles + elevation, then map,
# relief, contours and MTB routes) in one separate folder, and measure every
# step: duration, peak memory, peak disk, data received from the network.
# Output (ignored by git): sortie-paquet/
#   valhalla/  output of essais/01-calcul-hors-ligne/zone/fabriquer-zone.sh
#   carte/     output of fabriquer-carte.sh
#   mesures/   raw measures; mesures-paquet.txt is the summary table
# The default output of fabriquer-carte.sh (sortie/nancy-carte) is not touched.
#
# Optional inputs:
#   LORRAINE_PBF  existing lorraine.osm.pbf, copied instead of downloaded
#                 (its size is still counted as a download in the summary)
#   OUT_DIR       output folder (default: ./sortie-paquet)
#   BBOX, ZONE_NAME  zone limits "lon_min,lat_min,lon_max,lat_max" and name
#                 (only the Nancy area works for now: HGT tiles and Lorraine are fixed)
# Tools: docker, osmium, pmtiles, tippecanoe, python3, /usr/bin/time (GNU time on Linux).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ZONE1="$HERE/../../01-calcul-hors-ligne/zone"
OUT_DIR_ROOT="${OUT_DIR:-$HERE/sortie-paquet}"
ROOT="$OUT_DIR_ROOT"
unset OUT_DIR
M="$ROOT/mesures"
PBF_URL="https://download.geofabrik.de/europe/france/lorraine-latest.osm.pbf"
IMAGES=(ghcr.io/valhalla/valhalla:3.9.1 ghcr.io/onthegomap/planetiler:0.10.2 ghcr.io/osgeo/gdal:alpine-small-3.10.3)

rm -rf "$ROOT"; mkdir -p "$ROOT/valhalla/travail" "$ROOT/carte/travail" "$M"
if [ "$(uname)" = Darwin ]; then STAT_SIZE=(stat -f %z); else STAT_SIZE=(stat -c %s); fi
export MEASURE_DIR="$M" MEASURE_DISK_DIR="$ROOT" TIME_LOG="$M/time-current.log"
export STEP_HOOK="$HERE/mesurer-etape.sh"
: > "$M/etapes.tsv"

# --- measure the same way as the hook for the steps of this script
STEP_PREFIX="paquet/" "$STEP_HOOK" start "0a-images-docker"
for i in "${IMAGES[@]}"; do docker pull -q "$i" >/dev/null; done
STEP_PREFIX="paquet/" "$STEP_HOOK" end "0a-images-docker"

STEP_PREFIX="paquet/" "$STEP_HOOK" start "0b-extrait-lorraine"
if [ -n "${LORRAINE_PBF:-}" ] && [ -s "$LORRAINE_PBF" ]; then
  cp "$LORRAINE_PBF" "$ROOT/valhalla/travail/lorraine.osm.pbf"
else
  curl -fL --retry 3 -o "$ROOT/valhalla/travail/lorraine.osm.pbf" "$PBF_URL"
fi
STEP_PREFIX="paquet/" "$STEP_HOOK" end "0b-extrait-lorraine"
PBF_B=$("${STAT_SIZE[@]}" "$ROOT/valhalla/travail/lorraine.osm.pbf")
# the map script finds it already (copied there by this script, not downloaded again)
cp "$ROOT/valhalla/travail/lorraine.osm.pbf" "$ROOT/carte/travail/lorraine.osm.pbf"

# --- Valhalla + elevation (essay 1 script)
STEP_PREFIX="valhalla/" OUT_DIR="$ROOT/valhalla" bash "$ZONE1/fabriquer-zone.sh"

# --- map, relief, contours, routes
STEP_PREFIX="carte/" OUT_DIR="$ROOT/carte" MEASURE_Z13=0 bash "$HERE/fabriquer-carte.sh"

# --- summary
IMG_B=""
for i in "${IMAGES[@]}"; do IMG_B+="$i $(docker image inspect --format '{{.Size}}' "$i")"$'\n'; done
HGT_GZ_B=0
for t in N48E005 N48E006; do
  b=$(curl -sIL "https://elevation-tiles-prod.s3.amazonaws.com/skadi/N48/$t.hgt.gz" | awk 'tolower($1) == "content-length:" {v = $2} END {print v + 0}')
  HGT_GZ_B=$((HGT_GZ_B + b))
done
CORES=$(getconf _NPROCESSORS_ONLN)
python3 -I - "$M/etapes.tsv" "$ROOT/mesures/mesures-paquet.txt" "$PBF_B" "$HGT_GZ_B" "$CORES" \
  "$("${STAT_SIZE[@]}" "$ROOT/carte/travail/relief.pmtiles")" "$ROOT/carte/travail/planetiler/sources" \
  "$ROOT/carte/nancy-carte" "$ROOT/valhalla/nancy" "$IMG_B" <<'PY'
import os, sys
tsv, out, pbf_b, hgt_gz, cores, relief_b, annexes_dir, carte_pkg, valhalla_pkg, img = sys.argv[1:]
def mib(x): return x / 1048576
def tree(d): return sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(d) for f in fs)
rows = [l.rstrip("\n").split("\t") for l in open(tsv) if l.strip()]
L = []
L.append(f"Machine : {os.uname().sysname} {os.uname().machine}, {cores} coeurs logiques")
L.append("")
L.append("Memoire : Docker = max de MemUsage (docker stats, 1 s) ; Mac/Linux = maximum resident set size (/usr/bin/time)")
L.append("Disque pic = dossier de sortie complet (du, toutes les 5 s). Reseau = octets recus par l'interface (indicatif).")
L.append("")
L.append(f"{'etape':<36}{'duree s':>8}{'disque Mo':>11}{'reseau Mo':>11}  memoire pic (Mo)")
for name, secs, dock, host, disk, net in rows:
    mem = "; ".join(x for x in (("docker: " + dock) if dock != "-" else "", ("hote: " + host) if host != "-" else "") if x) or "-"
    L.append(f"{name:<36}{secs:>8}{disk:>11}{net:>11}  {mem}")
tot = sum(int(r[1]) for r in rows)
L.append(f"{'TOTAL':<36}{tot:>8}  ({tot/60:.1f} min)")
L.append(f"Disque pic de tout le pipeline : {max(int(r[4]) for r in rows)} Mo (dossier de sortie, hors images Docker)")
L.append("")
L.append("Volume TELECHARGE (octets exacts de fichiers ; images = taille decompressee locale)")
annexes = tree(annexes_dir) if os.path.isdir(annexes_dir) else 0
hgt_carte = 0
dl = [("extrait Geofabrik Lorraine", int(pbf_b)),
      ("annexes Planetiler (sources/)", annexes),
      ("altitude Valhalla (tuiles .hgt.gz, Content-Length)", int(hgt_gz)),
      ("altitude carte (memes .hgt.gz, 2e telechargement par fabriquer-carte.sh)", int(hgt_gz)),
      ("relief Mapterhorn (relief.pmtiles, sans les en-tetes)", int(relief_b))]
for k, v in dl: L.append(f"  {k:<72}{mib(v):>9.1f} Mo")
L.append(f"  {'sous-total donnees (sans images)':<72}{mib(sum(v for _, v in dl)):>9.1f} Mo")
imgs = [l.rsplit(" ", 1) for l in img.strip().split("\n")]
for k, v in imgs: L.append(f"  image {k:<66}{mib(int(v)):>9.1f} Mo")
L.append(f"  {'sous-total images (taille decompressee)':<72}{mib(sum(int(v) for _, v in imgs)):>9.1f} Mo")
L.append("")
L.append("Paquets produits")
L.append(f"  carte : {mib(tree(carte_pkg)):.1f} Mo ; valhalla+altitude : {mib(tree(valhalla_pkg)):.1f} Mo")
open(out, "w").write("\n".join(L) + "\n")
print("\n".join(L))
PY
cp "$ROOT/mesures/mesures-paquet.txt" "$ROOT/mesures-paquet.txt"
