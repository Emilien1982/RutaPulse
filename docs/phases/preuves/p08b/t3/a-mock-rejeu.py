"""Replays a track on the mock "fused" provider of emulator-5584: one position per second.
Usage: python3 -I a-mock-rejeu.py <track.json [[lat,lon],...]> <first index> <count> [accuracy m]"""
import json, subprocess, sys, time, os
adb = os.path.expanduser("~/Library/Android/sdk/platform-tools/adb")
pts = json.load(open(sys.argv[1]))[int(sys.argv[2]):][: int(sys.argv[3])]
acc = sys.argv[4] if len(sys.argv) > 4 else "30"
t0 = time.time()
for i, (lat, lon) in enumerate(pts):
    subprocess.run([adb, "-s", "emulator-5584", "shell", "cmd", "location", "providers",
                    "set-test-provider-location", "fused", "--location", f"{lat:.6f},{lon:.6f}", "--accuracy", acc],
                   capture_output=True)
    time.sleep(max(0, t0 + i + 1 - time.time()))
