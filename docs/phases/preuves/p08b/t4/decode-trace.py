import json, math, sys
def dec(s):
    i=lat=lon=0; out=[]
    while i<len(s):
        for k in (0,1):
            sh=r=0
            while True:
                b=ord(s[i])-63; i+=1; r|=(b&31)<<sh; sh+=5
                if b<32: break
            v=~(r>>1) if r&1 else r>>1
            if k==0: lat+=v
            else: lon+=v
        out.append((lat/1e6,lon/1e6))
    return out
legs=json.loads(sys.argv[1])
pts=[]
for l in legs: pts+=dec(l['shape'])
def d(a,b):
    return math.hypot((b[1]-a[1])*math.cos(math.radians(a[0])),b[0]-a[0])*111195
# dedupe & densify to 4 m
out=[pts[0]]
for a,b in zip(pts,pts[1:]):
    n=max(1,int(d(a,b)//4))
    for k in range(1,n+1):
        out.append((a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n))
tot=sum(d(a,b) for a,b in zip(out,out[1:]))
print(len(out),tot,file=sys.stderr)
json.dump(out,open('trace102.json','w'))
