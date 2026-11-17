#!/bin/zsh
# usage: mesure-ios.sh <label> <n>   (iPhone 17 simulator; cold starts of the release app)
D=DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D
for i in $(seq 1 $2); do
  xcrun simctl terminate $D fr.rutapulse.app >/dev/null 2>&1
  xcrun simctl location $D set 48.727358,5.978104 >/dev/null
  xcrun simctl spawn $D log stream --level debug --predicate 'eventMessage CONTAINS "C13T5"' > "$TMPOUT.$i" 2>&1 &
  LP=$!
  sleep 2
  xcrun simctl launch $D fr.rutapulse.app >/dev/null
  sleep 8
  kill $LP
  echo "$1 run $i: $(grep -o 'C13T5 MAP.*' "$TMPOUT.$i" | head -1)"
done
