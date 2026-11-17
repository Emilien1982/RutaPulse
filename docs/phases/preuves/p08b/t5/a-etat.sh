#!/bin/zsh
# prints the state of the recenter button read from the accessibility tree
cd "$(dirname $0)"
./a.sh shell uiautomator dump /sdcard/u3.xml >/dev/null 2>&1
./a.sh shell cat /sdcard/u3.xml | python3 -I -c "
import sys,re
s=sys.stdin.read()
for k in ['La carte suit ma position','Recentrer sur ma position','Position désactivée','hors de la zone']:
    if k in s: print('ETAT:',k)
"
