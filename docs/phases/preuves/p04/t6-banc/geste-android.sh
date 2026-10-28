#!/bin/sh
# THROWAWAY (phase 4, T6). Glisse le point 6 (index 5) sur emulator-5554,
# 2000 ms. Départ et arrivée en pixels : sortie de positions.py.
ADB="$HOME/Library/Android/sdk/platform-tools/adb -s emulator-5554"
HERE=$(cd "$(dirname "$0")" && pwd)
set -- $(python3 -I "$HERE/positions.py" android)
$ADB shell input swipe "$1" "$2" "$3" "$4" 2000
