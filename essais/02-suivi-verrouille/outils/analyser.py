#!/usr/bin/env python3
"""Compute C1, C2 and C3 of essay 2 from the logs and print a Markdown table.

Usage: analyser.py --plateforme android|ios [--rejeu f.tsv] [--obs f.tsv] [--app f.jsonl]
                   [--debut MS] [--fin MS]
Any log may be omitted: the matching criteria are then skipped.
--debut/--fin (Mac time, ms) restrict C1 to a period (e.g. screen locked).
Without them, C1 uses [first injection, last injection + 1 s] when --rejeu is given.
Formats: see LISEZMOI.md.
"""
import argparse
import json
import re
import statistics
import sys
import time


def hms(ms):
    return time.strftime("%H:%M:%S", time.localtime(ms / 1000))


def read_tsv(path):
    with open(path, encoding="utf-8") as f:
        return [l.rstrip("\n").split("\t") for l in f if l.strip()]


def read_jsonl(path):
    out = []
    with open(path, encoding="utf-8") as f:
        for n, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                print(f"warning: {path} line {n} is not valid JSON, ignored", file=sys.stderr)
    return out


def clock_offset(app, rejeu):
    """Median of (app time - Mac injection time) for positions found in the replay log.
    It is the clock gap plus the latency of the position (about 0.1 to 1 s)."""
    inj = {}
    for r in rejeu:
        inj.setdefault((round(float(r[3]), 5), round(float(r[4]), 5)), int(r[0]))
    diffs = [e["t"] - inj[key] for e in app if e.get("type") == "position"
             for key in [(round(e["lat"], 5), round(e["lon"], 5))] if key in inj]
    return statistics.median(diffs) if diffs else None


def c1(app, rejeu, debut, fin):
    pos_all = sorted(e["t"] for e in app if e.get("type") == "position")
    off = clock_offset(app, rejeu) if rejeu else None
    if rejeu:
        sent = [int(r[0]) for r in rejeu]
        debut = sent[0] if debut is None else debut
        fin = sent[-1] + 1000 if fin is None else fin
    shift = off if off is not None else 0
    pos = [t - shift for t in pos_all]  # app times brought back to Mac time
    if debut is not None and fin is not None:
        pos = [t for t in pos if debut <= t <= fin]
        start, end = debut, fin
    else:
        if len(pos) < 2:
            return ["C1", "≥ 1 position par 5 s, aucun trou > 30 s", "moyenne ≥ 1, trou ≤ 30 s",
                    f"{len(pos)} position(s), pas de fenêtre", "NON MESURABLE"]
        start, end = pos[0], pos[-1]
    dur = (end - start) / 1000
    if dur <= 0:
        return ["C1", "≥ 1 position par 5 s, aucun trou > 30 s", "moyenne ≥ 1, trou ≤ 30 s",
                "fenêtre de durée nulle", "NON MESURABLE"]
    per5 = len(pos) / (dur / 5)
    edges = [start] + pos + [end] if (debut is not None) else pos
    gaps = [(b - a, a, b) for a, b in zip(edges, edges[1:])]
    gap, ga, gb = max(gaps) if gaps else (dur * 1000, start, end)
    ok = per5 >= 1 and gap / 1000 <= 30
    detail = (f"{len(pos)} positions sur {dur:.0f} s couverts ({hms(start)} à {hms(end)}) ; "
              f"{per5:.2f} positions par 5 s ; plus grand trou {gap / 1000:.1f} s ({hms(ga)} à {hms(gb)}, "
              f"bords inclus) ; ")
    if rejeu and off is not None:
        detail += f"écart horloge appareil - Mac estimé {off / 1000:+.2f} s (comprend la latence d'envoi)"
    else:
        detail += "écart d'horloge appareil/Mac non estimé (tolérance : celle de l'horloge de l'appareil)"
    return ["C1", "≥ 1 position par 5 s, aucun trou > 30 s", "moyenne ≥ 1, trou ≤ 30 s", detail,
            "OK" if ok else "ÉCHEC"]


