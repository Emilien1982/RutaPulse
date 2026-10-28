#!/bin/sh
# THROWAWAY (phase 4, T6). Efface les résultats de l'app avant une série.
# Usage : sh raz.sh <ios|android>
if [ "$1" = ios ]; then
  rm -rf "$(xcrun simctl get_app_container DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D fr.rutapulse.app data)/Documents/banc-p04"
else
  ADB="$HOME/Library/Android/sdk/platform-tools/adb -s emulator-5554"
  $ADB root >/dev/null 2>&1; sleep 2
  $ADB shell rm -rf /data/data/fr.rutapulse.app/files/banc-p04
fi
