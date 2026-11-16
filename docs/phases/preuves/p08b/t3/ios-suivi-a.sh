#!/bin/zsh
# T3-a iOS: open in the zone, replay a track, gesture, button, double tap. States read through the accessibility label.
export PATH=$PATH:$HOME/.maestro/bin
U=DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D
cd "$(dirname $0)"
M(){ maestro --device $U test flows/$1.yaml 2>&1 | grep -E "COMPLETED|FAILED|Assertion" | head -2; }
shot(){ xcrun simctl io $U screenshot ios-a-$1.png 2>/dev/null; }
xcrun simctl location $U clear
xcrun simctl terminate $U fr.rutapulse.app 2>/dev/null
xcrun simctl location $U set 48.727358,5.978104
xcrun simctl launch $U fr.rutapulse.app >/dev/null; sleep 9
shot 1-position-fixe; echo "1 fixe, etat:"; M ios-etat-suit
xcrun simctl location $U start --speed=4 $(cat ios-waypoints.txt); sleep 14
shot 2-trace-suit; echo "2 trace, etat:"; M ios-etat-suit
M ios-swipe; sleep 3; shot 3-apres-glissement; echo "3 apres glissement, etat repos:"; M ios-etat-repos
sleep 12; shot 3b-trace-continue-apres-glissement
M ios-recentrer; sleep 3; shot 4-apres-bouton; echo "4 apres bouton, etat suit:"; M ios-etat-suit
