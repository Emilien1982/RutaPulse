"""Replays a track on the Android emulator emulator-5584: one `adb emu geo fix <lon> <lat>` per second.
Usage: python3 -I b1-android-rejeu.py <track.json [[lat,lon],...]> <first index> <count>"""
import json, subprocess, sys, time
pts = json.load(open(sys.argv[1]))[int(sys.argv[2]):][: int(sys.argv[3])]
t0 = time.time()
for i, (lat, lon) in enumerate(pts):
    subprocess.run(["adb", "-s", "emulator-5584", "emu", "geo", "fix", f"{lon:.6f}", f"{lat:.6f}"], capture_output=True)
    time.sleep(max(0, t0 + i + 1 - time.time()))
