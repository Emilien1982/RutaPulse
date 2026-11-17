#!/bin/zsh
# T5 iOS (iPhone 17, release): near framing (outside the zone, < 10 km), refused state, tracking screen with a replayed track.
# Zone Nancy bbox lonMin 5.84 latMin 48.47 lonMax 6.52 latMax 48.92.
export PATH=$PATH:$HOME/.maestro/bin
U=DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D
cd "$(dirname $0)"
M(){ maestro --device $U test flows/$1.yaml 2>&1 | grep -E "COMPLETED|FAILED|Assertion" | head -2; }
shot(){ xcrun simctl io $U screenshot ios-$1.png 2>/dev/null; }
open_at(){ xcrun simctl terminate $U fr.rutapulse.app 2>/dev/null; xcrun simctl location $U set $1; xcrun simctl launch $U fr.rutapulse.app >/dev/null; sleep 9; }
# near: 2.5 km east of the zone, 9.5 km south of the zone
open_at 48.70,6.554; shot carte-5-near-est-2km5-repos-ou-suit; echo "near est:"; M ios-etat-suit
open_at 48.3845,6.2; shot carte-6-near-sud-9km5; echo "near sud:"; M ios-etat-suit
# 15 km south: no change (whole zone)
open_at 48.335,6.2; shot carte-7-loin-15km-toute-la-zone
# refused
xcrun simctl privacy $U revoke location fr.rutapulse.app
open_at 48.727358,5.978104; shot carte-8-position-refusee; echo "refusee:"; maestro --device $U test flows/ios-etat-refuse.yaml 2>&1 | grep -E "COMPLETED|FAILED" | head -1
xcrun simctl privacy $U grant location fr.rutapulse.app
