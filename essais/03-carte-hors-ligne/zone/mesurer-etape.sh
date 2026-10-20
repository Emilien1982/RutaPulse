#!/usr/bin/env bash
# Step hook for fabriquer-paquet.sh: called as "mesurer-etape.sh start|end <step>"
# by the step() function of fabriquer-zone.sh and fabriquer-carte.sh.
# At "start": starts a background sampler (once per second: peak memory of each
# Docker container; every 5 s: disk used by the output folder).
# At "end": stops it and appends one line to $MEASURE_DIR/etapes.tsv:
#   label  seconds  docker_peak_MiB(name)  host_peak_MiB(command)  disk_peak_MiB  net_in_MiB
# Needs: MEASURE_DIR (state and results), MEASURE_DISK_DIR (folder to size),
# TIME_LOG (file filled by /usr/bin/time in the scripts), STEP_PREFIX (label prefix).
set -u
action="$1"; name="${STEP_PREFIX:-}$2"
M="${MEASURE_DIR:?}"
S="$M/etat"; mkdir -p "$S"

net_in_bytes() { # bytes received on the default network interface
  if [ "$(uname)" = Darwin ]; then
    local itf; itf=$(route -n get default 2>/dev/null | awk '/interface:/ {print $2}')
    netstat -ib -I "$itf" 2>/dev/null | awk 'NR==2 {print $7}'
  else
    local itf; itf=$(ip route show default | awk '{print $5; exit}')
    awk -v i="$itf:" '$1 == i {print $2}' /proc/net/dev
  fi
}

sampler() {
  local i=0
  : > "$S/docker.txt"; : > "$S/disk.txt"
  while [ ! -e "$S/stop" ]; do
    # one line per running container: "<image> <MemUsage>" (docker stats has no image field)
    docker stats --no-stream --format '{{.ID}} {{.MemUsage}}' 2>/dev/null | while read -r id mem rest; do
      echo "$(docker inspect --format '{{.Config.Image}}' "$id" 2>/dev/null) $mem $rest" >> "$S/docker.txt"
    done
    if [ $((i % 5)) -eq 0 ]; then du -sk "$MEASURE_DISK_DIR" 2>/dev/null | awk '{print $1}' >> "$S/disk.txt"; fi
    i=$((i + 1)); sleep 1
  done
}

case "$action" in
  start)
    rm -f "$S/stop"; : > "$TIME_LOG"
    net_in_bytes > "$S/net0"
    date +%s > "$S/t0"
    sampler >/dev/null 2>&1 </dev/null &
    echo $! > "$S/pid"
    ;;
  end)
    touch "$S/stop"
    pid=$(cat "$S/pid"); n=0
    while kill -0 "$pid" 2>/dev/null && [ $n -lt 30 ]; do sleep 1; n=$((n + 1)); done
    du -sk "$MEASURE_DISK_DIR" | awk '{print $1}' >> "$S/disk.txt"
    net1=$(net_in_bytes); net0=$(cat "$S/net0"); t0=$(cat "$S/t0"); t1=$(date +%s)
    cp "$TIME_LOG" "$M/time-$name.log" 2>/dev/null || true
    python3 -I - "$name" "$((t1 - t0))" "$S" "$TIME_LOG" "$((net1 - net0))" >> "$M/etapes.tsv" <<'PY'
import re, sys
name, secs, S, timelog, net = sys.argv[1:]
def mib(x): return x / 1048576
# docker: max MemUsage per image, "<image> 123.4MiB / 7.75GiB"
unit = {"B": 1, "KiB": 1024, "MiB": 1048576, "GiB": 1073741824, "kB": 1000, "MB": 1e6, "GB": 1e9}
peaks = {}
for line in open(S + "/docker.txt"):
    m = re.match(r"(\S+) ([\d.]+)(\w+) /", line)
    if m:
        key = m.group(1).split("/")[-1]
        peaks[key] = max(peaks.get(key, 0), float(m.group(2)) * unit[m.group(3)])
docker = ", ".join(f"{mib(v):.0f} ({k})" for k, v in sorted(peaks.items(), key=lambda kv: -kv[1])) or "-"
# host: max resident set size per command, from /usr/bin/time (macOS: bytes, Linux -v: kbytes)
host, cmd, best = {}, None, {}
for line in open(timelog):
    line = line.rstrip("\n")
    if line.startswith("CMD "):
        cmd = line[4:]
        continue
    m = re.match(r"\s*(\d+)\s+maximum resident set size", line)
    if m: best[cmd] = max(best.get(cmd, 0), int(m.group(1)))
    m = re.match(r"\s*Maximum resident set size \(kbytes\): (\d+)", line)
    if m: best[cmd] = max(best.get(cmd, 0), int(m.group(1)) * 1024)
hostp = ", ".join(f"{mib(v):.0f} ({k})" for k, v in sorted(best.items(), key=lambda kv: -kv[1])) or "-"
disks = [int(x) for x in open(S + "/disk.txt").read().split()]
disk = mib(max(disks) * 1024) if disks else 0
print(f"{name}\t{secs}\t{docker}\t{hostp}\t{disk:.0f}\t{mib(int(net)):.0f}")
PY
    ;;
esac
