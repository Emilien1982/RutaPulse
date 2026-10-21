#!/usr/bin/env python3
"""Remove lat/lon from a journal so that it can be committed.

Usage: expurger-journal.py in.jsonl|in.tsv out
- JSONL (app journal): the keys "lat" and "lon" are removed.
- TSV (replay log, columns: ms, i, d, lat, lon, ok): columns 4 and 5 are emptied.
"""
import json
import sys


def main():
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as f, open(dst, "w", encoding="utf-8") as g:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            if src.endswith(".jsonl"):
                obj = json.loads(line)
                obj.pop("lat", None)
                obj.pop("lon", None)
                g.write(json.dumps(obj, ensure_ascii=False) + "\n")
            else:
                cols = line.split("\t")
                for i in (3, 4):
                    if i < len(cols):
                        cols[i] = ""
                g.write("\t".join(cols) + "\n")


if __name__ == "__main__":
    main()
