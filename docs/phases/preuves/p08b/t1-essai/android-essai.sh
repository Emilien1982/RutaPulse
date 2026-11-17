#!/bin/zsh
# usage: android-essai.sh <puck js|native|own> <track native|manual> <zoom> <label>
# Only the emulator emulator-5584 is ever addressed.
export ANDROID_HOME=$HOME/Library/Android/sdk
A(){ $ANDROID_HOME/platform-tools/adb -s emulator-5584 "$@"; }
cd "$(dirname $0)"
L=$4
A shell am force-stop fr.rutapulse.app
A emu geo fix 5.978104 48.727358 >/dev/null
A logcat -c
A shell am start -a android.intent.action.VIEW -d "rutapulse://essai?puck=$1\&track=$2\&zoom=$3" fr.rutapulse.app >/dev/null
sleep 8
A exec-out screencap -p > android-$L-1-position-fixe.png
python3 -I rejeu-android.py trace-4ms-480pts.json 0 50 &
RP=$!
sleep 14
A exec-out screencap -p > android-$L-2-trace-t14.png
A shell input swipe 540 1500 540 900 300
sleep 4
A exec-out screencap -p > android-$L-3-apres-geste.png
A shell uiautomator dump /sdcard/u.xml >/dev/null
XY=$(A shell cat /sdcard/u.xml | python3 -I -c "
import sys,re
s=sys.stdin.read()
for m in re.finditer(r'text=\"SUIT\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"',s):
    a=list(map(int,m.groups())); print((a[0]+a[2])//2,(a[1]+a[3])//2)
")
echo "SUIT at $XY" > android-$L-tap.txt
A shell input tap $=XY 2>/dev/null || A shell input tap ${=XY}
sleep 6
A exec-out screencap -p > android-$L-4-apres-bouton-suit.png
wait $RP
A logcat -d -s ReactNativeJS:V | grep E8B | cut -c20- > android-log-$L.txt
