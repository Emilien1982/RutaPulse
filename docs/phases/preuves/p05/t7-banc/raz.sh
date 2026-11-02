#!/bin/sh
# THROWAWAY (phase 5, T7). Efface les résultats ET la demande de l'app (sans demande, l'app est celle de la phase). À lancer avant une série et à la fin.
# Usage : sh raz.sh <ios|android>
if [ "$1" = ios ]; then
  D="$(xcrun simctl get_app_container DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D fr.rutapulse.app data)/Documents"; rm -rf "$D/banc-p05" "$D/banc-p05-demande.json"
else
  ADB="$HOME/Library/Android/sdk/platform-tools/adb -s emulator-5554"
  $ADB root >/dev/null 2>&1; sleep 2
  $ADB shell rm -rf /data/data/fr.rutapulse.app/files/banc-p05 /data/data/fr.rutapulse.app/files/banc-p05-demande.json
fi
