#!/bin/zsh
# T5 iOS (iPhone 17, release): Carte tab with a replayed track: dot with halo, arrow when moving,
# "suit ma position", rest after a gesture, button again. Then the tracking screen with the same track.
export PATH=$PATH:$HOME/.maestro/bin
U=DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D
cd "$(dirname $0)"
M(){ maestro --device $U test flows/$1.yaml 2>&1 | grep -E "COMPLETED|FAILED|Assertion" | head -2; }
shot(){ xcrun simctl io $U screenshot ios-carte-$1.png 2>/dev/null; }
xcrun simctl location $U clear
xcrun simctl terminate $U fr.rutapulse.app 2>/dev/null
xcrun simctl location $U set 48.727358,5.978104
xcrun simctl launch $U fr.rutapulse.app >/dev/null; sleep 9
shot 1-position-fixe-sans-fleche; echo "1 fixe, etat:"; M ios-etat-suit
xcrun simctl location $U start --speed=4 $(cat ios-waypoints.txt); sleep 14
shot 2-trace-fleche-halo-suit; echo "2 trace, etat:"; M ios-etat-suit
M ios-swipe; sleep 3; shot 3-apres-glissement-repos; echo "3 apres glissement, etat repos:"; M ios-etat-repos
sleep 8; shot 3b-trace-continue-reste-au-repos
M ios-recentrer; sleep 3; shot 4-apres-bouton-suit; echo "4 apres bouton, etat suit:"; M ios-etat-suit
