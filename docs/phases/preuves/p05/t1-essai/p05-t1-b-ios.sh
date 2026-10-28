#!/bin/sh
# THROWAWAY (phase 5, T1). Part B on iOS. Usage: sh p05-t1-b-ios.sh <variant> <out prefix>
# Opens the essay screen, drags marker 1 (slow swipe), takes 2 screenshots during the gesture.
UDID=DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D
HERE=$(cd "$(dirname "$0")" && pwd)
sh "$HERE/p05-t1-ios.sh" "{\"run\":\"b\",\"variant\":\"$1\"}"
sleep 14
xcrun simctl io $UDID screenshot "$2-avant.png" 2>/dev/null
"$HOME/.maestro/bin/maestro" --device $UDID test "$HERE/${3:-p05-t1-glisser-ios.yaml}" > "$2-maestro.txt" 2>&1 &
# Maestro needs a few seconds to start: take screenshots until it ends, keep them all.
i=0
while kill -0 $! 2>/dev/null; do
  i=$((i+1)); xcrun simctl io $UDID screenshot "$2-seq-$(printf %02d $i).png" 2>/dev/null
done
wait
sleep 1; xcrun simctl io $UDID screenshot "$2-apres.png" 2>/dev/null
DATA=$(xcrun simctl get_app_container $UDID fr.rutapulse.app data)
cp "$DATA/Documents/essai/b-$1.json" "$2.json"
# Keep the 'avant', 'apres' and two frames taken during the drag (frames that differ from their neighbours,
# at 40 % and 70 % of the moving part); delete the other frames of the sequence.
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
