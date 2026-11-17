"""Builds a sendevent script for a two-finger pinch on emulator-5584 (finger 1 on event1, finger 2 on event2).
Usage: python3 -I a-pincement.py <out|in> > script.sh   (out = fingers move apart = zoom in)"""
import sys
W, H = 1080, 2400
cx, cy = 540, 1000
d0, d1 = (60, 330) if sys.argv[1] == "out" else (330, 60)
def sx(x): return int(x * 32767 / W)
def sy(y): return int(y * 32767 / H)
def ev(dev, t, c, v): return f"sendevent /dev/input/{dev} {t} {c} {v}"
lines = []
steps = 12
for i in range(steps + 1):
    d = d0 + (d1 - d0) * i / steps
    for k, (dev, x) in enumerate((("event1", cx - d), ("event2", cx + d))):
        if i == 0:
            lines += [ev(dev, 3, 47, 0), ev(dev, 3, 57, 100 + k), ev(dev, 1, 330, 1)]
        lines += [ev(dev, 3, 47, 0), ev(dev, 3, 53, sx(x)), ev(dev, 3, 54, sy(cy)), ev(dev, 3, 58, 400), ev(dev, 0, 0, 0)]
    lines.append("sleep 0.03")
for dev in ("event1", "event2"):
    lines += [ev(dev, 3, 47, 0), ev(dev, 3, 57, -1), ev(dev, 1, 330, 0), ev(dev, 0, 0, 0)]
print("\n".join(lines))