def c2(rejeu, obs, platform):
    # obs rows: android = ts, count, text ; ios = ts, text
    seen = []
    for r in obs:
        i = 2 if platform == "android" else 1
        seen.append((int(r[0]), r[i] if len(r) > i else ""))
    rows = []
    sent = [r for r in rejeu if len(r) < 6 or r[5] == "ok"]
    if not sent:
        return rows
    k = int(float(sent[0][2]) // 200) + 1  # first threshold crossed after the first point
    for r in sent:
        ts, d = int(r[0]), float(r[2])
        while d >= 200 * k:
            t_obs = next((t for t, txt in seen if re.search(rf"Indication {k}(?!\d)", txt)), None)
            rows.append((k, d, ts, t_obs))
            k += 1
    return rows


def row_c2(rows, rejeu_end):
    # the very last threshold, if crossed < 10 s before the end of the replay and never seen, is excluded
    excluded = None
    if rows and rows[-1][3] is None and rejeu_end - rows[-1][2] < 10000:
        excluded, rows = rows[-1], rows[:-1]
    seen_rows = [r for r in rows if r[3] is not None]
    delays = [(t - ts) / 1000 for _, _, ts, t in seen_rows]
    early = [x for x in delays if x < -1]          # seen more than 1 s before injection
    valid = [x for x in delays if x >= -1]
    fast = sum(1 for x in valid if x < 5)
    lost = len(rows) - len(seen_rows)
    if not rows:
        return ["C2", "Nouveau texte < 5 s après le palier", "≥ 20 changements vus, tous < 5 s",
                "aucun palier franchi", "NON MESURABLE"]
    parts = [f"{len(seen_rows)} changements vus sur {len(rows)} paliers"]
    if valid:
        parts.append(f"médiane {statistics.median(valid):.1f} s ; maximum {max(valid):.1f} s")
    parts.append(f"{fast} < 5 s ({100 * fast / len(rows):.0f} % des paliers)")
    parts.append(f"{lost} jamais vu(s)")
    if excluded:
        parts.append(f"dernier palier (k={excluded[0]}) exclu : franchi moins de 10 s avant la fin du rejeu")
    if early:
        parts.append(f"{len(early)} délai(s) < -1 s (texte vu avant l'injection : anormal)")
    ok = len(valid) >= 20 and fast == len(valid) and not early and lost == 0
    verdict = "OK" if ok else ("ÉCHEC" if (early or lost or fast < len(valid) or not seen_rows) else "INSUFFISANT (< 20 changements)")
    return ["C2", "Nouveau texte < 5 s après le palier", "≥ 20 changements vus, tous < 5 s",
            " ; ".join(parts), verdict]


def c3(obs, app, platform):
    head = ["C3", "Notification unique", "≤ 1"]
    notes, mx, extra = [], None, False
    if platform == "android" and obs:
        counts = [int(r[1]) for r in obs if len(r) > 1 and r[1].isdigit()]
        errs = sum(1 for r in obs if len(r) > 1 and not r[1].isdigit())
        if counts:
            mx = max(counts)
            notes.append(f"max {mx} notification(s) de l'app sur {len(counts)} relevés")
        if errs:
            notes.append(f"{errs} relevé(s) en erreur")
    if platform == "ios":
        acts = [e.get("actives", 0) for e in app if e.get("type") == "liveactivity"]
        if acts:
            mx = max(acts)
            notes.append(f"max {mx} Live Activity active(s)")
        info = sum(1 for e in app if e.get("type") == "notif")
        if app:
            notes.append(f"{info} événement(s) notif dans le journal (info)")
        if obs:
            lines = max((len([x for x in r[1].split(" | ") if x]) for r in obs if len(r) > 1), default=0)
            notes.append(f"max {lines} ligne(s) « Indication » sur une même capture")
            if lines >= 2:
                extra = True
    if mx is None and not extra:
        return head + [" ; ".join(notes) or "aucune donnée", "NON MESURABLE"]
    if (mx or 0) > 1:
        verdict = "ÉCHEC (> 1)"
    elif extra:
        verdict = "À VÉRIFIER (≥ 2 lignes sur une capture : voir la capture)"
    else:
        verdict = "OK"
    return head + [" ; ".join(notes), verdict]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plateforme", required=True, choices=["android", "ios"])
    ap.add_argument("--rejeu")
    ap.add_argument("--obs")
    ap.add_argument("--app")
    ap.add_argument("--debut", type=int, help="window start, Mac ms")
    ap.add_argument("--fin", type=int, help="window end, Mac ms")
    a = ap.parse_args()

    app = read_jsonl(a.app) if a.app else []
    obs = read_tsv(a.obs) if a.obs else []
    rejeu = read_tsv(a.rejeu) if a.rejeu else []
    failed = sum(1 for r in rejeu if len(r) > 5 and r[5] != "ok")

    table = []
    if a.app:
        table.append(c1(app, rejeu, a.debut, a.fin))
    rows = []
    if a.rejeu and a.obs:
        rows = c2(rejeu, obs, a.plateforme)
        table.append(row_c2(rows, int(rejeu[-1][0]) + 1000 if rejeu else 0))
    if a.obs or a.app:
        table.append(c3(obs, app, a.plateforme))

    print(f"## Résultats ({a.plateforme})\n")
    if failed:
        print(f"Attention : {failed} envoi(s) de position en échec dans le journal de rejeu.\n")
    print("| # | Critère | Attendu | Mesuré | Verdict |")
    print("|---|---|---|---|---|")
    for r in table:
        print("| " + " | ".join(r) + " |")
    if rows:
        print("\n### C2 : détail par palier\n")
        print("Résolution : 1 s (l'observateur lit une fois par seconde). L'heure d'injection est prise "
              "juste avant l'envoi de la position.\n")
        print("| k | d du point (m) | injection | vu | délai (s) |")
        print("|---|---|---|---|---|")
        for k, d, ts, t in rows:
            vu, delai = (hms(t), f"{(t - ts) / 1000:.1f}") if t else ("jamais", "-")
            print(f"| {k} | {d:.0f} | {hms(ts)} | {vu} | {delai} |")


if __name__ == "__main__":
    main()
