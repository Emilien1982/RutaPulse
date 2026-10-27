#!/bin/sh
# THROWAWAY (phase 4, T1). Drag the middle marker on emulator-5554 (Pixel 6, 1080x2400).
# Marker at the map center: (540, 1072) px. Usage: sh p04-t1-glisser-android.sh <out.json> [variant tap]
# Replay: sh e2e/p04-t1-glisser-android.sh /tmp/android-release-1.json
ADB="$HOME/Library/Android/sdk/platform-tools/adb -s emulator-5554"
OUT=${1:-android.json}
$ADB shell am force-stop fr.rutapulse.app
$ADB shell am start -n fr.rutapulse.app/.MainActivity >/dev/null
sleep 15
$ADB shell input swipe 540 1072 790 822 2000
sleep 4
$ADB shell cat /data/data/fr.rutapulse.app/files/essai/glisser.json > "$OUT"
