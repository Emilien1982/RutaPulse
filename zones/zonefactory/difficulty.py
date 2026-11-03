"""MTB difficulty table (ADR 0018, section 1): OSM way ids grouped by mtb:scale level.

osmium only filters the zone extract and converts it to OPL (osmium's text format).
Everything else is pure Python and testable without osmium.
"""

import json
import re
import subprocess
from collections import Counter
from pathlib import Path

from .trails import _parse_tags

LEVELS = 7  # S0 to S6
_VALUE = re.compile(r"[0-6][+-]?")


def parse_level(value: str) -> int | None:
    """Level (0 to 6) of an mtb:scale value, or None if the value is not accepted."""
    value = value.strip()
    return int(value[0]) if _VALUE.fullmatch(value) else None


def table_from_opl(text: str) -> tuple[list[list[int]], Counter]:
    """Return 7 sorted lists of way ids (index = level) and a Counter of the rejected values."""
    levels = [set() for _ in range(LEVELS)]
    rejected = Counter()
    for line in text.splitlines():
        f = line.split(" ")
        if not f[0].startswith("w"):
            continue
        tags = next((_parse_tags(x[1:]) for x in f[1:] if x.startswith("T")), {})
        if "mtb:scale" not in tags:
            continue
        level = parse_level(tags["mtb:scale"])
        if level is None:
            rejected[tags["mtb:scale"]] += 1
        else:
            levels[level].add(int(f[0][1:]))
    return [sorted(s) for s in levels], rejected


def write_table(path: Path, ways_by_level: list[list[int]]) -> None:
    table = {"formatVersion": 1, "waysByLevel": ways_by_level}
    path.write_text(json.dumps(table, separators=(",", ":")), encoding="utf-8")


def report_lines(ways_by_level: list[list[int]], rejected: Counter) -> list[str]:
    total_rejected = sum(rejected.values())
    total = sum(len(w) for w in ways_by_level) + total_rejected
    counts = ", ".join(f"S{i} {len(w)}" for i, w in enumerate(ways_by_level))
    lines = [f"{total} voies avec mtb:scale : {counts} ; {total_rejected} écartées"]
    if rejected:
        values = ", ".join(f"« {v} » ×{n}" for v, n in sorted(rejected.items()))
        lines.append(f"  valeurs écartées : {values}")
    return lines


def extract_difficulty(zone_pbf: Path, out: Path, work: Path) -> list[str]:
    """Run osmium on the zone extract, write `out` (difficulty.json), return the report lines."""
    filtered = work / "mtb-scale.osm.pbf"
    subprocess.run(["osmium", "tags-filter", "-R", "--overwrite", "-o", str(filtered), str(zone_pbf), "w/mtb:scale"], check=True)
    opl = subprocess.run(["osmium", "cat", "-f", "opl", str(filtered)], check=True, capture_output=True, text=True).stdout
    ways_by_level, rejected = table_from_opl(opl)
    write_table(out, ways_by_level)
    return report_lines(ways_by_level, rejected)
