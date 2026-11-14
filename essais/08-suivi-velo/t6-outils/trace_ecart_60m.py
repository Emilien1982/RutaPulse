import json,math,sys
S=sys.argv[1]
data=json.load(open('mobile/src/core/routes/fixtures/nancyCircuits.json'))
line=[c for c in data['circuits'] if c['osm_id']==15712020][0]['ordered']
R=6371008.8
def dist(a,b):
    la1,la2=math.radians(a[1]),math.radians(b[1]);dl=math.radians(b[0]-a[0]);dp=la2-la1
    h=math.sin(dp/2)**2+math.cos(la1)*math.cos(la2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))
cum=[0.0]
for i in range(1,len(line)): cum.append(cum[-1]+dist(line[i-1],line[i]))
ref=(5.9840,48.8309)
i0=min(range(len(line)),key=lambda i:dist(line[i],ref));D0=cum[i0]
def at(d):
    d=min(d,cum[-1]) 
    for i in range(1,len(cum)):
        if cum[i]>=d:
            f=(d-cum[i-1])/max(1e-9,cum[i]-cum[i-1]);return (line[i-1][0]+(line[i][0]-line[i-1][0])*f,line[i-1][1]+(line[i][1]-line[i-1][1])*f)
out=[]
for k in range(45):
    lon,lat=at(D0+k*25.0)
    if 14<=k<=21:
        # perpendicular offset ~60 m: compute from neighbours
        a=at(D0+k*25.0-5);b=at(D0+k*25.0+5)
        dx=(b[0]-a[0])*math.cos(math.radians(lat));dy=b[1]-a[1];n=math.hypot(dx,dy)
        nx,ny=-dy/n,dx/n
        lat+=ny*60/111195.0;lon+=nx*60/(111195.0*math.cos(math.radians(lat)))
    out.append([lat,lon])
json.dump(out,open(S+'/trk.json','w'))
lon,lat=at(D0+2000.0);print('far',lon,lat);print('start',out[0], 'len',cum[-1])
