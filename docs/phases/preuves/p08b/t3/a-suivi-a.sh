#!/bin/zsh
# T3-a Android: open in the zone, replay a track (mock provider), gesture, button, double tap.
cd "$(dirname $0)"
shot(){ ./a.sh exec-out screencap -p > android-a-$1.png; }
./a.sh shell am force-stop fr.rutapulse.app
./a-mock.sh 48.727358 5.978104
./a.sh shell am start -n fr.rutapulse.app/.MainActivity >/dev/null; sleep 7
./a-mock.sh 48.727358 5.978104 30; sleep 7
shot 1-position-fixe; echo "1 position fixe:"; ./a-etat.sh
python3 -I a-mock-rejeu.py trace-4ms-480pts.json 0 60 30 &
RP=$!
sleep 12; shot 2-trace-suit; echo "2 trace:"; ./a-etat.sh
./a.sh shell input swipe 540 1500 540 900 300; sleep 3; shot 3-apres-glissement; echo "3 apres glissement:"; ./a-etat.sh
sleep 6; shot 3b-trace-continue; echo "3b (trace continue, carte ne doit pas suivre)"; ./a-etat.sh
./a.sh shell input tap 975 221; sleep 4; shot 4-apres-bouton; echo "4 apres bouton:"; ./a-etat.sh
./a.sh shell input tap 540 1000; ./a.sh shell input tap 540 1000; sleep 3; shot 5-apres-double-toucher; echo "5 apres double toucher:"; ./a-etat.sh
sleep 6; shot 5b-6s-apres; ./a-etat.sh
wait $RP
