"""Where a published file is stored on the phone (ADR 0003, section 1)."""

import math
import re

_HGT_NAME = re.compile(r"^([NS]\d{2})([EW]\d{3})\.hgt$")


def hgt_name(lon: int, lat: int) -> str:
    """Name of the 1 degree HGT tile whose south-west corner is (lon, lat)."""
    ns = "N" if lat >= 0 else "S"
    ew = "E" if lon >= 0 else "W"
    return f"{ns}{abs(lat):02d}{ew}{abs(lon):03d}.hgt"


def hgt_names_for_bbox(bbox: dict) -> list[str]:
    """Names of the HGT tiles touched by the bbox (an edge on a whole degree touches no more)."""
    lon0, lon1 = math.floor(bbox["lonMin"]), math.ceil(bbox["lonMax"]) - 1
    lat0, lat1 = math.floor(bbox["latMin"]), math.ceil(bbox["latMax"]) - 1
    return [hgt_name(lon, lat) for lat in range(lat0, max(lat0, lat1) + 1) for lon in range(lon0, max(lon0, lon1) + 1)]


def storage_path(file_name: str) -> str:
    """Path under which the app stores `file_name`. Only HGT files go in a subfolder."""
    match = _HGT_NAME.match(file_name)
    if match:
        return f"elevation/{match.group(1)}/{file_name}"
    return file_name
