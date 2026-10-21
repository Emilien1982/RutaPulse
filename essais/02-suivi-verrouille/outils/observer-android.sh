#!/bin/bash
# Every second, read the notifications of the app on the emulator.
# Usage: observer-android.sh [duration_s]   (default: until Ctrl-C)
# Env: PKG (default fr.vttnav.essai2)
# Log: ../journaux/android-observateur.tsv (or $JOURNAL): Mac ms, count, texts
# If adb fails the line is: Mac ms, "erreur", "erreur".
set -u
set -o pipefail
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$ANDROID_HOME/platform-tools/adb"
PKG="${PKG:-fr.vttnav.essai2}"
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$HERE/../journaux"
LOG="${JOURNAL:-$HERE/../journaux/android-observateur.tsv}"
: > "$LOG"
DURATION="${1:-0}"

now_ms() { perl -MTime::HiRes=time -e 'printf "%d\n", time()*1000'; }

T0=$(now_ms)
n=0
while :; do
  target=$((T0 + n * 1000))
  [ "$DURATION" -gt 0 ] && [ "$target" -ge $((T0 + DURATION * 1000)) ] && break
  wait_ms=$((target - $(now_ms)))
  [ "$wait_ms" -gt 0 ] && sleep "$(perl -e "printf '%.3f', $wait_ms/1000")"
  ts=$(now_ms)
  res=$("$ADB" -s emulator-5554 shell dumpsys notification --noredact </dev/null | python3 "$HERE/lire-notifs.py" "$PKG") \
    || res=$'erreur\terreur'
  printf '%s\t%s\n' "$ts" "$res" >> "$LOG"
  n=$((n + 1))
done
echo "done: $n readings in $LOG"
