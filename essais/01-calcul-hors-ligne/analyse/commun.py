"""Shared helpers for analyser.py, calculer-sur-mac.py and captures.py.

- request template and route request for a reference (same request as the app);
- valhalla_service (Docker) on the zone package: route and height;
- polyline decoding (precision 6) and ascent with the method of the references.
"""
import importlib.util
import json
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ESSAI = HERE.parent
PKG = ESSAI / "zone" / "sortie" / "nancy"
REFS_JSON = ESSAI / "zone" / "references" / "references.json"
WORK = HERE / "travail"
IMAGE = "ghcr.io/valhalla/valhalla:3.9.1"

# Reuse the geometry and ascent code of the references (file name has a hyphen).
_spec = importlib.util.spec_from_file_location(
    "refs", ESSAI / "zone" / "references" / "preparer-references.py")
refs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(refs)


def load_references():
    return {r["id"]: r for r in json.loads(REFS_JSON.read_text(encoding="utf-8"))}


def route_request(reference, reglages=None):
    """Route request: break at start and end, through between (points every 2 km).

    reglages: optional dict merged into costing_options.bicycle (calibration tests).
    """
    req = json.loads((HERE / "requete-type.json").read_text())
    if reglages:
        req["costing_options"]["bicycle"].update(reglages)
    pts = reference["points_2km"]
    last = len(pts) - 1
    req["locations"] = [
        {"lat": p["lat"], "lon": p["lon"], "type": "break" if i in (0, last) else "through"}
        for i, p in enumerate(pts)
    ]
    return req


def _config():
    """valhalla.json reading the package like the phone does (tar + elevation)."""
    WORK.mkdir(exist_ok=True)
    cfg = WORK / "valhalla.json"
    if not cfg.exists():
        out = subprocess.run(
            ["docker", "run", "--rm", IMAGE, "valhalla_build_config",
             "--mjolnir-tile-dir", "/pkg/tiles-unused",
             "--mjolnir-tile-extract", "/pkg/valhalla_tiles.tar",
             "--additional-data-elevation", "/pkg/elevation"],
            capture_output=True, text=True, check=True).stdout
        cfg.write_text(out)
    return cfg


def valhalla(action, request):
    """Run valhalla_service <action> in Docker on the package. Returns the JSON dict."""
    cfg = _config()
    with tempfile.TemporaryDirectory(dir=WORK) as tmp:
        (Path(tmp) / "request.json").write_text(json.dumps(request))
        r = subprocess.run(
            ["docker", "run", "--rm", "-v", "%s:/pkg:ro" % PKG, "-v", "%s:/cfg:ro" % WORK,
             "-v", "%s:/req:ro" % tmp, IMAGE, "sh", "-c",
             'valhalla_service /cfg/valhalla.json %s "$(cat /req/request.json)"' % action],
            capture_output=True, text=True)
    text = r.stdout
    if r.returncode != 0 or "{" not in text:
        raise RuntimeError("valhalla_service %s a échoué : %s" % (action, r.stderr[-500:]))
    return json.JSONDecoder().raw_decode(text[text.index("{"):])[0]


def decode_polyline6(s):
    """Decode an encoded polyline (precision 6) into [(lat, lon), ...]."""
    pts, i, lat, lon = [], 0, 0, 0
    while i < len(s):
        for axis in (0, 1):
            shift = result = 0
            while True:
                b = ord(s[i]) - 63
                i += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            d = ~(result >> 1) if result & 1 else result >> 1
            if axis == 0:
                lat += d
            else:
                lon += d
        pts.append((lat / 1e6, lon / 1e6))
    return pts


def shape_of(response):
    """All the points of the trip (legs joined)."""
    pts = []
    for leg in response["trip"]["legs"]:
        seg = decode_polyline6(leg["shape"])
        pts.extend(seg if not pts else seg[1:])
    return pts


def ascent_of(pts, chunk=1500):
    """Ascent (m) of (lat, lon) points: resample 30 m, package altitudes, 5 m hysteresis."""
    rs = refs.resample([(p[0], p[1], None) for p in pts])
    heights = []
    for i in range(0, len(rs), chunk):
        part = rs[i:i + chunk]
        h = valhalla("height", {"shape": [{"lat": p[0], "lon": p[1]} for p in part]})["height"]
        if len(h) != len(part) or any(v is None for v in h):
            raise RuntimeError("altitudes manquantes")
        heights.extend(h)
    return refs.ascent(heights)
