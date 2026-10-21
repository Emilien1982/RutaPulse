import json
B = 1792000000000
def rejeu(n, d0=0, i0=0, name="rejeu-test.tsv"):
    with open(name, "w") as f:
        for n_ in range(n):
            i = i0 + n_
            f.write(f"{B+n_*1000}\t{i}\t{d0+100*n_}.0\t{48.7+i*1e-4:.6f}\t6.100000\tok\n")
def obs_android(n, d0=0, delay=1000, count=None):
    rows = []
    for s in range(n + 5):
        t = B + s * 1000
        k = 0
        for n_ in range(n):
            kk = int((d0 + 100 * n_) // 200)
            if kk > int(d0 // 200) and B + n_ * 1000 + delay <= t:
                k = max(k, kk)
        txt = f"Indication {k} : tout droit" if k else ""
        rows.append((t, (count or {}).get(s, 1 if k else 0), txt))
    return rows
def write_obs(name, rows, ios=False):
    with open(name, "w") as f:
        for t, c, txt in rows:
            f.write((f"{t}\t{txt}\n") if ios else f"{t}\t{c}\t{txt}\n")
def app(name, idx, d0=0, i0=0, offset=300, extra=()):
    with open(name, "w") as f:
        for n_ in idx:
            i = i0 + n_
            f.write(json.dumps({"type":"position","t":B+n_*1000+offset,"tPos":B+n_*1000+offset-50,
                "lat":round(48.7+i*1e-4,6),"lon":6.1,"d":d0+100*n_,"k":int((d0+100*n_)//200)})+"\n")
        for e in extra: f.write(json.dumps(e)+"\n")
rejeu(60)
write_obs("obs-android-ok.tsv", obs_android(60))
app("app-ok.jsonl", range(60))
rejeu(100, name="rejeu-100s.tsv")
app("app-trou-40s.jsonl", [n for n in range(100) if not (20 < n < 61)])
app("app-tuee-mi-parcours.jsonl", range(30))
write_obs("obs-android-deux-notifs.tsv", obs_android(60, count={20:2, 21:2}))
write_obs("obs-android-delai-negatif.tsv", [(t - (3000 if "Indication 5 " in txt else 0), c, txt) for t,c,txt in obs_android(60)])
rejeu(60, d0=5000, i0=1000, name="rejeu-depart-1000.tsv")
write_obs("obs-android-depart-1000.tsv", obs_android(60, d0=5000))
app("app-depart-1000.jsonl", range(60), d0=5000, i0=1000)
write_obs("obs-ios-ok.tsv", obs_android(60), ios=True)
write_obs("obs-ios-deux-lignes.tsv", [(t,c,(txt+" | "+txt) if t==B+20000 else txt) for t,c,txt in obs_android(60)], ios=True)
la = [{"type":"liveactivity","t":B+n*1000+1200,"k":n//2,"texte":f"Indication {n//2} : tout droit","actives":1} for n in range(2,60,2)]
app("app-ios-ok.jsonl", range(60), extra=la)
app("app-ios-deux-activites.jsonl", range(60), extra=[dict(e, actives=2) if e["k"]==5 else e for e in la])
write_obs("obs-android-palier-manquant.tsv", [(t, c, "" if "Indication 10 " in txt else txt) for t, c, txt in obs_android(60)])
write_obs("obs-android-dernier-palier-tardif.tsv", [(t, c, "" if "Indication 29 " in txt else txt) for t, c, txt in obs_android(60)])
