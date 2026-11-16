"""Replays a track on the iPhone 17 simulator: simctl location start --speed=10 with waypoints every 25 m.
Usage: python3 -I ios_replay.py <track.json> <first index> <count>   (prints the simctl command it runs)"""
import json, subprocess, sys
pts = json.load(open(sys.argv[1]))[int(sys.argv[2]):][: int(sys.argv[3])]
pts = pts[::5] + [pts[-1]]
args = ["xcrun", "simctl", "location", "DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D", "start", "--speed=10"] + [f"{la:.6f},{lo:.6f}" for la, lo in pts]
subprocess.run(args, check=True)
