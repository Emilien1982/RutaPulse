#!/usr/bin/env python3
"""One PNG per reference: reference (blue) and computed route (red) on a map.

Usage: python3 captures.py <dossier> <suffixe>
Reads <dossier>/R*.json (route responses), writes the HTML pages in travail/html/
(not committed) and the images in docs/essais/captures/<R>-<suffixe>.png
(Leaflet from unpkg, OpenTopoMap tiles, screenshot by headless Chrome).
Ascents are computed again with the package (same method as analyser.py).
"""
import json
import subprocess
import sys
from pathlib import Path

import commun

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT = commun.ESSAI.parent.parent / "docs" / "essais" / "captures"
HTML_DIR = commun.WORK / "html"
LEAFLET = "1.9.4"

PAGE = """<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://unpkg.com/leaflet@{v}/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@{v}/dist/leaflet.js"></script>
<style>
html, body, #map {{ margin: 0; height: 100%; width: 100%; }}
#legend {{ position: absolute; z-index: 1000; left: 10px; bottom: 28px; background: rgba(255,255,255,.93);
  font: 14px/1.4 sans-serif; padding: 8px 12px; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.4); max-width: 520px; }}
.sw {{ display: inline-block; width: 28px; height: 0; vertical-align: middle; margin-right: 6px; }}
</style></head><body>
<div id="map"></div>
<div id="legend">
<b>{rid} - {name}</b><br>
<small>Source : {source}</small><br>
<span class="sw" style="border-top: 7px solid rgba(0,80,255,.5)"></span>Référence : {d_ref:.1f} km, D+ {a_ref:.0f} m<br>
<span class="sw" style="border-top: 2px solid #e00000"></span>Calculé : {d:.1f} km ({gd:+.1f} %), D+ {a:.0f} m ({ga:+.1f} %)<br>
<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#fff;border:2px solid #222;margin:0 12px 0 10px"></span>Points de passage ({n})<br>
<small>Plateforme : {platform}</small>
</div>
<script>
var ref = {ref_pts}, route = {route_pts}, wp = {wp};
var map = L.map('map', {{zoomControl: false, preferCanvas: true}});
L.tileLayer('https://tile.opentopomap.org/{{z}}/{{x}}/{{y}}.png', {{maxZoom: 17,
  attribution: '&copy; OpenStreetMap, SRTM | &copy; OpenTopoMap'}}).addTo(map);
var l1 = L.polyline(ref, {{color: '#0050ff', weight: 9, opacity: 0.45}}).addTo(map);
L.polyline(route, {{color: '#e00000', weight: 2.5, opacity: 1}}).addTo(map);
wp.forEach(function (p) {{ L.circleMarker(p, {{radius: 4, color: '#222', weight: 1.5, fillColor: '#fff', fillOpacity: 1}}).addTo(map); }});
map.fitBounds(l1.getBounds().extend(L.polyline(route).getBounds()), {{padding: [30, 30]}});
</script></body></html>
"""


def main():
    folder, suffix = Path(sys.argv[1]), sys.argv[2]
    OUT.mkdir(parents=True, exist_ok=True)
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    for rid, ref in commun.load_references().items():
        f = folder / (rid + ".json")
        if not f.exists():
            print(rid, ": fichier absent, ignoré")
            continue
        resp = json.loads(f.read_text())
        shape = commun.shape_of(resp)
        gpx = commun.refs.read_gpx(commun.ESSAI / "zone" / "references" / ref["gpx"])
        ref_pts = [[round(p[0], 5), round(p[1], 5)] for p in gpx]
        d = resp["trip"]["summary"]["length"]
        a = commun.ascent_of(shape)
        html = PAGE.format(
            v=LEAFLET, rid=rid, name=ref["nom"], source=ref["source"], d_ref=ref["distance_km"], d=d,
            gd=(d - ref["distance_km"]) / ref["distance_km"] * 100, a_ref=ref["denivele_positif_calcule_mnt_m"], a=a,
            ga=(a - ref["denivele_positif_calcule_mnt_m"]) / ref["denivele_positif_calcule_mnt_m"] * 100,
            n=len(ref["points_2km"]), platform=folder.resolve().name, ref_pts=json.dumps(ref_pts),
            route_pts=json.dumps([[round(p[0], 5), round(p[1], 5)] for p in shape]),
            wp=json.dumps([[p["lat"], p["lon"]] for p in ref["points_2km"]]))
        page = HTML_DIR / ("%s-%s.html" % (rid, suffix))
        page.write_text(html, encoding="utf-8")
        png = OUT / ("%s-%s.png" % (rid, suffix))
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1400,1000",
                        "--virtual-time-budget=25000", "--screenshot=%s" % png, page.as_uri()],
                       capture_output=True, check=True, timeout=120)
        print(rid, "->", png, "(%d octets)" % png.stat().st_size)


if __name__ == "__main__":
    main()
