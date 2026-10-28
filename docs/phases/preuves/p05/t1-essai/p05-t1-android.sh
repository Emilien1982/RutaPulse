#!/bin/sh
# THROWAWAY (phase 5, T1). Run an essay on the Android emulator-5554 (release build installed).
# Usage: sh p05-t1-android.sh '{"run":"a"}'   (or '{"run":"b","variant":"inner"}')
# The app reads <files>/essai/demande.json at start-up. Needs `adb root`.
ADB="$HOME/Library/Android/sdk/platform-tools/adb -s emulator-5554"
$ADB root >/dev/null; sleep 2
$ADB shell am force-stop fr.rutapulse.app
$ADB shell "rm -rf /data/data/fr.rutapulse.app/files/essai; mkdir -p /data/data/fr.rutapulse.app/files/essai"
printf '%s' "$1" > /tmp/p05-demande.json
$ADB push /tmp/p05-demande.json /data/local/tmp/demande.json >/dev/null
UID_APP=$($ADB shell stat -c %u /data/data/fr.rutapulse.app/files)
$ADB shell "cp /data/local/tmp/demande.json /data/data/fr.rutapulse.app/files/essai/demande.json; chown -R $UID_APP:$UID_APP /data/data/fr.rutapulse.app/files/essai"
$ADB shell am start -n fr.rutapulse.app/.MainActivity >/dev/null
