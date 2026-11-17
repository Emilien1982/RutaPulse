#!/bin/zsh
# usage: ios-essai.sh <puck js|native|own> <track native|manual> <zoom> <label>
export PATH=$PATH:$HOME/.maestro/bin
U=DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D
cd "$(dirname $0)"
L=$4
xcrun simctl location $U clear >/dev/null 2>&1
xcrun simctl terminate $U fr.rutapulse.app 2>/dev/null
pkill -P $$ 2>/dev/null
xcrun simctl location $U set 48.727358,5.978104
xcrun simctl launch $U fr.rutapulse.app >/dev/null; sleep 5
xcrun simctl spawn $U log stream --level debug --predicate 'eventMessage CONTAINS "E8B"' > ios-log-$L.txt 2>&1 &
LP=$!
sleep 2
xcrun simctl openurl $U "rutapulse://essai?puck=$1&track=$2&zoom=$3"; sleep 8
xcrun simctl io $U screenshot ios-$L-1-position-fixe.png 2>/dev/null
xcrun simctl location $U start --speed=4 $(cat ios-waypoints.txt); sleep 12
xcrun simctl io $U screenshot ios-$L-2-trace-t12.png 2>/dev/null
maestro --device $U test flows/ios-swipe.yaml > maestro-$L-swipe.txt 2>&1; sleep 4
xcrun simctl io $U screenshot ios-$L-3-apres-geste.png 2>/dev/null
maestro --device $U test flows/ios-suit.yaml > maestro-$L-suit.txt 2>&1; sleep 6
xcrun simctl io $U screenshot ios-$L-4-apres-bouton-suit.png 2>/dev/null
kill $LP
xcrun simctl location $U clear >/dev/null 2>&1
