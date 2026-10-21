#!/usr/bin/env python3
"""Read `dumpsys notification --noredact` on stdin.
Print: <count of notifications of package argv[1]>\t<texts joined by ' | '>"""
import re
import sys

pkg = sys.argv[1]
in_list, records = False, []
for line in sys.stdin:
    line = line.rstrip("\n")
    if re.match(r"^  \S", line):
        in_list = line.strip() == "Notification List:"
        continue
    if not in_list:
        continue
    if re.match(r"^    NotificationRecord\(", line):
        records.append({"mine": f" pkg={pkg} " in line, "title": "", "text": ""})
    elif records:
        m = re.search(r"android\.(title|text)=\w+ \((.*)\)\s*$", line)
        if m and not records[-1][m.group(1)]:
            records[-1][m.group(1)] = m.group(2)
mine = [r for r in records if r["mine"]]
texts = " | ".join(" / ".join(x for x in (r["title"], r["text"]) if x) for r in mine)
print(f"{len(mine)}\t{texts}")
