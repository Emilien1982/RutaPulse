"""Where does the matched path leave the original? Lists stretches > 20 m away, and the
context of u-turn directions. Uses the answers saved by 3-gpx.py."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from outils import *
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
R_ = f"{HERE}/resultats"
pts = [(float(e.get("lat")), float(e.get("lon"))) for e in ET.parse(f"{R_}/3-gpx-simule.gpx").getroot().iter() if e.tag.endswith("trkpt")]
resp = json.load(open(f"{R_}/3-trace_route-map_snap-reponse.json"))
matched = shape_of(resp)
lm = Line(matched)
d = [lm.dist(p) for p in pts]
cum = [0.0]
for a, b in zip(pts, pts[1:]):
    cum.append(cum[-1] + hav(a, b))
runs, i = [], 0
while i < len(d):
    if d[i] > 20:
        j = i
        while j + 1 < len(d) and d[j + 1] > 20:
            j += 1
        runs.append((i, j))
        i = j + 1
    else:
        i += 1
print(f"{len(runs)} stretches of the GPX more than 20 m from the matched path")
for i, j in runs:
    print(f"  from km {cum[i]/1000:.2f}, length {cum[j]-cum[i]:.0f} m, max gap {max(d[i:j+1]):.0f} m, at {pts[i]}")
rows = directions_of(resp)
shape_cum = [0.0]
for a, b in zip(matched, matched[1:]):
    shape_cum.append(shape_cum[-1] + hav(a, b))
for k, r in enumerate(rows):
    if r["type_name"].startswith("uturn"):
        s = r["begin_shape_index"]
        print(f"u-turn #{k} at km {shape_cum[s]/1000:.2f} {matched[s]}: before: "
              f"{rows[k-1]['instruction']} ({round(rows[k-1]['length_km']*1000)} m); "
              f"this: {r['instruction']} ({round(r['length_km']*1000)} m); after: {rows[k+1]['instruction']}")
