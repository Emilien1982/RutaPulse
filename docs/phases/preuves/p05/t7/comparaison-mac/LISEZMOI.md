# Comparaison au Mac (C3 et C5), phase 5, T7

Script : `comparer.py` (bibliothèque standard seulement). Deux contrôles de
l'ADR 0017, § 9, sur R1 à R5, tolérance 1 m (D+, D−, altitudes basse et
haute) et 1 point (chaque part). Un verdict par ligne ; code de sortie 0 si
tout est dans la tolérance.

1. **Même méthode** : sur les réponses brutes de l'app (`refs-Rn.json`), il
   refait en Python le profil joint, le seuil de 5 m, le classement du
   terrain, l'arrondi au plus fort reste, et compare au `calcul_ts` de l'app.
2. **Même moteur** : il rejoue les mêmes requêtes `height` et
   `trace_attributes` (mêmes formes de tronçons) sur Valhalla 3.9.1 en Docker
   (un conteneur par référence), puis refait le calcul. Il compare aussi les
   réponses brutes (altitudes, arêtes).

## Commandes (depuis `p05/t7/`)

    python3 -I comparaison-mac/comparer.py references/passage-1/banc-p05 --sans-docker
    python3 -I comparaison-mac/comparer.py references/passage-1/banc-p05 zone-nancy-v3 comparaison-mac/sortie

Le deuxième écrit `comparaison-mac/sortie/resultat.txt`. Docker et l'image
`ghcr.io/valhalla/valhalla:3.9.1` sont nécessaires.

## Données

- `references/passage-1` et `passage-2` : mesure `references` du banc, deux
  passages. Les 5 fichiers sont identiques d'un passage à l'autre, sauf
  l'horodatage et les durées (`ms`).
- `zone-nancy-v3/` : paquet Nancy v3. Aucune copie sur le Mac : copié depuis
  l'émulateur (`adb pull`). Empreinte de `valhalla_tiles.tar` vérifiée :
  `7fa29249411c75fd0cc651b4f0e06baf9dbd80109eea7df51b8116b7ceb07a44`.

## Remarque

Sur R2, R3 et R4, les réponses `height` du Mac et de l'app ont les mêmes
altitudes ; l'axe des distances diffère d'au plus 1 m sur certains points
(sans effet sur le D+).
