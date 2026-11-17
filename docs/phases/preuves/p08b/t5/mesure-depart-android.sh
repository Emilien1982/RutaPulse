#!/bin/zsh
# C13: start of tracking on the 34.9 km circuit, Android emulator-5584, release, airplane mode.
# usage: mesure-depart-android.sh <outdir> ; frames in a new <outdir>/f-<ms since tap>.png via screencap loop
cd "$(dirname $0)"
OUT=$1; mkdir -p $OUT
./a.sh emu geo fix 5.984049 48.830921
./a.sh shell am force-stop fr.rutapulse.app
./a.sh shell am start -n fr.rutapulse.app/.MainActivity >/dev/null; sleep 8
./a.sh shell input tap 405 2260; sleep 2
./a.sh shell input tap 540 1240; sleep 4
./a.sh exec-out screencap -p > $OUT/avant-tap.png
T0=$(python3 -I -c "import time;print(time.time())")
./a.sh shell input tap 755 2233 &
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  ./a.sh exec-out screencap -p > $OUT/tmp.png
  T=$(python3 -I -c "import time;print(int((time.time()-$T0)*1000))")
  mv $OUT/tmp.png $OUT/f-$(printf %05d $T).png
done
wait
