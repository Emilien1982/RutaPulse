"""Next version number of a zone, from the existing git tags (ADR 0003, section 3)."""

import re


def next_version(zone_id: str, tags: list[str]) -> int:
    """Largest N among the tags `zone-<id>-vN`, plus 1 (1 if there is none). The match is exact."""
    pattern = re.compile(rf"zone-{re.escape(zone_id)}-v(\d+)")
    found = [int(m.group(1)) for tag in tags if (m := pattern.fullmatch(tag.strip()))]
    return max(found, default=0) + 1
