"""Builds a replay trace from a saved route of the app (T4 tester).
Usage: python3 -I trace_from_saved_route.py <routes.db> <route id> <step m> <out.json>
Writes [[lat,lon], ...] every <step> m along the route legs (polyline6 shapes), for
android_replay.py (50 m step, 1 fix per second) or ios_replay.py."""
import json, math, sqlite3, sys
D=sys.argv[1]
legs=json.loads(sqlite3.connect(D).execute("select legs from routes where id=?",(int(sys.argv[2]),)).fetchone()[0])
STEP=float(sys.argv[3])
def dec(s):
    i=0;lat=lon=0;pts=[]
    def nxt():
        nonlocal i
        r=0;sh=0
        while True:
            b=ord(s[i])-63;i+=1;r|=(b&31)<<sh;sh+=5
            if b<32:break
        return ~(r>>1) if r&1 else r>>1
    while i<len(s):
        lat+=nxt();lon+=nxt();pts.append((lat/1e6,lon/1e6))
    return pts
pts=[]
for l in legs:
    if l['mode']=='path':
        for p in dec(l['shape']):
            if not pts or pts[-1]!=p: pts.append(p)
R=6371008.8
def d(a,b):
    p1,p2=math.radians(a[0]),math.radians(b[0]);dl=math.radians(b[1]-a[1])
    h=math.sin((p2-p1)/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))
cum=[0]
for k in range(1,len(pts)): cum.append(cum[-1]+d(pts[k-1],pts[k]))
tot=cum[-1];print(len(pts),'pts',round(tot),'m',pts[0],pts[-1],'gap start-end',round(d(pts[0],pts[-1])))
out=[];x=0.0;k=1
while x<=tot:
    while cum[k]<x: k+=1
    f=(x-cum[k-1])/max(1e-9,cum[k]-cum[k-1]);out.append((pts[k-1][0]+(pts[k][0]-pts[k-1][0])*f,pts[k-1][1]+(pts[k][1]-pts[k-1][1])*f));x+=STEP
out.append(pts[-1]);json.dump(out,open(sys.argv[4],'w'));print(len(out))
