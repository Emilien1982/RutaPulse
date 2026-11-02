"""THROWAWAY (phase 5, T1). Replays on the Mac (Docker, Valhalla 3.9.1) the exact requests
saved by the phone in a-<step>.json, and writes mac/a-<step>.json (same layout, one call each).
Usage: python3 -I rejouer-sur-mac.py <phone folder with a-*.json> <zone v3 folder> <out folder>
Zone v3 folder: holds valhalla_tiles.tar and elevation/ (SHA-256 of the tar:
7fa29249411c75fd0cc651b4f0e06baf9dbd80109eea7df51b8116b7ceb07a44).
Steps that start with "err-height-not-json" are skipped (not a JSON object).
"""
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

IMAGE = "ghcr.io/valhalla/valhalla:3.9.1"
phone, zone, out = (Path(a).resolve() for a in sys.argv[1:4])
out.mkdir(parents=True, exist_ok=True)
cfg_dir = Path(tempfile.mkdtemp())
(cfg_dir / "valhalla.json").write_text(subprocess.run(
    ["docker", "run", "--rm", IMAGE, "valhalla_build_config",
     "--mjolnir-tile-dir", "/pkg/tiles-unused", "--mjolnir-tile-extract", "/pkg/valhalla_tiles.tar",
     "--additional-data-elevation", "/pkg/elevation"], capture_output=True, text=True, check=True).stdout)


def action_of(step):
    if "-route-" in step:
        return "route"
    if "height" in step:
        return "height"
    return "trace_attributes"


for f in sorted(phone.glob("a-*.json")):
    d = json.loads(f.read_text())
    if not isinstance(d, dict) or "request" not in d or not isinstance(d["request"], dict):
        continue
    step = d["step"]
    req_dir = Path(tempfile.mkdtemp())
    (req_dir / "r.json").write_text(json.dumps(d["request"]))
    t0 = time.time()
    r = subprocess.run(
        ["docker", "run", "--rm", "-v", f"{zone}:/pkg:ro", "-v", f"{cfg_dir}:/cfg:ro",
         "-v", f"{req_dir}:/req:ro", IMAGE, "sh", "-c",
         f'valhalla_service /cfg/valhalla.json {action_of(step)} "$(cat /req/r.json)"'],
        capture_output=True, text=True)
    ms = round((time.time() - t0) * 1000)  # includes the start of the container
    text = r.stdout
    try:
        resp = json.JSONDecoder().raw_decode(text[text.index("{"):])[0]
    except Exception:
        resp = {"raw_stdout": text[-500:], "stderr": r.stderr[-500:]}
    (out / f.name).write_text(json.dumps({"step": step, "request": d["request"], "ms_with_docker_start": ms,
                                          "response": resp}))
    print(step, "ok", ms, "ms")
