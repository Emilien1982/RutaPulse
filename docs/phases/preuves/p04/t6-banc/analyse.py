# THROWAWAY (phase 4, T6). Lit les geste-N.json et temoin-N.json et sort le tableau.
# Usage : python3 -I analyse.py <dossier> [<dossier> ...]
# (un dossier contient geste-*.json, temoin-*.json, ou un sous-dossier banc-p04)
# Seuils : C11 arrêt max < 100 ms ; C3 : au plus 5 calculs/s (la fenêtre fermée
# de 1000 ms peut en compter 6 à 200 ms d'écart exactement), écart >= 195 ms
# (gigue du minuteur), calcul final présent à la position du relâchement,
# 0 autre tronçon recalculé, carte immobile.
import glob, json, os, sys


def files(root, prefix):
    out = glob.glob(os.path.join(root, prefix + "-*.json"))
    out += glob.glob(os.path.join(root, "banc-p04", prefix + "-*.json"))
    return sorted(out)


def main(roots):
    print("| Fichier | Plat. | Build | Durée (ms) | Évts | Arrêt max (ms) | Calculs | Max/s | Écart min (ms) | Final (ms) | Final à la position | Autres tronçons | Carte bougée | Verdict |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for root in roots:
        for f in files(root, "geste"):
            d = json.load(open(f))
            cf = d["calcul_final"]
            gap = d["ecart_min_entre_calculs_ms"]
            ok = (
                d["build"] == "release"
                and d["arret_max_fil_js_ms_jusqua_calcul_final"] < 100
                and d["max_calculs_par_seconde"] <= 6
                and (gap is None or gap >= 195)
                and cf["present"]
                and cf["a_la_position_du_relachement"]
                and cf["reussis"] == cf["appels"]
                and d["autres_troncons_recalcules"] == 0
                and not d["carte_bougee"]
            )
            print(
                f"| {f} | {d['plateforme']} | {d['build']} | {d['duree_geste_ms']} | {d['evenements_glisser']} "
                f"| {d['arret_max_fil_js_ms_jusqua_calcul_final']} | {d['calculs_pendant_geste']} "
                f"| {d['max_calculs_par_seconde']} | {gap} | {cf['fin_ms_apres_relachement']} "
                f"| {'oui' if cf['a_la_position_du_relachement'] else 'NON'} "
                f"| {d['autres_troncons_recalcules']} | {'OUI' if d['carte_bougee'] else 'non'} "
                f"| {'ok' if ok else 'A VOIR'} |"
            )
    print()
    print("| Témoin | Plat. | Build | Points | Durée (ms) | Arrêt max (ms) | Appels moteur |")
    print("|---|---|---|---|---|---|---|")
    for root in roots:
        for f in files(root, "temoin"):
            d = json.load(open(f))
            print(
                f"| {f} | {d['plateforme']} | {d['build']} | {d['points']} | {d['duree_ms']} "
                f"| {d['arret_max_fil_js_ms']} | {d['appels_moteur_pendant']} |"
            )


main(sys.argv[1:] or ["."])
