"""Test route for the captures: copies a saved created route and turns its leg K into a hand leg,
so that the tracking has "Suivez le tracé" in the middle of the line.
Usage: python3 -I mkroute.py <routes.db> <route id to copy> <leg index K>"""
import json, sqlite3, sys
con = sqlite3.connect(sys.argv[1])
cols = [r[1] for r in con.execute("pragma table_info(routes)")]
row = dict(zip(cols, con.execute("select * from routes where id=?", (int(sys.argv[2]),)).fetchone()))
k = int(sys.argv[3])
legs = json.loads(row['legs']); draft = json.loads(row['draft'])
legs[k] = {"mode": "hand"}; draft['modes'][k] = 'hand'
row['legs'] = json.dumps(legs, separators=(',', ':')); row['draft'] = json.dumps(draft, separators=(',', ':'))
row['name'] = 'Test tronçon main au milieu'
del row['id']
con.execute("insert into routes (%s) values (%s)" % (",".join(row), ",".join("?"*len(row))), list(row.values()))
con.commit()
print(con.execute("select max(id) from routes").fetchone())
