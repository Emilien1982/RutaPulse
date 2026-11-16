#!/bin/zsh
# usage: ios-recentrer-near.sh <label> <lat> <lon> : open out of the zone, drag, touch "Recentrer"
export PATH=$PATH:$HOME/.maestro/bin
U=DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D
cd "$(dirname $0)"
./ios-ouverture.sh $1 $2 $3
maestro --device $U test flows/ios-swipe.yaml > maestro-$1-swipe.txt 2>&1; sleep 2
xcrun simctl io $U screenshot ios-recentrer-$1-1-apres-glissement.png 2>/dev/null
maestro --device $U test flows/ios-recentrer.yaml > maestro-$1-recentrer.txt 2>&1; sleep 3
xcrun simctl io $U screenshot ios-recentrer-$1-2-apres-recentrer.png 2>/dev/null
