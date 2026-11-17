#!/bin/zsh
# T5 iOS (iPhone 17, release): tracking of "Itinéraire du 4 nov." (622 m) with the replayed track (gap of 60 m in the middle),
# one screenshot every 3 s. Used for the designer (mockup 30: wheel, yellow panel, gap).
export PATH=$PATH:$HOME/.maestro/bin
U=DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D
cd "$(dirname $0)"
xcrun simctl terminate $U fr.rutapulse.app 2>/dev/null
xcrun simctl location $U set 48.751513,5.966751
xcrun simctl launch $U fr.rutapulse.app >/dev/null; sleep 9
maestro --device $U test flows/ios-demarrer-4nov.yaml 2>&1 | grep -E "FAILED|Assertion" | head -2
python3 -I ../../../../../essais/08-suivi-velo/t3-outils/ios_replay.py trace-4nov-5m-ecart60m.json 0 126 &
RP=$!
for i in 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21; do
  sleep 3; xcrun simctl io $U screenshot ios-4nov-$i.png 2>/dev/null
done
kill $RP 2>/dev/null; wait 2>/dev/null
