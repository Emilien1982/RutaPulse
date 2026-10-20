#!/usr/bin/env python3
"""Essai 1-bis, combination 6: add the tag mtb_route=yes to every way that is a member of a relation route=mtb.

Usage: python3 marquer-mtb.py <in.osm.pbf> <out.osm.pbf>
Why: the lua of Valhalla reads the tags of one way at a time; the relations are only used to set
bike_network_mask (a x0.95 factor). To give these ways a real advantage the lua needs to know about
the membership while it reads the way, so we put it in a tag first. Uses osmium (CLI) and the OPL text format.
"""
import subprocess
import sys

src, dst = sys.argv[1:3]
rel = subprocess.run(["osmium", "tags-filter", "-f", "opl", src, "r/route=mtb"], capture_output=True, text=True, check=True).stdout
members = set()
for l in rel.splitlines():
    if l.startswith("r"):
        for f in l.split(" "):
            if f.startswith("M"):
                members |= {m[1:].split("@")[0] for m in f[1:].split(",") if m.startswith("w")}
print("relations route=mtb : %d, ways membres : %d" % (sum(1 for l in rel.splitlines() if l.startswith("r")), len(members)))
opl = subprocess.run(["osmium", "cat", "-f", "opl", src], capture_output=True, text=True, check=True).stdout
out, n = [], 0
for l in opl.splitlines():
    if l.startswith("w") and l[1:l.index(" ")] in members:
        p = l.split(" ")
        for i, f in enumerate(p):
            if f.startswith("T"):
                p[i] = f + ("," if len(f) > 1 else "") + "mtb_route=yes"
                break
        l = " ".join(p)
        n += 1
    out.append(l)
print("ways marqués :", n)
open(dst + ".opl", "w").write("\n".join(out) + "\n")
subprocess.run(["osmium", "cat", "--overwrite", "-o", dst, dst + ".opl"], check=True)
import os
os.remove(dst + ".opl")
