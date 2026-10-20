# Calibration du profil vélo VTT (Valhalla 3.9.1, Mac)

Mesures sur R1 à R5, points de passage tous les 2 km, D+ avec la méthode de l'essai (rééchantillonnage 30 m, hystérésis 5 m, altitudes du paquet).
« À moins de 25 m » : part de la longueur calculée dont les points (pas de 10 m) sont à 25 m ou moins de la référence. Écarts = (calculé - référence) / référence.

## Baseline (réglages par défaut : use_roads 0,25, use_hills 0,25, avoid_bad_surfaces 0,25)

| Réf. | À moins de 25 m | Dist. réf. (km) | Dist. calculée (km) | Écart dist. | D+ réf. (m) | D+ calculé (m) | Écart D+ |
|---|---|---|---|---|---|---|---|
| R1 | 60.4 % | 21.36 | 19.94 | -6.6 % | 257 | 220 | -14.4 % |
| R2 | 83.0 % | 34.89 | 35.59 | +2.0 % | 478 | 468 | -2.1 % |
| R3 | 65.3 % | 25.10 | 26.29 | +4.7 % | 421 | 475 | +12.8 % |
| R4 | 52.9 % | 40.91 | 42.12 | +3.0 % | 601 | 665 | +10.6 % |
| R5 | 47.9 % | 44.46 | 43.13 | -3.0 % | 783 | 742 | -5.2 % |

## A : use_roads 0

| Réf. | À moins de 25 m | Dist. réf. (km) | Dist. calculée (km) | Écart dist. | D+ réf. (m) | D+ calculé (m) | Écart D+ |
|---|---|---|---|---|---|---|---|
| R1 | 66.3 % | 21.36 | 20.53 | -3.9 % | 257 | 242 | -5.8 % |
| R2 | 86.4 % | 34.89 | 35.17 | +0.8 % | 478 | 454 | -5.0 % |
| R3 | 63.1 % | 25.10 | 26.98 | +7.5 % | 421 | 480 | +14.0 % |
| R4 | 52.9 % | 40.91 | 42.12 | +3.0 % | 601 | 665 | +10.6 % |
| R5 | 57.5 % | 44.46 | 40.35 | -9.2 % | 783 | 706 | -9.8 % |

## B : avoid_bad_surfaces 0

| Réf. | À moins de 25 m | Dist. réf. (km) | Dist. calculée (km) | Écart dist. | D+ réf. (m) | D+ calculé (m) | Écart D+ |
|---|---|---|---|---|---|---|---|
| R1 | 71.5 % | 21.36 | 19.59 | -8.3 % | 257 | 224 | -12.8 % |
| R2 | 83.0 % | 34.89 | 35.59 | +2.0 % | 478 | 468 | -2.1 % |
| R3 | 65.3 % | 25.10 | 26.29 | +4.7 % | 421 | 475 | +12.8 % |
| R4 | 52.9 % | 40.91 | 42.12 | +3.0 % | 601 | 665 | +10.6 % |
| R5 | 47.9 % | 44.46 | 43.13 | -3.0 % | 783 | 742 | -5.2 % |

## C : use_hills 0,5

| Réf. | À moins de 25 m | Dist. réf. (km) | Dist. calculée (km) | Écart dist. | D+ réf. (m) | D+ calculé (m) | Écart D+ |
|---|---|---|---|---|---|---|---|
| R1 | 71.5 % | 21.36 | 19.59 | -8.3 % | 257 | 224 | -12.8 % |
| R2 | 86.3 % | 34.89 | 35.20 | +0.9 % | 478 | 452 | -5.4 % |
| R3 | 63.2 % | 25.10 | 26.97 | +7.4 % | 421 | 486 | +15.4 % |
| R4 | 52.9 % | 40.91 | 42.12 | +3.0 % | 601 | 665 | +10.6 % |
| R5 | 47.8 % | 44.46 | 41.22 | -7.3 % | 783 | 752 | -4.0 % |

## D : use_roads 0 + avoid_bad_surfaces 0

| Réf. | À moins de 25 m | Dist. réf. (km) | Dist. calculée (km) | Écart dist. | D+ réf. (m) | D+ calculé (m) | Écart D+ |
|---|---|---|---|---|---|---|---|
| R1 | 71.5 % | 21.36 | 19.59 | -8.3 % | 257 | 224 | -12.8 % |
| R2 | 86.4 % | 34.89 | 35.17 | +0.8 % | 478 | 454 | -5.0 % |
| R3 | 63.1 % | 25.10 | 26.98 | +7.5 % | 421 | 480 | +14.0 % |
| R4 | 52.9 % | 40.91 | 42.12 | +3.0 % | 601 | 665 | +10.6 % |
| R5 | 57.5 % | 44.46 | 40.35 | -9.2 % | 783 | 706 | -9.8 % |

## Synthèse

Moyennes sur R2 à R5 (R1 à part : sa référence, reconstruite d'OSM, a 20 sauts de plus de 100 m). Nombres de références dans la tolérance : sur R2 à R5 (sur 4), et entre parenthèses sur R1 à R5 (sur 5).

| Combinaison | Moy. à moins de 25 m | Moy. écart dist. | Moy. écart D+ (valeur abs.) | Moy. écart D+ (signé) | Dist. ± 5 % | D+ ± 10 % | R1 à moins de 25 m |
|---|---|---|---|---|---|---|---|
| Baseline | 62.3 % | +1.7 % | 7.7 % | +4.0 % | 4/4 (4/5) | 2/4 (2/5) | 60.4 % |
| A : use_roads 0 | 65.0 % | +0.5 % | 9.9 % | +2.5 % | 2/4 (3/5) | 2/4 (3/5) | 66.3 % |
| B : avoid_bad_surfaces 0 | 62.3 % | +1.7 % | 7.7 % | +4.0 % | 4/4 (4/5) | 2/4 (2/5) | 71.5 % |
| C : use_hills 0,5 | 62.5 % | +1.0 % | 8.9 % | +4.2 % | 2/4 (2/5) | 2/4 (2/5) | 71.5 % |
| D : use_roads 0 + avoid_bad_surfaces 0 | 65.0 % | +0.5 % | 9.9 % | +2.5 % | 2/4 (2/5) | 2/4 (2/5) | 71.5 % |

## Règle de choix (fixée d'avance)

Meilleure moyenne de « à moins de 25 m » sur R2 à R5. Si l'écart est de moins de 2 points, le plus petit écart moyen de D+ en valeur absolue.

Meilleure moyenne : 65.0 %. Combinaisons à moins de 2 points : A : use_roads 0, D : use_roads 0 + avoid_bad_surfaces 0.

**Retenue : A : use_roads 0** (dossier `mac-roads0`).
