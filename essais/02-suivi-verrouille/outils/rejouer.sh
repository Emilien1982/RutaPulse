#!/bin/bash
# Replay the trace, one point per second, with drift correction.
# Usage: rejouer.sh android|ios [first_point=0] [count=3600]
# Log: ../journaux/<platform>-rejeu.tsv (or $JOURNAL): Mac ms before sending, i, d, lat, lon, ok|echec
# Android: by default a mock "gps" test provider (emu geo fix answers OK but the
# GNSS position stays at Mountain View on emulator 37.1.11). MODE=geofix forces emu geo fix.
set -u
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$ANDROID_HOME/platform-tools/adb"
UDID="DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D"
HERE="$(cd "$(dirname "$0")" && pwd)"
TRACE="$HERE/sortie/trace-1h.tsv"
PLATFORM="${1:-}"
FIRST="${2:-0}"
COUNT="${3:-3600}"

case "$PLATFORM" in android|ios) ;; *) echo "usage: $0 android|ios [first] [count]" >&2; exit 1 ;; esac
[ -f "$TRACE" ] || { echo "missing $TRACE: run fabriquer-trace.py" >&2; exit 1; }
mkdir -p "$HERE/../journaux"
LOG="${JOURNAL:-$HERE/../journaux/$PLATFORM-rejeu.tsv}"
: > "$LOG"

now_ms() { perl -MTime::HiRes=time -e 'printf "%d\n", time()*1000'; }

MODE="${MODE:-mock}"
ADBE=("$ADB" -s emulator-5554)
if [ "$PLATFORM" = android ] && [ "$MODE" = mock ]; then
  # idempotent set-up (adbd runs as root on the emulator)
  "${ADBE[@]}" shell appops set 0 MOCK_LOCATION allow >/dev/null 2>&1
  "${ADBE[@]}" shell cmd location providers remove-test-provider gps >/dev/null 2>&1
  "${ADBE[@]}" shell cmd location providers add-test-provider gps --requiresSatellite >/dev/null 2>&1
  "${ADBE[@]}" shell cmd location providers set-test-provider-enabled gps true >/dev/null 2>&1
fi

T0=$(now_ms)
n=0
# tail/head select the requested range of points (line number = i + 1)
tail -n +$((FIRST + 1)) "$TRACE" | head -n "$COUNT" | while IFS=$'\t' read -r i d lat lon; do
  target=$((T0 + n * 1000))
  wait_ms=$((target - $(now_ms)))
  if [ "$wait_ms" -gt 0 ]; then
    sleep "$(perl -e "printf '%.3f', $wait_ms/1000")"
  fi
  ts=$(now_ms)
  if [ "$PLATFORM" = android ]; then
    if [ "$MODE" = geofix ]; then
      "${ADBE[@]}" emu geo fix "$lon" "$lat" </dev/null >/dev/null
    else
      "${ADBE[@]}" shell cmd location providers set-test-provider-location gps --location "$lat,$lon" --accuracy 5 </dev/null >/dev/null
    fi
  else
    xcrun simctl location "$UDID" set "$lat,$lon" </dev/null >/dev/null
  fi
  if [ $? -eq 0 ]; then st=ok; else st=echec; fi
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$ts" "$i" "$d" "$lat" "$lon" "$st" >> "$LOG"
  n=$((n + 1))
done
echo "done: $(wc -l < "$LOG" | tr -d ' ') points in $LOG"
