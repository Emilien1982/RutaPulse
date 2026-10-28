#!/bin/sh
# THROWAWAY (phase 4, T6). Pose la demande, lance l'app sur /draft, attend
# l'itinéraire, fait UN geste (ou le témoin), récupère les JSON.
# Usage : sh banc.sh <ios|android> <geste|temoin> <dossier_de_sortie>
# Un lancement = un geste ou un témoin (l'app est relancée à froid).
# Nombres à adapter si l'écran change : voir positions.py.
PLAT=$1; MODE=$2; OUT=${3:-sortie-$PLAT}
HERE=$(cd "$(dirname "$0")" && pwd)
UDID=DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D
export PATH="$HOME/.maestro/bin:$PATH"
APP=fr.rutapulse.app
ADB="$HOME/Library/Android/sdk/platform-tools/adb -s emulator-5554"
mkdir -p "$OUT"

# La demande : le geste utilise demande.json tel quel, le témoin y ajoute temoin_ms.
if [ "$MODE" = temoin ]; then
  python3 -I -c "import json,sys; d=json.load(open(sys.argv[1])); d['temoin_ms']=3000; print(json.dumps(d))" "$HERE/demande.json" > "$OUT/.demande.json"
else
  cp "$HERE/demande.json" "$OUT/.demande.json"
fi

if [ "$PLAT" = ios ]; then
  DOC="$(xcrun simctl get_app_container $UDID $APP data)/Documents"
  xcrun simctl terminate $UDID $APP 2>/dev/null
  rm -f "$DOC/banc-p04/pret.json"
  cp "$OUT/.demande.json" "$DOC/banc-p04-demande.json"
  xcrun simctl launch $UDID $APP >/dev/null
  sleep 6
  xcrun simctl openurl $UDID rutapulse:///draft
  for i in $(seq 1 90); do [ -f "$DOC/banc-p04/pret.json" ] && break; sleep 1; done
  [ -f "$DOC/banc-p04/pret.json" ] || { echo "pas d'itinéraire prêt après 90 s"; exit 1; }
  sleep 8
  if [ "$MODE" = geste ]; then
    maestro --device $UDID test "$HERE/geste-ios.yaml" >/dev/null || echo "Maestro a échoué"
    sleep 12
  else
    sleep 6
  fi
  mkdir -p "$OUT/banc-p04"
  cp "$DOC"/banc-p04/*.json "$OUT/banc-p04/"
else
  $ADB root >/dev/null 2>&1; sleep 2
  DOC=/data/data/$APP/files
  $ADB shell am force-stop $APP
  $ADB shell rm -f $DOC/banc-p04/pret.json
  $ADB push "$OUT/.demande.json" /data/local/tmp/banc-p04-demande.json >/dev/null
  $ADB shell "cp /data/local/tmp/banc-p04-demande.json $DOC/banc-p04-demande.json"
  $ADB shell am start -n $APP/.MainActivity >/dev/null
  sleep 8
  $ADB shell am start -a android.intent.action.VIEW -d rutapulse:///draft $APP >/dev/null
  for i in $(seq 1 90); do $ADB shell "[ -f $DOC/banc-p04/pret.json ]" && break; sleep 1; done
  $ADB shell "[ -f $DOC/banc-p04/pret.json ]" || { echo "pas d'itinéraire prêt après 90 s"; exit 1; }
  sleep 8
  if [ "$MODE" = geste ]; then
    sh "$HERE/geste-android.sh"
    sleep 12
  else
    sleep 6
  fi
  mkdir -p "$OUT/banc-p04"
  for f in $($ADB shell "ls $DOC/banc-p04" | tr -d '\r'); do
    $ADB shell cat $DOC/banc-p04/$f > "$OUT/banc-p04/$f"
  done
fi
echo "Résultats dans $OUT/banc-p04 :"; ls "$OUT/banc-p04"
