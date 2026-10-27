#!/bin/sh
# Replays the 5 exact app requests (requetes/) on Valhalla 3.9.1 (Docker),
# on the zone v3 package. Writes ../mac-R1.json .. ../mac-R5.json.
# Usage: sh rejouer-sur-mac.sh <folder holding valhalla_tiles.tar and elevation/>
# Expected SHA-256 of valhalla_tiles.tar: 7fa29249411c75fd0cc651b4f0e06baf9dbd80109eea7df51b8116b7ceb07a44
set -eu
ZONE=$(cd "$1" && pwd)
HERE=$(cd "$(dirname "$0")" && pwd)
IMAGE=ghcr.io/valhalla/valhalla:3.9.1
CFG=$(mktemp -d)
docker run --rm "$IMAGE" valhalla_build_config \
  --mjolnir-tile-dir /pkg/tiles-unused \
  --mjolnir-tile-extract /pkg/valhalla_tiles.tar \
  --additional-data-elevation /pkg/elevation > "$CFG/valhalla.json"
for n in 1 2 3 4 5; do
  docker run --rm -v "$ZONE:/pkg:ro" -v "$CFG:/cfg:ro" -v "$HERE/requetes:/req:ro" "$IMAGE" \
    sh -c "valhalla_service /cfg/valhalla.json route \"\$(cat /req/requete-R$n.json)\"" \
    | python3 -I -c 'import json,sys; t=sys.stdin.read(); print(json.dumps(json.JSONDecoder().raw_decode(t[t.index("{"):])[0], ensure_ascii=False))' \
    > "$HERE/../mac-R$n.json"
  echo "R$n : mac-R$n.json écrit"
done
rm -rf "$CFG"
