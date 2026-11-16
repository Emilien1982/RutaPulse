#!/bin/zsh
# usage: a-ouverture.sh <label> <lat> <lon> : cold start of the app, then the first position (mock provider), screenshot 8 s later
cd "$(dirname $0)"
./a.sh shell am force-stop fr.rutapulse.app
./a-mock.sh $2 $3
./a.sh shell am start -n fr.rutapulse.app/.MainActivity >/dev/null; sleep 7
./a-mock.sh $2 $3; sleep 8
./a.sh exec-out screencap -p > android-ouverture-$1.png
./a-etat.sh
