#!/bin/sh
# THROWAWAY (phase 5, T1). Run an essay on the iPhone 17 simulator (release build installed).
# Usage: sh p05-t1-ios.sh '{"run":"a"}'
UDID=DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D
xcrun simctl terminate $UDID fr.rutapulse.app 2>/dev/null
DATA=$(xcrun simctl get_app_container $UDID fr.rutapulse.app data)
rm -rf "$DATA/Documents/essai"; mkdir -p "$DATA/Documents/essai"
printf '%s' "$1" > "$DATA/Documents/essai/demande.json"
xcrun simctl launch $UDID fr.rutapulse.app >/dev/null
