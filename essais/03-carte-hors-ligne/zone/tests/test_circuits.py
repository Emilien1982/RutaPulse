"""Independent test of extraire-circuits.py on a small hand-made OSM file.

Expected gap: great-circle (haversine) distance between node 3 and node 4,
computed here with the haversine formula (R = 6371.0088 km), independent of the script.
"""
import json, math, subprocess, sys, tempfile, unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
SCRIPT = HERE / "extraire-circuits.py"

def haversine(a, b):
    R = 6371008.8
    p1, p2 = math.radians(a[1]), math.radians(b[1])
    dp, dl = p2 - p1, math.radians(b[0] - a[0])
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))

N = {1: (5.990, 48.500), 2: (5.995, 48.500), 3: (6.000, 48.500),
     4: (6.010, 48.500), 5: (6.020, 48.501),
     6: (6.000, 48.600), 7: (6.001, 48.600),   # connected, single way
     8: (9.000, 45.000), 9: (9.001, 45.000)}   # far outside bbox

OSM = """<?xml version='1.0' encoding='UTF-8'?>
<osm version="0.6" generator="test">
""" + "".join(f'<node id="{i}" version="1" timestamp="2024-01-01T00:00:00Z" lat="{la}" lon="{lo}"/>\n' for i,(lo,la) in N.items()) + """
<way id="10" version="1" timestamp="2024-01-01T00:00:00Z"><nd ref="1"/><nd ref="2"/></way>
<way id="11" version="1" timestamp="2024-01-01T00:00:00Z"><nd ref="2"/><nd ref="3"/></way>
<way id="12" version="1" timestamp="2024-01-01T00:00:00Z"><nd ref="4"/><nd ref="5"/></way>
<way id="13" version="1" timestamp="2024-01-01T00:00:00Z"><nd ref="6"/><nd ref="7"/></way>
<way id="14" version="1" timestamp="2024-01-01T00:00:00Z"><nd ref="8"/><nd ref="9"/></way>
<relation id="100" version="1" timestamp="2024-01-01T00:00:00Z">
 <member type="way" ref="10" role=""/><member type="way" ref="11" role=""/><member type="relation" ref="101" role=""/>
 <tag k="type" v="route"/><tag k="route" v="mtb"/><tag k="name" v="Test &amp; circuit"/><tag k="ref" v="T1"/><tag k="colour" v="red"/></relation>
<relation id="101" version="1" timestamp="2024-01-01T00:00:00Z">
 <member type="way" ref="12" role=""/><tag k="type" v="route"/><tag k="route" v="mtb"/></relation>
<relation id="200" version="1" timestamp="2024-01-01T00:00:00Z">
 <member type="way" ref="13" role=""/><tag k="type" v="route"/><tag k="route" v="mtb"/><tag k="name" v="Continu"/></relation>
<relation id="300" version="1" timestamp="2024-01-01T00:00:00Z">
 <member type="way" ref="14" role=""/><tag k="type" v="route"/><tag k="route" v="mtb"/><tag k="name" v="Dehors"/></relation>
<relation id="400" version="1" timestamp="2024-01-01T00:00:00Z">
 <member type="way" ref="13" role=""/><tag k="type" v="route"/><tag k="route" v="hiking"/></relation>
</osm>
"""

class T(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        d = Path(cls.tmp.name)
        (d/"t.osm").write_text(OSM)
        subprocess.run(["osmium", "cat", "-o", str(d/"t.osm.pbf"), str(d/"t.osm")], check=True)
        r = subprocess.run([sys.executable, "-I", str(SCRIPT), str(d/"t.osm.pbf"),
                            "5.9,48.4,6.1,48.7", str(d/"out.geojson")],
                           capture_output=True, text=True)
        cls.rc, cls.out, cls.err = r.returncode, r.stdout, r.stderr
        cls.gj = json.loads((d/"out.geojson").read_text())
        cls.f = {x["properties"]["osm_id"]: x for x in cls.gj["features"]}

    def test_exit_ok(self):
        self.assertEqual(self.rc, 0, self.err)

    def test_valid_featurecollection(self):
        self.assertEqual(self.gj["type"], "FeatureCollection")
        for x in self.gj["features"]:
            self.assertEqual(x["geometry"]["type"], "MultiLineString")

    def test_only_mtb_in_zone(self):
        self.assertEqual(sorted(self.f), [100, 101, 200])  # 101 is itself route=mtb in zone: one object per relation; 300 outside bbox, 400 not mtb

    def test_parts_and_gap(self):
        p = self.f[100]["properties"]
        self.assertEqual(p["parts"], 2)
        exp = haversine(N[3], N[4])
        self.assertAlmostEqual(p["max_gap_m"], exp, delta=exp*0.01 + 1)

    def test_continuous(self):
        p = self.f[200]["properties"]
        self.assertEqual((p["parts"], p["max_gap_m"]), (1, 0))

    def test_props_and_length(self):
        p = self.f[100]["properties"]
        self.assertEqual((p["name"], p["ref"], p["colour"]), ("Test & circuit", "T1", "red"))
        exp = haversine(N[1], N[2]) + haversine(N[2], N[3]) + haversine(N[4], N[5])
        self.assertAlmostEqual(p["length_m"], exp, delta=exp*0.01)
        self.assertEqual(len(self.f[100]["geometry"]["coordinates"]), 3)  # sub-relation way followed

if __name__ == "__main__":
    unittest.main()
