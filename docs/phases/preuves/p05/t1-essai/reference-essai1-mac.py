"""THROWAWAY (phase 5, T1). D+ / D- with the METHOD OF ESSAY 1 on the Mac (Docker, Valhalla 3.9.1): the
route shape (saved by the phone in ios/a-<tag>-route-elev30.json) is resampled every 30 m by our own code
(haversine, same as essai 1), heights are read by Valhalla `height` on those points (default precision),
then 5 m hysteresis. Writes mac/essai1-<tag>.json.
Usage: python3 -I reference-essai1-mac.py <zone v3 folder>
"""
import json, math, subprocess, sys, tempfile
from pathlib import Path

H = Path(__file__).resolve().parent
ZONE = Path(sys.argv[1]).resolve()
IMAGE = "ghcr.io/valhalla/valhalla:3.9.1"
cfg = Path(tempfile.mkdtemp())
(cfg / "valhalla.json").write_text(subprocess.run(
    ["docker", "run", "--rm", IMAGE, "valhalla_build_config", "--mjolnir-tile-dir", "/pkg/tiles-unused",
     "--mjolnir-tile-extract", "/pkg/valhalla_tiles.tar", "--additional-data-elevation", "/pkg/elevation"],
    capture_output=True, text=True, check=True).stdout)


def haversine(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(b[1] - a[1]) / 2) ** 2
    return 2 * 6371008.8 * math.asin(math.sqrt(h))


def resample(pts, step=30.0):  # same as preparer-references.py of essay 1
    out = [pts[0]]
    carry = 0.0
    for a, b in zip(pts, pts[1:]):
        d = haversine(a, b)
        if d == 0:
            continue
        pos = step - carry
        while pos <= d:
            t = pos / d
            out.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
            pos += step
        carry = d - (pos - step)
    return out


def ascent(e, hyst=5.0):  # same as essay 1 (D+); D- = D+ of the negated profile
    ref, total = e[0], 0.0
    for v in e[1:]:
        if v - ref >= hyst:
            total += v - ref; ref = v
        elif ref - v >= hyst:
            ref = v
    return total


def decode6(s):
    pts, i, la, lo = [], 0, 0, 0
    while i < len(s):
        for ax in (0, 1):
            sh = r = 0
            while True:
                b = ord(s[i]) - 63; i += 1; r |= (b & 31) << sh; sh += 5
                if b < 32: break
            d = ~(r >> 1) if r & 1 else r >> 1
            if ax == 0: la += d
            else: lo += d
        pts.append((la / 1e6, lo / 1e6))
    return pts


def height(points):
    req = Path(tempfile.mkdtemp()); (req / "r.json").write_text(json.dumps({"shape": [{"lat": p[0], "lon": p[1]} for p in points]}))
    r = subprocess.run(["docker", "run", "--rm", "-v", f"{ZONE}:/pkg:ro", "-v", f"{cfg}:/cfg:ro", "-v", f"{req}:/req:ro", IMAGE,
                        "sh", "-c", 'valhalla_service /cfg/valhalla.json height "$(cat /req/r.json)"'], capture_output=True, text=True)
    t = r.stdout
    return json.JSONDecoder().raw_decode(t[t.index("{"):])[0]["height"]


for tag in ["AB", "P3", "R1", "R2", "R3", "R4", "R5"]:
    legs = json.loads((H / f"ios/a-{tag}-route-elev30.json").read_text())["response"]["trip"]["legs"]
    shape = []
    for leg in legs:
        seg = decode6(leg["shape"]); shape += seg if not shape else seg[1:]
    rs = resample(shape)
    hs = []
    for i in range(0, len(rs), 1500):
        hs += height(rs[i:i + 1500])
    assert all(v is not None for v in hs)
    out = {"tag": tag, "points": len(rs), "dplus": ascent(hs), "dminus": ascent([-v for v in hs]), "heights": hs}
    (H / f"mac/essai1-{tag}.json").write_text(json.dumps(out))
    print(tag, len(rs), out["dplus"], out["dminus"])
