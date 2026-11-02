#!/bin/sh
# THROWAWAY (phase 5, T1). Part B on Android emulator-5554 (1080x2400, marker 1 at the centre (540,1200)).
# Usage: sh p05-t1-b-android.sh <variant> <out prefix> [tap]   ("tap": tap the marker first = chosen point)
ADB="$HOME/Library/Android/sdk/platform-tools/adb -s emulator-5554"
HERE=$(cd "$(dirname "$0")" && pwd)
sh "$HERE/p05-t1-android.sh" "{\"run\":\"b\",\"variant\":\"$1\"}"
sleep 15
$ADB exec-out screencap -p > "$2-avant.png"
if [ "$3" = tap ]; then $ADB shell input tap 540 1200; sleep 1; $ADB exec-out screencap -p > "$2-apres-tap.png"; fi
$ADB shell input swipe 540 1200 790 950 3000 &
PID=$!
i=0
while kill -0 $PID 2>/dev/null; do
  i=$((i+1)); $ADB exec-out screencap -p > "$2-seq-$(printf %02d $i).png"
done
wait
sleep 1; $ADB exec-out screencap -p > "$2-apres.png"
$ADB shell cat /data/data/fr.rutapulse.app/files/essai/b-$1.json > "$2.json"
python3 -I - "$2" <<'PY'
import glob, hashlib, os, shutil, sys
p = sys.argv[1]
fr = sorted(glob.glob(p + "-seq-*.png"))
h = [hashlib.md5(open(f, "rb").read()).hexdigest() for f in fr]
moving = [i for i in range(1, len(fr)) if h[i] != h[i - 1] and h.count(h[i]) == 1]
if moving:
    a = moving[int(len(moving) * 0.4)]; b = moving[int(len(moving) * 0.7)]
    shutil.copy(fr[a], p + "-pendant-1.png"); shutil.copy(fr[b], p + "-pendant-2.png")
for f in fr:
    os.remove(f)
PY
