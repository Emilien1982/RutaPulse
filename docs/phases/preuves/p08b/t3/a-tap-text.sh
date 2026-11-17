#!/bin/zsh
# usage: a-tap-text.sh <text or resource-id fragment> : taps the center of the first matching node (emulator-5584 only)
cd "$(dirname $0)"
./a.sh shell uiautomator dump /sdcard/u3.xml >/dev/null 2>&1
XY=$(./a.sh shell cat /sdcard/u3.xml | python3 -I -c "
import sys,re
k=sys.argv[1]
s=sys.stdin.read()
for m in re.finditer(r'<node[^>]*>',s):
    n=m.group(0)
    if (('text=\"'+k) in n or ('content-desc=\"'+k) in n or ('resource-id=\"'+k) in n):
        b=re.search(r'bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"',n)
        a=list(map(int,b.groups())); print((a[0]+a[2])//2,(a[1]+a[3])//2); break
" "$1")
echo "tap '$1' at: $XY"
[ -n "$XY" ] && ./a.sh shell input tap ${=XY}
