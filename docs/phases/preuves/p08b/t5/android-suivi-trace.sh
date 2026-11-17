#!/bin/zsh
# T5 Android (emulator-5584, release, airplane mode): tracking of "Itinéraire du 17 nov." (594 m) with a replayed track (geo fix).
cd "$(dirname $0)"
shot(){ ./a.sh exec-out screencap -p > android-suivi-$1.png; }
./a.sh emu geo fix 5.974958 48.727872
./a.sh shell am force-stop fr.rutapulse.app
./a.sh shell am start -n fr.rutapulse.app/.MainActivity >/dev/null; sleep 8
./a.sh shell input tap 405 2260; sleep 2
./a.sh shell input tap 540 680; sleep 4
shot 0-infos
./a.sh shell input tap 755 2233; sleep 5
python3 -I rejeu-android.py trace-itineraire-liaison.json 0 137 &
RP=$!
sleep 10; shot 1-en-route-fleche-halo-roue
./a.sh shell input tap 954 1033; sleep 2; shot 2-panneau-31b-ouvert
./a.sh shell input tap 540 2190; sleep 2
sleep 12; shot 3-en-route-plus-loin
wait $RP
