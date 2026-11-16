#!/bin/zsh
# usage: ios-ouverture.sh <label> <lat> <lon>  : opens the app with the simulated position, screenshot after 9 s
U=DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D
cd "$(dirname $0)"
xcrun simctl terminate $U fr.rutapulse.app 2>/dev/null
xcrun simctl location $U set $2,$3
xcrun simctl launch $U fr.rutapulse.app >/dev/null; sleep 9
xcrun simctl io $U screenshot ios-ouverture-$1.png 2>/dev/null
