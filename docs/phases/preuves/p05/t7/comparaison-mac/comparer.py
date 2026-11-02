"""Phase 5, T7 (C3, C5). Two checks of ADR 0017, section 9, on the 5 references R1 to R5.

  1. SAME METHOD: from the raw answers saved by the app (refs-Rn.json), redo in
     Python the joined profile, the 5 m threshold, the terrain classification and
     the rounding, and compare with the app's own TypeScript result (calcul_ts).
  2. SAME ENGINE: replay the same `height` and `trace_attributes` requests (same
     leg shapes) on Valhalla 3.9.1 in Docker, with the zone Nancy v3 package, redo
     the same computation on the Mac answers, and compare with calcul_ts.

Tolerance: 1 m for D+ and D-, 1 point for each share. Prints one verdict per line.

Usage (stdlib only):
  python3 -I comparer.py <folder holding refs-R1.json .. refs-R5.json> \
      <folder of zone Nancy v3 (valhalla_tiles.tar + elevation/)> <output folder>
  python3 -I comparer.py <refs folder> --sans-docker      # check 1 only
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

IMAGE = "ghcr.io/valhalla/valhalla:3.9.1"
TAR_SHA256 = "7fa29249411c75fd0cc651b4f0e06baf9dbd80109eea7df51b8116b7ceb07a44"
THRESHOLD_M = 5
DENSITY_TOWN = 6
TRAIL_USES = {"path", "footway", "mountain_bike", "cycleway", "pedestrian", "bridleway", "steps", "sidewalk"}
ORDER = ["road", "track", "trail", "hand"]  # tie order of the rounding
TOL_M, TOL_PT = 1, 1


# ---- the method, written from ADR 0017 sections 3 and 4 (not from the TypeScript) ----
def ascent(heights):
    ref, total = heights[0], 0
    for h in heights[1:]:
        if h - ref >= THRESHOLD_M:
            total += h - ref
            ref = h
        elif ref - h >= THRESHOLD_M:
            ref = h
    return total


def join_profiles(profiles):
    """Joins the legs end to end, all points kept. None if any altitude is missing."""
    heights = []
    for p in profiles:
        if not p or any(h is None for _, h in p):
            return None
        heights += [h for _, h in p]
    return heights


def classify(edge):
    use = edge.get("use")
    if use == "track":
        return "track"
    if use in TRAIL_USES and edge.get("density", 0) < DENSITY_TOWN:
        return "trail"
    return "road"


def shares(legs_edges):
    km = {k: 0.0 for k in ORDER}
    for edges in legs_edges:
        for e in edges:
            km[classify(e)] += e.get("length", 0)
    total = sum(km.values())
    if total <= 0:
        return None
    raw = {k: km[k] / total * 100 for k in ORDER}
    out = {k: int(raw[k]) for k in ORDER}
    missing = 100 - sum(out.values())
    for k in sorted(ORDER, key=lambda k: (-(raw[k] - out[k]), ORDER.index(k)))[:missing]:
        out[k] += 1
    return out


def compute(profiles, legs_edges):
    heights = join_profiles(profiles)
    r = {"parts": shares(legs_edges)}
    if heights:
        r.update(d_plus=ascent(heights), d_moins=ascent([-h for h in heights]), basse=min(heights), haute=max(heights))
    return r


# ---- reading the app's files ----
def profile_of(resp):
    return [(d, h) for d, h in resp.get("range_height", [])]


def load_refs(folder):
    refs = {}
    for n in range(1, 6):
        p = Path(folder) / f"refs-R{n}.json"
        if p.exists():
            refs[f"R{n}"] = json.loads(p.read_text())
    return refs


def from_app(ref):
    profiles = [profile_of(t["altitudes"]["brut"]["response"]) for t in ref["troncons"]]
    edges = [t["terrain"]["brut"]["response"]["edges"] for t in ref["troncons"]]
    return compute(profiles, edges)


# ---- the Mac side ----
def replay(ref_name, ref, zone, cfg_dir, work):
    """One container for all requests of a reference (the loop runs inside)."""
    req = work / ref_name / "req"
    out = work / ref_name / "out"
    req.mkdir(parents=True)
    out.mkdir()
    for i, t in enumerate(ref["troncons"]):
        (req / f"{i:03d}-height.json").write_text(json.dumps(t["altitudes"]["brut"]["request"]))
        (req / f"{i:03d}-trace_attributes.json").write_text(json.dumps(t["terrain"]["brut"]["request"]))
    script = (
        'for f in /req/*.json; do b=$(basename "$f" .json); a=${b#*-}; '
        'valhalla_service /cfg/valhalla.json "$a" "$(cat "$f")" > "/out/$b.txt" 2>/dev/null; done'
    )
    subprocess.run(["docker", "run", "--rm", "-v", f"{zone}:/pkg:ro", "-v", f"{cfg_dir}:/cfg:ro",
                    "-v", f"{req}:/req:ro", "-v", f"{out}:/out", IMAGE, "sh", "-c", script], check=True)
    answers = []
    for i in range(len(ref["troncons"])):
        got = []
        for kind in ("height", "trace_attributes"):
            text = (out / f"{i:03d}-{kind}.txt").read_text()
            got.append(json.JSONDecoder().raw_decode(text[text.index("{"):])[0])
        answers.append(got)
    return answers


def from_mac(answers):
    return compute([profile_of(h) for h, _ in answers], [t.get("edges", []) for _, t in answers])


# ---- report ----
def verdict(label, got, ref_ts):
    """Compares a computation with calcul_ts. Returns (line, ok)."""
    ok = True
    cells = []
    for key, ts_key, tol in (("d_plus", "d_plus_m", TOL_M), ("d_moins", "d_moins_m", TOL_M),
                             ("basse", "alt_basse_m", TOL_M), ("haute", "alt_haute_m", TOL_M)):
        g, t = got.get(key), ref_ts.get(ts_key)
        d = None if g is None or t is None else abs(g - t)
        ok &= d is not None and d <= tol
        cells.append(f"{key} {g} vs {t} (ecart {d})")
    ts_parts = {p["part"]: p["percent"] for p in ref_ts.get("parts") or []}
    names = {"road": "road", "track": "track", "trail": "trail", "hand": "hand"}
    pc = []
    for k in ORDER:
        g = (got.get("parts") or {}).get(k, 0)
        t = ts_parts.get(names[k], 0)
        ok &= abs(g - t) <= TOL_PT
        pc.append(f"{k} {g} vs {t} (ecart {abs(g - t)})")
    return f"{label} | " + " ; ".join(cells) + " | " + " ; ".join(pc) + f" | {'OK' if ok else 'ECHEC'}", ok


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    no_docker = "--sans-docker" in sys.argv
    refs = load_refs(args[0])
    if not refs:
        sys.exit("no refs-R*.json in " + args[0])
    lines, all_ok = [], True
    cfg_dir = work = zone = None
    if not no_docker:
        zone, out_dir = Path(args[1]).resolve(), Path(args[2]).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)
        work = Path(tempfile.mkdtemp(dir=out_dir))
        cfg_dir = work / "cfg"
        cfg_dir.mkdir()
        cfg = subprocess.run(["docker", "run", "--rm", IMAGE, "valhalla_build_config",
                              "--mjolnir-tile-dir", "/pkg/tiles-unused", "--mjolnir-tile-extract", "/pkg/valhalla_tiles.tar",
                              "--additional-data-elevation", "/pkg/elevation"], capture_output=True, text=True, check=True).stdout
        (cfg_dir / "valhalla.json").write_text(cfg)
    for name, ref in refs.items():
        ts = ref["calcul_ts"]
        line, ok = verdict(f"{name} controle 1 (meme methode, reponses de l'app)", from_app(ref), ts)
        lines.append(line)
        all_ok &= ok
        if not no_docker:
            answers = replay(name, ref, zone, cfg_dir, work)
            line, ok = verdict(f"{name} controle 2 (meme moteur, Valhalla 3.9.1 Docker)", from_mac(answers), ts)
            lines.append(line)
            all_ok &= ok
            hs = lambda p: [h for _, h in p]
            same_h = all(hs(profile_of(a[0])) == hs(profile_of(t["altitudes"]["brut"]["response"])) for a, t in zip(answers, ref["troncons"]))
            dist = max((abs(x[0] - y[0]) for a, t in zip(answers, ref["troncons"])
                        for x, y in zip(profile_of(a[0]), profile_of(t["altitudes"]["brut"]["response"]))), default=0)
            same_e = all(a[1].get("edges") == t["terrain"]["brut"]["response"]["edges"] for a, t in zip(answers, ref["troncons"]))
            lines.append(f"{name} reponses brutes app = Mac : altitudes {'identiques' if same_h else 'DIFFERENTES'} (ecart max sur l'axe des distances : {dist} m, "
                         f"l'axe ne compte pas dans le D+) ; aretes {'identiques' if same_e else 'DIFFERENTES'} ({len(ref['troncons'])} troncons)")
    lines.append("")
    lines.append(f"Tolerance : {TOL_M} m (D+, D-, altitudes), {TOL_PT} point par part. TOUT OK" if all_ok else "AU MOINS UN ECHEC")
    text = "\n".join(lines)
    print(text)
    if not no_docker:
        (out_dir / "resultat.txt").write_text(text + "\n")
    sys.exit(0 if all_ok else 1)


main()
