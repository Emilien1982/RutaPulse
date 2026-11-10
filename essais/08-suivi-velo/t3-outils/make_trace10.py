"""Builds replay traces from the Petite Suisse circuit (nancyCircuits.json).
Usage: python3 -I make_trace.py <circuits.json> <out dir>
Writes: ride.json ([[lat,lon] one per second at 5 m/s from the point nearest to 48.8309,5.9840]),
        ecart.json (same, with a detour of 80 m between t=60 and t=100)."""
import json, math, sys
data = json.load(open(sys.argv[1]))
line = [c for c in data['circuits'] if c['osm_id'] == 15712020][0]['ordered']  # [lon, lat]
R = 6371008.8
def dist(a, b):
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    dl = math.radians(b[0]-a[0]); dp = la2-la1
    h = math.sin(dp/2)**2 + math.cos(la1)*math.cos(la2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))
ref = (5.9840, 48.8309)
i0 = min(range(len(line)), key=lambda i: dist(line[i], ref))
cum = [0.0]
for i in range(1, len(line)):
    cum.append(cum[-1] + dist(line[i-1], line[i]))
def at(d):
    d = min(d, cum[-1])
    lo, hi = 0, len(cum)-1
    while lo < hi:
        m = (lo+hi)//2
        if cum[m] < d: lo = m+1
        else: hi = m
    i = max(1, lo)
    f = (d-cum[i-1])/max(1e-9, cum[i]-cum[i-1])
    return (line[i-1][0]+(line[i][0]-line[i-1][0])*f, line[i-1][1]+(line[i][1]-line[i-1][1])*f)
d0 = cum[i0]
print('start index', i0, 'dist from circuit start', round(d0), 'm; line', round(cum[-1]), 'm', file=sys.stderr)
def ride(seconds, speed=10.0, detour=False):
    out = []
    for s in range(seconds):
        lon, lat = at(d0 + s*speed)
        if detour and 60 <= s <= 100:
            k = min(s-60, 100-s, 10)/10.0
            # 80 m to the north-west side
            lat += k*80/111195.0
            lon -= k*80*0.3/(111195.0*math.cos(math.radians(lat)))
        out.append([lat, lon])
    return out
json.dump(ride(400), open(sys.argv[2]+'/ride10.json', 'w'))
json.dump(ride(400, detour=True), open(sys.argv[2]+'/ecart10.json', 'w'))
print(json.dumps({'start': ride(1)[0]}))
