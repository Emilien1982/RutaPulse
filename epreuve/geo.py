import math

EARTH_RADIUS_M = 6_371_000


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the haversine distance in meters between two GPS points (degrees)."""
    for lat in (lat1, lat2):
        if not -90 <= lat <= 90:
            raise ValueError(f"latitude out of range [-90, 90]: {lat}")
    for lon in (lon1, lon2):
        if not -180 <= lon <= 180:
            raise ValueError(f"longitude out of range [-180, 180]: {lon}")

    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = phi2 - phi1
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi1) * math.sin(dlambda / 2) ** 2
    a = min(1.0, a)
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))
