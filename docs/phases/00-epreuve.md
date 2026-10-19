# Phase 0 — Épreuve de la configuration (jetable)

## Objectif
Vérifier que le circuit développeur → relecteur + testeur fonctionne, sur une
fonction simple. Le code sera supprimé à la fin.

## Tâche unique
Écrire en Python 3 (bibliothèque standard seulement) le fichier
`epreuve/geo.py` avec une fonction :

```python
def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float
```

Elle renvoie la distance en mètres entre deux points GPS, donnés en degrés
décimaux, par la formule de haversine sur une sphère de rayon 6 371 000 m.

## Critères d'acceptation
1. Deux points identiques → 0.
2. Deux points séparés de 1° de latitude sur le même méridien → 111 195 m,
   à 1 m près.
3. Deux points antipodaux (exemple : (0, 0) et (0, 180)) → 20 015 087 m, à
   1 m près.
4. La distance est symétrique : `distance_m(A, B) == distance_m(B, A)`.
5. Latitude hors de [-90, 90] ou longitude hors de [-180, 180] → `ValueError`.
6. Les tests se lancent avec `python3 -m unittest discover -s epreuve -v`.

## Hors périmètre
- Pas d'ellipsoïde (pas de WGS84 précis), pas d'altitude.
- Pas d'interface en ligne de commande, pas de dépendance externe.
- Le développeur n'écrit pas de tests : c'est le rôle du testeur, dans
  `epreuve/tests/`.
