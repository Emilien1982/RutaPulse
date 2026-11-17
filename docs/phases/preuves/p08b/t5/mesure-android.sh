#!/bin/zsh
# usage: mesure-android.sh <label> <n>   (emulator-5584 only; cold starts of the release app)
export ANDROID_HOME=$HOME/Library/Android/sdk
A(){ $ANDROID_HOME/platform-tools/adb -s emulator-5584 "$@"; }
for i in $(seq 1 $2); do
  A shell am force-stop fr.rutapulse.app
  A emu geo fix 5.978104 48.727358 >/dev/null
  A logcat -c
  A shell am start -n fr.rutapulse.app/.MainActivity >/dev/null
  sleep 9
  echo "$1 run $i: $(A logcat -d -s ReactNativeJS:V | grep C13T5 | cut -c20-)"
done
