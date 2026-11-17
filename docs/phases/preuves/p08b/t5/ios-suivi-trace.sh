#!/bin/zsh
# T5 iOS (iPhone 17, release): tracking screen with a replayed track: arrow and halo; panel 31b over it.
export PATH=$PATH:$HOME/.maestro/bin
U=DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D
cd "$(dirname $0)"
shot(){ xcrun simctl io $U screenshot ios-suivi-$1.png 2>/dev/null; }
xcrun simctl location $U clear
xcrun simctl terminate $U fr.rutapulse.app 2>/dev/null
xcrun simctl location $U set 48.727358,5.978104
xcrun simctl launch $U fr.rutapulse.app >/dev/null; sleep 9
maestro --device $U test flows/ios-demarrer-suivi.yaml 2>&1 | grep -E "FAILED|Assertion" | head -2
xcrun simctl location $U start --speed=4 $(cat ios-waypoints.txt); sleep 12
shot 1-en-route-fleche-halo-roue
maestro --device $U test flows/ios-ouvrir-panneau.yaml 2>&1 | grep -E "FAILED|Assertion" | head -2; sleep 1
shot 2-panneau-31b-ouvert-en-route
