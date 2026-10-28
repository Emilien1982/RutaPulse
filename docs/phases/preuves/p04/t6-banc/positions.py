# THROWAWAY (phase 4, T6). Calcule où est le point glissé (le 6e de 11) à
# l'écran, d'après demande.json (centre et zoom de la carte, plein écran).
# Usage : python3 -I positions.py <ios|android> -> "x0 y0 x1 y1" du geste.
import json, math, os, sys

SCREENS = {  # largeur, hauteur en points (dp), densité
    "ios": (402, 874, 1.0, 85, 60, 60),  # iPhone 17 ; geste +60,+60 pt
    "android": (411.4, 914.3, 2.625, 85, 95, 95),  # Pixel 6 ; geste en dp
}
INDEX = 5
here = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(here, "demande.json")))
w, h, dens, _, dx, dy = SCREENS[sys.argv[1]]


def world(lon, lat, zoom):
    s = 512 * 2**zoom
    x = (lon + 180) / 360 * s
    y = (0.5 - math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) / (2 * math.pi)) * s
    return x, y


cx, cy = world(*d["center"], d["zoom"])
px, py = world(d["points"][INDEX]["lon"], d["points"][INDEX]["lat"], d["zoom"])
x0, y0 = w / 2 + (px - cx), h / 2 + (py - cy)
print(round(x0 * dens), round(y0 * dens), round((x0 + dx) * dens), round((y0 + dy) * dens))
