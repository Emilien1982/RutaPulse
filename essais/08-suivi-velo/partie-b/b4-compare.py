"""Compare answers of the app (phone/simulator) with those of the Mac (Docker Valhalla 3.9.1).
Usage: python3 -I b4-compare.py <dir with essai-raw-<n>-<action>.json> """
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
d = sys.argv[1]
def diff(a, b, path=""):
    if type(a) != type(b): return [f"{path}: type {type(a).__name__} / {type(b).__name__}"]
    if isinstance(a, dict):
        out = []
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b: out.append(f"{path}/{k}: only in {'app' if k in a else 'mac'}")
            else: out += diff(a[k], b[k], f"{path}/{k}")
        return out
    if isinstance(a, list):
        if len(a) != len(b): return [f"{path}: length {len(a)} / {len(b)}"]
        out = []
        for i, (x, y) in enumerate(zip(a, b)): out += diff(x, y, f"{path}[{i}]")
        return out
    return [] if a == b else [f"{path}: {str(a)[:60]} / {str(b)[:60]}"]
for num in ("1", "2", "3", "3d"):
    for act in ("trace_route", "trace_attributes"):
        app = json.load(open(f"{d}/essai-raw-{num}-{act}.json"))
        mac = json.load(open(f"{HERE}/preuves/mac-{num}-{act}-reponse.json"))
        df = diff(app, mac)
        # same without the 'time' fields (durations in seconds)
        print(f"{num} {act}: {'IDENTICAL (parsed JSON)' if not df else str(len(df)) + ' differences'}")
        for x in df[:6]: print("    ", x)
