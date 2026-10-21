#!/bin/bash
# Every second: screenshot of the simulator, OCR (Vision), log the indication seen.
# Usage: observer-ios.sh [duration_s]   (default: until Ctrl-C)
# Env: PATTERN (regex of the lines to keep, default "Indication [0-9]+")
# Log: ../journaux/ios-observateur.tsv (or $JOURNAL): Mac ms taken before the screenshot, matching text
# (several matching lines on one screenshot are joined with " | "; failed capture: "ERREUR_CAPTURE")
# A PNG is kept in ../journaux/captures-ios/ each time the matching text changes.
set -u
UDID="DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D"
PATTERN="${PATTERN:-Indication [0-9]+}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OCR="$HERE/sortie/ocr"
[ -x "$OCR" ] || { mkdir -p "$HERE/sortie"; swiftc -O "$HERE/ocr.swift" -o "$OCR" || exit 1; }
mkdir -p "$HERE/../journaux/captures-ios"
CAP="$HERE/../journaux/captures-ios"
LOG="${JOURNAL:-$HERE/../journaux/ios-observateur.tsv}"
: > "$LOG"
TMP="$(mktemp -d)/shot.png"
DURATION="${1:-0}"

now_ms() { perl -MTime::HiRes=time -e 'printf "%d\n", time()*1000'; }

T0=$(now_ms)
n=0
prev="__none__"
while :; do
  target=$((T0 + n * 1000))
  [ "$DURATION" -gt 0 ] && [ "$target" -ge $((T0 + DURATION * 1000)) ] && break
  wait_ms=$((target - $(now_ms)))
  [ "$wait_ms" -gt 0 ] && sleep "$(perl -e "printf '%.3f', $wait_ms/1000")"
  ts=$(now_ms)
  if xcrun simctl io "$UDID" screenshot "$TMP" </dev/null >/dev/null 2>&1; then
    text=$("$OCR" "$TMP" 2>/dev/null | grep -E "$PATTERN" | paste -sd'|' - | sed 's/|/ | /g')
    printf '%s\t%s\n' "$ts" "$text" >> "$LOG"
    if [ "$text" != "$prev" ] && [ -n "$text" ]; then
      cp "$TMP" "$CAP/$ts.png"
    fi
    prev="$text"
  else
    printf '%s\t%s\n' "$ts" "ERREUR_CAPTURE" >> "$LOG"
  fi
  n=$((n + 1))
done
echo "done: $n readings in $LOG"
