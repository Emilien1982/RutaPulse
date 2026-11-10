"""Densifies (every 5 m) a polyline6 route shape into [[lat,lon]] for ios_replay.py (T4 tester).
Usage: python3 -I trace_from_polyline.py <out.json>   (edit the shape string `s` first)"""
import json, math, sys
s = "qxp~{A}xdkJwDeMkDiIoCiE{DgEpCqGbCsJ`DmRbDcSbF}]lJo|@h@iCNa@Xu@Z[NGNItVcHpl@gJ~SeDxXqCzGu@t@hBb@lA@hB_CzIwGbKuJhRwDpKo@lDEbCNnDhCvL"
i=0;lat=lon=0;pts=[]
def nxt():
    global i
    r=0;sh=0
    while True:
        b=ord(s[i])-63;i+=1;r|=(b&31)<<sh;sh+=5
        if b<32:break
    return ~(r>>1) if r&1 else r>>1
while i<len(s):
    lat+=nxt();lon+=nxt();pts.append((lat/1e6,lon/1e6))
R=6371008.8
def d(a,b):
    p1,p2=math.radians(a[0]),math.radians(b[0]);dl=math.radians(b[1]-a[1])
    h=math.sin((p2-p1)/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))
tot=sum(d(pts[k],pts[k+1]) for k in range(len(pts)-1))
print(len(pts),'pts',round(tot,1),'m',pts[0],pts[-1])
out=[pts[0]];
for k in range(len(pts)-1):
    L=d(pts[k],pts[k+1]);n=max(1,int(L//5))
    for j in range(1,n+1):
        f=j/n;out.append((pts[k][0]+(pts[k+1][0]-pts[k][0])*f,pts[k][1]+(pts[k+1][1]-pts[k][1])*f))
json.dump(out,open(sys.argv[1],'w'));print(len(out))
