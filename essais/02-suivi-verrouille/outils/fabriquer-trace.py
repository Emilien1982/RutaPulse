#!/usr/bin/env python3
"""Build the replay trace from R3.gpx: constant 5 m/s, one point per second.
d = sum of haversine chords (R = 6371008.8 m) between successive published points.

Usage: fabriquer-trace.py [R3.gpx] [sortie_dir]
Writes in sortie/: trace-1h.json, trace-1h.tsv, trace-1h.gpx, trace-app.json
"""
import json
import math
import os
import sys
import xml.etree.ElementTree as ET

DEFAULT_GPX = ("/Users/utilisateur/dev_ai/vtt-nav/.claude/worktrees/essai-1-9fd65c/"
               "essais/01-calcul-hors-ligne/zone/references/gpx/R3.gpx")
SPEED = 5.0      # m/s
N_POINTS = 3600  # one per second, 1 h
R = 6371008.8    # mean Earth radius, m


def dist(a, b):
    """Haversine distance in meters between (lat, lon) pairs."""
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dl = math.radians(b[1] - a[1])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def read_gpx(path):
    pts = []
    for el in ET.parse(path).getroot().iter():
        if el.tag.endswith("}trkpt") or el.tag == "trkpt":
            pts.append((float(el.get("lat")), float(el.get("lon"))))
    return pts


def resample(pts):
    cum = [0.0]
    for a, b in zip(pts, pts[1:]):
        cum.append(cum[-1] + dist(a, b))
    need = SPEED * (N_POINTS - 1)
    if cum[-1] < need:
        sys.exit(f"GPX too short: {cum[-1]:.0f} m < {need:.0f} m")
    out, j = [], 0
    for i in range(N_POINTS):
        d = SPEED * i
        while cum[j + 1] < d:
            j += 1
        seg = cum[j + 1] - cum[j]
        f = (d - cum[j]) / seg if seg > 0 else 0.0
        lat = pts[j][0] + f * (pts[j + 1][0] - pts[j][0])
        lon = pts[j][1] + f * (pts[j + 1][1] - pts[j][1])
        out.append((i, d, round(lat, 6), round(lon, 6)))
    # d published = sum of chords between successive published points (same as the app)
    chord = [0.0]
    for a, b in zip(out, out[1:]):
        chord.append(chord[-1] + dist((a[2], a[3]), (b[2], b[3])))
    out = [(i, chord[i], lat, lon) for i, _, lat, lon in out]
    return out, cum[-1]


def main():
    gpx = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_GPX
    outdir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "sortie")
    os.makedirs(outdir, exist_ok=True)
    res, total = resample(read_gpx(gpx))

    with open(os.path.join(outdir, "trace-1h.json"), "w") as f:
        json.dump({"speed_mps": SPEED,
                   "points": [[lat, lon] for _, _, lat, lon in res],
                   "d": [round(d, 3) for _, d, _, _ in res]}, f)
    with open(os.path.join(outdir, "trace-1h.tsv"), "w") as f:
        for i, d, lat, lon in res:
            f.write(f"{i}\t{d:.3f}\t{lat}\t{lon}\n")
    with open(os.path.join(outdir, "trace-1h.gpx"), "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n'
                '<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="essai2">\n'
                '<trk><name>Essai 2 - 5 m/s</name><trkseg>\n')
        for i, d, lat, lon in res:
            f.write(f'<trkpt lat="{lat}" lon="{lon}"><time>1970-01-01T{i // 3600:02d}:{i % 3600 // 60:02d}:{i % 60:02d}Z</time></trkpt>\n')
        f.write('</trkseg></trk></gpx>\n')
    with open(os.path.join(outdir, "trace-app.json"), "w") as f:
        json.dump([[lat, lon] for _, _, lat, lon in res], f)
    print(f"source: {total:.0f} m; written {len(res)} points, total chord length = {res[-1][1]:.1f} m, in {outdir}")


if __name__ == "__main__":
    main()
