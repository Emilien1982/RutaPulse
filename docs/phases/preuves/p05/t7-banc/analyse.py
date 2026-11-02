# THROWAWAY (phase 5, T7). Lit les JSON du banc et sort des tableaux.
# Usage : python3 -I analyse.py <dossier> [<dossier> ...]
# (un dossier contient les JSON, ou un sous-dossier banc-p05)
# Gestes : release, arrêt max du fil JS jusqu'à la fin des infos < 100 ms,
# au plus 6 calculs dans une fenêtre fermée de 1000 ms, écart >= 195 ms,
# calcul final réussi à la position du relâchement, 0 appel d'infos pendant le
# geste, 4 appels d'infos réussis après (2 tronçons x altitudes + terrain),
# 0 autre tronçon recalculé, carte immobile.
# Affichage : C9 demande moins de 1000 ms (colonne « chiffres dessinés »).
import glob, json, os, sys


def files(root, prefix):
    out = glob.glob(os.path.join(root, prefix + "-*.json"))
    out += glob.glob(os.path.join(root, "banc-p05", prefix + "-*.json"))
    return sorted(out)


def main(roots):
    print("| Geste | Plat. | Build | Durée (ms) | Évts | Arrêt max (ms, jusqu'à la fin des infos) | Calculs | Max/s | Écart min | Final fin (ms) | Infos pendant | Infos après | Fin de tout (ms) | Autres tronçons | Carte | Verdict |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for root in roots:
        for f in files(root, "geste"):
            d = json.load(open(f))
            cf, inf = d["calcul_final"], d["infos"]
            gap = d["ecart_min_entre_calculs_ms"]
            ok = (
                d["build"] == "release"
                and d["arret_max_fil_js_ms_jusqua_fin_infos"] < 100
                and d["max_calculs_par_seconde"] <= 6
                and (gap is None or gap >= 195)
                and cf["present"] and cf["a_la_position_du_relachement"]
                and cf["reussis"] == cf["appels"]
                and inf["appels_pendant_geste"] == 0
                and inf["appels_apres_relachement"] == 4 and inf["reussis"] == 4
                and d["autres_troncons_recalcules"] == 0
                and not d["carte_bougee"]
            )
            print(
                f"| {f} | {d['plateforme']} | {d['build']} | {d['duree_geste_ms']} | {d['evenements_glisser']} "
                f"| {d['arret_max_fil_js_ms_jusqua_fin_infos']} | {d['calculs_pendant_geste']} | {d['max_calculs_par_seconde']} "
                f"| {gap} | {cf['fin_ms_apres_relachement']} | {inf['appels_pendant_geste']} | {inf['appels_apres_relachement']} "
                f"| {d['fin_de_tout_ms_apres_relachement']} | {d['autres_troncons_recalcules']} "
                f"| {'BOUGÉE' if d['carte_bougee'] else 'immobile'} | {'ok' if ok else 'A VOIR'} |"
            )
    print()
    print("| Affichage | Plat. | Build | Cache | Montage (ms) | Chiffres validés (ms) | Chiffres dessinés (ms) | Appels natifs (route/alt/terrain) | D+ | Verdict |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for root in roots:
        for f in files(root, "affichage"):
            d = json.load(open(f))
            n = d["appels_natifs_depuis_toucher"]
            ok = d["build"] == "release" and d["ms_toucher_a_chiffres_dessines"] < 1000
            print(
                f"| {f} | {d['plateforme']} | {d['build']} | {'froid' if d['a_froid'] else 'chaud'} "
                f"| {d['ms_toucher_a_montage_infos']} | {d['ms_toucher_a_chiffres_valides']} | {d['ms_toucher_a_chiffres_dessines']} "
                f"| {n['route']}/{n['altitudes']}/{n['terrain']} | {d['chiffres']['d_plus_m']} | {'< 1 s' if ok else 'A VOIR'} |"
            )
    print()
    print("| Témoin | Plat. | Build | Points | Durée (ms) | Arrêt max (ms) | Appels moteur |")
    print("|---|---|---|---|---|---|---|")
    for root in roots:
        for f in files(root, "temoin"):
            d = json.load(open(f))
            print(f"| {f} | {d['plateforme']} | {d['build']} | {d['points']} | {d['duree_ms']} | {d['arret_max_fil_js_ms']} | {d['appels_moteur_pendant']} |")
    print()
    print("| Référence | Plat. | Tronçons | D+ | D− | Basse | Haute | Parts |")
    print("|---|---|---|---|---|---|---|---|")
    for root in roots:
        for f in files(root, "refs"):
            d = json.load(open(f))
            if "calcul_ts" not in d:
                continue
            c = d["calcul_ts"]
            parts = " ".join(f"{p['part']}={p['percent']}" for p in (c["parts"] or []))
            print(f"| {d['reference']} | {d['plateforme']} | {len(d['troncons'])} | {c['d_plus_m']} | {c['d_moins_m']} | {c['alt_basse_m']} | {c['alt_haute_m']} | {parts} |")


main(sys.argv[1:] or ["."])
