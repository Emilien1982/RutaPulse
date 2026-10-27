"""C5: compare the routes computed in the app (iOS, Android) with the Mac.

Identical = same number of points, same coordinates within 1e-6 and same
trip.summary.length. Usage, from docs/phases/preuves/p03/:
    python3 -I c5/comparer.py
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROOFS = HERE.parent
APPS = {"ios": "ios-release-1.json", "android": "android-release-1.json"}


def decode6(shape):
    """Decode a Valhalla polyline (6 decimals) into [(lon, lat), ...]."""
    points, i, lat, lon = [], 0, 0, 0
    while i < len(shape):
        deltas = []
        for _ in range(2):
            shift = result = 0
            while True:
                b = ord(shape[i]) - 63
                i += 1
                result |= (b & 31) << shift
                shift += 5
                if b < 32:
                    break
            deltas.append(~(result >> 1) if result & 1 else result >> 1)
        lat += deltas[0]
        lon += deltas[1]
        points.append((lon / 1e6, lat / 1e6))
    return points


all_same = True
for n in range(1, 6):
    mac = json.loads((PROOFS / f"mac-R{n}.json").read_text())
    mac_pts = []
    for leg in mac["trip"]["legs"]:
        pts = decode6(leg["shape"])
        mac_pts.extend(pts if not mac_pts else pts[1:])
    mac_km = mac["trip"]["summary"]["length"]
    for platform, results in APPS.items():
        app_pts = json.loads((HERE / f"app-{platform}" / f"R{n}.json").read_text())
        app_km = json.loads((PROOFS / results).read_text())["c5"][f"R{n}"]["distance_km"]
        same_pts = len(app_pts) == len(mac_pts) and all(
            abs(a[0] - b[0]) <= 1e-6 and abs(a[1] - b[1]) <= 1e-6
            for a, b in zip(app_pts, mac_pts)
        )
        same_km = abs(app_km - round(mac_km, 3)) < 1e-9
        all_same &= same_pts and same_km
        print(f"R{n} {platform}: {len(app_pts)} points (Mac {len(mac_pts)}), "
              f"{app_km} km (Mac {mac_km}) -> {'identique' if same_pts and same_km else 'DIFFÉRENT'}")
print("TOUS IDENTIQUES" if all_same else "DIFFÉRENCES")
