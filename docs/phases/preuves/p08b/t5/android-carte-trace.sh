#!/bin/zsh
# T5 Android (emulator-5584, release, airplane mode): Carte tab with a replayed track on the mock "fused" provider
# (no heading available through this provider: no arrow expected, see LISEZMOI), accuracy 100 m for a visible halo.
cd "$(dirname $0)"
shot(){ ./a.sh exec-out screencap -p > android-carte-$1.png; }
./a.sh shell am force-stop fr.rutapulse.app
./a-mock.sh 48.727358 5.978104 100
./a.sh shell am start -n fr.rutapulse.app/.MainActivity >/dev/null; sleep 7
./a-mock.sh 48.727358 5.978104 100; sleep 7
shot 1-position-fixe-halo-100m; echo "1:"; ./a-etat.sh
python3 -I a-mock-rejeu.py trace-4ms-480pts.json 0 60 100 &
RP=$!
sleep 12; shot 2-trace-suit; echo "2 trace:"; ./a-etat.sh
./a.sh shell input swipe 540 1500 540 900 300; sleep 3; shot 3-apres-glissement-repos; echo "3 apres glissement:"; ./a-etat.sh
sleep 6; shot 3b-trace-continue-reste-au-repos
./a.sh shell input tap 975 221; sleep 4; shot 4-apres-bouton-suit; echo "4 apres bouton:"; ./a-etat.sh
wait $RP
