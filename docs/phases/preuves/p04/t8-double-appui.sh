#!/bin/sh
# Phase 4, T8 : preuve rejouable du "double appui" sur Android.
# Question : deux appuis rapides sur la carte posent-ils un point ?
# Attendu : non (c'est un double appui, la carte zoome). Deux touches espacées
# de 0,4 s posent bien 2 points.
#
# Appareil : emulator-5554 uniquement. Version release installée, zone Nancy
# installée. Usage : sh docs/phases/preuves/p04/t8-double-appui.sh
# Code de sortie : 0 si tout est conforme, 1 sinon.
#
# Limite : chaque "input tap" démarre un processus Java sur l'appareil, ce qui
# ajoute un délai. Le script mesure donc l'écart réel entre les deux appuis
# (heure de l'appareil, en ms, à la fin de chaque "input tap") et l'affiche.

ADB="$HOME/Library/Android/sdk/platform-tools/adb -s emulator-5554"
APP=fr.rutapulse.app
LINK='rutapulse:///draft?lon=6.152&lat=48.672&zoom=15'
DUMP=${TMPDIR:-/tmp}/t8-double-appui-dump.xml
FAILS=0

now_ms() { $ADB shell 'date +%s%3N' | tr -d '\r'; }

dump() {
  $ADB shell uiautomator dump /sdcard/t8.xml >/dev/null 2>&1
  $ADB shell cat /sdcard/t8.xml >"$DUMP" 2>/dev/null
}

open_draft() {
  $ADB shell am force-stop $APP
  $ADB shell am start -W -a android.intent.action.VIEW -p $APP -d "$LINK" >/dev/null
  i=0
  while [ $i -lt 30 ]; do
    dump
    grep -q "Touchez le départ" "$DUMP" && return 0
    i=$((i + 1))
    sleep 1
  done
  echo "ERREUR : l'écran /draft ne s'ouvre pas"
  exit 2
}

# State of the summary read from the screen: "dash" or the figures.
summary() {
  dump
  if grep -q "pas encore d'itin" "$DUMP"; then
    echo "dash"
  else
    grep -o 'text="[0-9][0-9,]*[^"]*\(km\|m\)"' "$DUMP" | head -1
  fi
}

hint() {
  if grep -q "Touchez le départ" "$DUMP"; then echo "départ"
  elif grep -q "Touchez l'arrivée" "$DUMP"; then echo "arrivée"
  else echo "autre"; fi
}

check() { # label, expected, got
  if [ "$2" = "$3" ]; then echo "  OK    $1 : $3"
  else echo "  ECHEC $1 : attendu '$2', obtenu '$3'"; FAILS=$((FAILS + 1)); fi
}

echo "== Doubles appuis (même endroit) : aucun point ne doit être posé =="
# Android reads two touches less than 300 ms apart as a double tap. The pause
# asked for is only part of the real gap (each "input tap" takes about 90 ms),
# so the real gap decides: under 300 ms, no point must be placed; from 300 ms
# on they are two separate touches (reported, not judged here).
for gap in 0.05 0.10 0.15 0.20 0.25 0.29; do
  open_draft
  $ADB shell input tap 540 1000
  t1=$(now_ms)
  sleep "$gap"
  $ADB shell input tap 540 1000
  t2=$(now_ms)
  sleep 1.5
  s=$(summary)
  h=$(hint)
  real=$((t2 - t1))
  echo "- pause demandée ${gap} s, écart réel (fin de tap à fin de tap) ${real} ms"
  if [ "$real" -lt 300 ]; then
    check "résumé" "dash" "$s"
    check "consigne" "départ" "$h"
  else
    echo "  --    écart réel >= 300 ms : deux touches séparées, non jugé (résumé lu : $s)"
  fi
done

echo "== Deux touches espacées de 0,4 s, à deux endroits : 2 points =="
open_draft
$ADB shell input tap 540 1000
t1=$(now_ms)
sleep 0.4
$ADB shell input tap 540 1400
t2=$(now_ms)
sleep 3
s=$(summary)
echo "- écart mesuré $((t2 - t1)) ms ; résumé lu : $s"
if [ "$s" = "dash" ] || [ -z "$s" ]; then
  echo "  ECHEC 2 points : le résumé est resté à '—'"
  FAILS=$((FAILS + 1))
else
  echo "  OK    2 points : le résumé affiche des chiffres"
fi

$ADB exec-out screencap -p >"${TMPDIR:-/tmp}/t8-double-appui-final.png"
$ADB shell am force-stop $APP

if [ "$FAILS" -eq 0 ]; then echo "RESULTAT : OK"; exit 0; fi
echo "RESULTAT : $FAILS ECHEC(S)"
exit 1
