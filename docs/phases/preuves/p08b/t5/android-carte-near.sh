#!/bin/zsh
# T5 Android (emulator-5584, release, airplane mode): near framing, far, refused state (mock "fused" provider, see LISEZMOI).
cd "$(dirname $0)"
shot(){ ./a.sh exec-out screencap -p > android-carte-$1.png; }
open_at(){ ./a.sh shell am force-stop fr.rutapulse.app; ./a-mock.sh $1 $2 30; ./a.sh shell am start -n fr.rutapulse.app/.MainActivity >/dev/null; sleep 7; ./a-mock.sh $1 $2 30; sleep 7; }
open_at 48.70 6.554; shot 5-near-est-2km5; echo "near est:"; ./a-etat.sh
open_at 48.3845 6.2; shot 6-near-sud-9km5; echo "near sud:"; ./a-etat.sh
open_at 48.335 6.2; shot 7-loin-15km-toute-la-zone; echo "loin:"; ./a-etat.sh
./a.sh shell pm revoke fr.rutapulse.app android.permission.ACCESS_FINE_LOCATION
./a.sh shell pm revoke fr.rutapulse.app android.permission.ACCESS_COARSE_LOCATION
sleep 2; ./a.sh shell am force-stop fr.rutapulse.app; ./a.sh shell am start -n fr.rutapulse.app/.MainActivity >/dev/null; sleep 8
shot 8-position-refusee; echo "refusee:"; ./a-etat.sh
./a.sh shell pm grant fr.rutapulse.app android.permission.ACCESS_FINE_LOCATION
./a.sh shell pm grant fr.rutapulse.app android.permission.ACCESS_COARSE_LOCATION
