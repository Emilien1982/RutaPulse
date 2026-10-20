# Diagnostic des écarts de dénivelé (essai 1, T3b, Mac)

Généré par `diagnostic-denivele.py`. Méthode de D+ inchangée (30 m, hystérésis 5 m, altitudes du paquet). Distances latérales mesurées sur des tracés densifiés à 10 m ; seuil « loin » 25 m.

## R1 — Circuit VTT balisé de la forêt de Haye (Velaine-en-Haye)

D+ référence 257 m, D+ calculé 220 m, écart -37 m (-14.4 %). Distance réf. 21.36 km, calculée 19.93 km.

### (a) Tronçons coupés aux points de 2 km

Les montées comptées par l'hystérésis sur la trace entière sont attribuées au tronçon où elles tombent (la somme des tronçons égale le D+ total). « Hors réf. » = part du tronçon calculé à plus de 25 m de la référence ; « Réf. hors route » = l'inverse. Tronçon « autre chemin » si l'une des deux parts dépasse 20 %. Hausdorff = plus grand écart latéral entre les deux tracés sur le tronçon (échantillons de 30 m).

| Tr. | Long. réf. (km) | Long. calc. (km) | D+ réf. (m) | D+ calc. (m) | Écart D+ (m) | Hors réf. | Réf. hors route | Hausdorff (m) | Autre chemin |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2.00 | 1.66 | 0 | 0 | +0 | 80 % | 88 % | >400 | oui |
| 2 | 2.00 | 2.00 | 32 | 25 | -7 | 0 % | 0 % | 0 | non |
| 3 | 2.01 | 1.43 | 23 | 5 | -18 | 42 % | 61 % | >400 | oui |
| 4 | 2.00 | 1.33 | 15 | 10 | -5 | 53 % | 88 % | >400 | oui |
| 5 | 2.00 | 3.47 | 43 | 61 | +18 | 97 % | 75 % | >400 | oui |
| 6 | 2.00 | 0.91 | 15 | 0 | -15 | 58 % | 66 % | 342 | oui |
| 7 | 2.00 | 2.33 | 47 | 44 | -3 | 42 % | 47 % | 393 | oui |
| 8 | 2.00 | 2.00 | 31 | 31 | +0 | 0 % | 0 % | 0 | non |
| 9 | 2.00 | 2.00 | 5 | 0 | -5 | 0 % | 0 % | 0 | non |
| 10 | 2.00 | 2.00 | 15 | 16 | +1 | 0 % | 0 % | 0 | non |
| 11 | 1.36 | 0.79 | 31 | 28 | -3 | 41 % | 65 % | 336 | oui |

Écart de D+ porté par les tronçons « autre chemin » : **-26 m** ; par les tronçons sur le même chemin : **-11 m** (total -37 m).
Trois plus gros écarts de tronçon : T3 (-18 m, autre chemin), T5 (+18 m, autre chemin), T6 (-15 m, autre chemin).

### (b) Échantillonnage et bruit

| | Points bruts | Points à 30 m | Pas moyen (m) | Long. rééchantillonnée / long. brute | D+ seuil 0 | seuil 2 | seuil 5 (méthode) | seuil 10 |
|---|---|---|---|---|---|---|---|---|
| Référence | 1028 | 713 | 29.6 | 0.985 | 400 | 346 | 257 | 181 |
| Calculé | 821 | 665 | 29.5 | 0.982 | 380 | 324 | 220 | 151 |

Les deux tracés passent par la même fonction `refs.resample` (30 m) et les mêmes altitudes du paquet. Le pas moyen est mesuré en ligne droite entre échantillons (un peu moins de 30 m dans les virages).

### (c) Hors zone et sans altitude

| | Points bruts hors bbox | Altitudes absentes | Altitudes égales à 0 |
|---|---|---|---|
| Référence | 0 | 0 | 0 |
| Calculé | 0 | 0 | 0 |

### (d) Autres causes

- Référence : plus grand saut entre deux points GPX consécutifs 303 m, 20 saut(s) de plus de 100 m ; début-fin à 63 m.
- Altitude du paquet à la position GPX vs à sa projection sur la route (400 points à moins de 25 m, soit 56 % de la trace) : écart moyen -0.00 m, écart absolu moyen 0.02 m, 0 % des points à plus de 5 m d'écart.
- D+ de la référence recalculé avec les altitudes lues sur la route : 253 m (au lieu de 257 m), soit -4 m en tout, dont **+0 m** sur les tronçons sur le même chemin.
- Allers-retours (échantillons à moins de 10 m d'un autre passage de la même trace, en séquences de 3 ou plus) : route 6 échantillons (0.18 km), dont 5 m de D+ ; référence 0 échantillons (0.00 km), dont 0 m de D+.

### Bilan

Écart total -37 m = autres chemins -26 m + D+ recalculé avec les altitudes lues sur la route +0 m (écart d'altitude de l'ordre de 0,1 m : simple bascule du seuil de 5 m, pas un décalage latéral) + reste sur chemins communs (bruit, phase de l'échantillonnage, allers-retours) -11 m.

## R2 — Petite Suisse Lorraine à VTT

D+ référence 478 m, D+ calculé 468 m, écart -10 m (-2.1 %). Distance réf. 34.89 km, calculée 35.55 km.

### (a) Tronçons coupés aux points de 2 km

Les montées comptées par l'hystérésis sur la trace entière sont attribuées au tronçon où elles tombent (la somme des tronçons égale le D+ total). « Hors réf. » = part du tronçon calculé à plus de 25 m de la référence ; « Réf. hors route » = l'inverse. Tronçon « autre chemin » si l'une des deux parts dépasse 20 %. Hausdorff = plus grand écart latéral entre les deux tracés sur le tronçon (échantillons de 30 m).

| Tr. | Long. réf. (km) | Long. calc. (km) | D+ réf. (m) | D+ calc. (m) | Écart D+ (m) | Hors réf. | Réf. hors route | Hausdorff (m) | Autre chemin |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2.00 | 2.45 | 10 | 10 | +0 | 59 % | 55 % | >400 | oui |
| 2 | 2.01 | 2.00 | 71 | 72 | +1 | 0 % | 0 % | 0 | non |
| 3 | 2.00 | 2.00 | 20 | 16 | -4 | 0 % | 0 % | 0 | non |
| 4 | 2.00 | 2.00 | 10 | 10 | +0 | 0 % | 0 % | 0 | non |
| 5 | 1.99 | 2.00 | 10 | 11 | +1 | 0 % | 0 % | 0 | non |
| 6 | 2.00 | 2.02 | 5 | 10 | +5 | 16 % | 15 % | 152 | non |
| 7 | 2.00 | 2.00 | 46 | 41 | -5 | 0 % | 0 % | 0 | non |
| 8 | 2.01 | 2.02 | 49 | 39 | -10 | 16 % | 16 % | 53 | non |
| 9 | 2.00 | 2.00 | 48 | 48 | +0 | 0 % | 0 % | 0 | non |
| 10 | 1.99 | 2.39 | 19 | 26 | +7 | 51 % | 41 % | >400 | oui |
| 11 | 2.00 | 2.00 | 47 | 50 | +3 | 0 % | 0 % | 0 | non |
| 12 | 2.00 | 2.00 | 70 | 63 | -7 | 0 % | 0 % | 0 | non |
| 13 | 2.00 | 2.02 | 27 | 31 | +4 | 1 % | 0 % | 32 | non |
| 14 | 2.01 | 2.00 | 36 | 36 | +0 | 0 % | 0 % | 0 | non |
| 15 | 1.99 | 2.00 | 5 | 5 | +0 | 0 % | 0 % | 0 | non |
| 16 | 2.00 | 1.93 | 0 | 0 | +0 | 69 % | 70 % | >400 | oui |
| 17 | 2.00 | 1.35 | 5 | 0 | -5 | 56 % | 79 % | 362 | oui |
| 18 | 0.89 | 1.36 | 0 | 0 | +0 | 47 % | 0 % | 133 | oui |

Écart de D+ porté par les tronçons « autre chemin » : **+2 m** ; par les tronçons sur le même chemin : **-12 m** (total -10 m).
Trois plus gros écarts de tronçon : T8 (-10 m), T10 (+7 m, autre chemin), T12 (-7 m).

### (b) Échantillonnage et bruit

| | Points bruts | Points à 30 m | Pas moyen (m) | Long. rééchantillonnée / long. brute | D+ seuil 0 | seuil 2 | seuil 5 (méthode) | seuil 10 |
|---|---|---|---|---|---|---|---|---|
| Référence | 1297 | 1164 | 29.7 | 0.990 | 699 | 606 | 478 | 363 |
| Calculé | 1362 | 1185 | 29.7 | 0.990 | 717 | 616 | 468 | 361 |

Les deux tracés passent par la même fonction `refs.resample` (30 m) et les mêmes altitudes du paquet. Le pas moyen est mesuré en ligne droite entre échantillons (un peu moins de 30 m dans les virages).

### (c) Hors zone et sans altitude

| | Points bruts hors bbox | Altitudes absentes | Altitudes égales à 0 |
|---|---|---|---|
| Référence | 0 | 0 | 0 |
| Calculé | 0 | 0 | 0 |

### (d) Autres causes

- Référence : plus grand saut entre deux points GPX consécutifs 290 m, 39 saut(s) de plus de 100 m ; début-fin à 25 m.
- Altitude du paquet à la position GPX vs à sa projection sur la route (980 points à moins de 25 m, soit 84 % de la trace) : écart moyen -0.00 m, écart absolu moyen 0.02 m, 0 % des points à plus de 5 m d'écart.
- D+ de la référence recalculé avec les altitudes lues sur la route : 468 m (au lieu de 478 m), soit -10 m en tout, dont **-10 m** sur les tronçons sur le même chemin.
- Allers-retours (échantillons à moins de 10 m d'un autre passage de la même trace, en séquences de 3 ou plus) : route 21 échantillons (0.63 km), dont 0 m de D+ ; référence 0 échantillons (0.00 km), dont 0 m de D+.

### Bilan

Écart total -10 m = autres chemins +2 m + D+ recalculé avec les altitudes lues sur la route -10 m (écart d'altitude de l'ordre de 0,1 m : simple bascule du seuil de 5 m, pas un décalage latéral) + reste sur chemins communs (bruit, phase de l'échantillonnage, allers-retours) -2 m.

## R3 — Forêt de Haye

D+ référence 421 m, D+ calculé 475 m, écart +54 m (+12.8 %). Distance réf. 25.10 km, calculée 26.27 km.

### (a) Tronçons coupés aux points de 2 km

Les montées comptées par l'hystérésis sur la trace entière sont attribuées au tronçon où elles tombent (la somme des tronçons égale le D+ total). « Hors réf. » = part du tronçon calculé à plus de 25 m de la référence ; « Réf. hors route » = l'inverse. Tronçon « autre chemin » si l'une des deux parts dépasse 20 %. Hausdorff = plus grand écart latéral entre les deux tracés sur le tronçon (échantillons de 30 m).

| Tr. | Long. réf. (km) | Long. calc. (km) | D+ réf. (m) | D+ calc. (m) | Écart D+ (m) | Hors réf. | Réf. hors route | Hausdorff (m) | Autre chemin |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2.00 | 1.89 | 12 | 66 | +54 | 67 % | 88 % | 339 | oui |
| 2 | 2.00 | 1.23 | 109 | 83 | -26 | 39 % | 58 % | 252 | oui |
| 3 | 2.00 | 1.72 | 53 | 27 | -26 | 81 % | 84 % | >400 | oui |
| 4 | 2.00 | 2.52 | 40 | 27 | -13 | 81 % | 77 % | >400 | oui |
| 5 | 2.00 | 1.98 | 5 | 0 | -5 | 0 % | 0 % | 22 | non |
| 6 | 2.00 | 1.93 | 0 | 0 | +0 | 0 % | 0 % | 19 | non |
| 7 | 2.00 | 1.96 | 37 | 38 | +1 | 0 % | 0 % | 10 | non |
| 8 | 2.00 | 1.98 | 44 | 39 | -5 | 0 % | 0 % | 1 | non |
| 9 | 2.01 | 2.00 | 15 | 15 | +0 | 0 % | 0 % | 1 | non |
| 10 | 2.00 | 3.35 | 76 | 126 | +50 | 82 % | 94 % | >400 | oui |
| 11 | 2.00 | 2.51 | 25 | 49 | +24 | 27 % | 0 % | 311 | oui |
| 12 | 2.00 | 2.00 | 5 | 0 | -5 | 0 % | 0 % | 11 | non |
| 13 | 1.09 | 1.20 | 0 | 5 | +5 | 38 % | 39 % | 94 | oui |

Écart de D+ porté par les tronçons « autre chemin » : **+68 m** ; par les tronçons sur le même chemin : **-14 m** (total +54 m).
Trois plus gros écarts de tronçon : T1 (+54 m, autre chemin), T10 (+50 m, autre chemin), T2 (-26 m, autre chemin).

### (b) Échantillonnage et bruit

| | Points bruts | Points à 30 m | Pas moyen (m) | Long. rééchantillonnée / long. brute | D+ seuil 0 | seuil 2 | seuil 5 (méthode) | seuil 10 |
|---|---|---|---|---|---|---|---|---|
| Référence | 563 | 837 | 29.5 | 0.982 | 566 | 499 | 421 | 372 |
| Calculé | 559 | 876 | 29.6 | 0.987 | 646 | 581 | 475 | 403 |

Les deux tracés passent par la même fonction `refs.resample` (30 m) et les mêmes altitudes du paquet. Le pas moyen est mesuré en ligne droite entre échantillons (un peu moins de 30 m dans les virages).

### (c) Hors zone et sans altitude

| | Points bruts hors bbox | Altitudes absentes | Altitudes égales à 0 |
|---|---|---|---|
| Référence | 0 | 0 | 0 |
| Calculé | 0 | 0 | 0 |

### (d) Autres causes

- Référence : plus grand saut entre deux points GPX consécutifs 545 m, 49 saut(s) de plus de 100 m ; début-fin à 68 m.
- Altitude du paquet à la position GPX vs à sa projection sur la route (556 points à moins de 25 m, soit 66 % de la trace) : écart moyen -0.03 m, écart absolu moyen 0.12 m, 0 % des points à plus de 5 m d'écart.
- D+ de la référence recalculé avec les altitudes lues sur la route : 419 m (au lieu de 421 m), soit -2 m en tout, dont **-5 m** sur les tronçons sur le même chemin.
- Allers-retours (échantillons à moins de 10 m d'un autre passage de la même trace, en séquences de 3 ou plus) : route 44 échantillons (1.32 km), dont 41 m de D+ ; référence 0 échantillons (0.00 km), dont 0 m de D+.

### Bilan

Écart total +54 m = autres chemins +68 m + D+ recalculé avec les altitudes lues sur la route -5 m (écart d'altitude de l'ordre de 0,1 m : simple bascule du seuil de 5 m, pas un décalage latéral) + reste sur chemins communs (bruit, phase de l'échantillonnage, allers-retours) -9 m.

## R4 — Rando VTT Ludres, 13 avril 2014

D+ référence 601 m, D+ calculé 665 m, écart +64 m (+10.6 %). Distance réf. 40.91 km, calculée 42.08 km.

### (a) Tronçons coupés aux points de 2 km

Les montées comptées par l'hystérésis sur la trace entière sont attribuées au tronçon où elles tombent (la somme des tronçons égale le D+ total). « Hors réf. » = part du tronçon calculé à plus de 25 m de la référence ; « Réf. hors route » = l'inverse. Tronçon « autre chemin » si l'une des deux parts dépasse 20 %. Hausdorff = plus grand écart latéral entre les deux tracés sur le tronçon (échantillons de 30 m).

| Tr. | Long. réf. (km) | Long. calc. (km) | D+ réf. (m) | D+ calc. (m) | Écart D+ (m) | Hors réf. | Réf. hors route | Hausdorff (m) | Autre chemin |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2.01 | 3.35 | 111 | 112 | +1 | 92 % | 75 % | >400 | oui |
| 2 | 1.99 | 2.83 | 26 | 33 | +7 | 13 % | 7 % | 159 | non |
| 3 | 2.01 | 1.78 | 21 | 25 | +4 | 32 % | 10 % | 208 | oui |
| 4 | 2.00 | 1.36 | 28 | 23 | -5 | 29 % | 92 % | >400 | oui |
| 5 | 2.00 | 1.03 | 11 | 16 | +5 | 69 % | 55 % | 213 | oui |
| 6 | 2.00 | 0.37 | 16 | 0 | -16 | 33 % | 39 % | 229 | oui |
| 7 | 2.00 | 2.23 | 10 | 6 | -4 | 88 % | 74 % | >400 | oui |
| 8 | 2.00 | 1.72 | 20 | 17 | -3 | 21 % | 31 % | 215 | oui |
| 9 | 2.00 | 1.29 | 22 | 0 | -22 | 60 % | 73 % | 279 | oui |
| 10 | 2.00 | 2.01 | 43 | 46 | +3 | 0 % | 0 % | 24 | non |
| 11 | 2.00 | 2.88 | 7 | 33 | +26 | 76 % | 94 % | >400 | oui |
| 12 | 2.00 | 3.35 | 35 | 83 | +48 | 79 % | 67 % | >400 | oui |
| 13 | 2.00 | 2.33 | 35 | 30 | -5 | 79 % | 74 % | 340 | oui |
| 14 | 2.00 | 1.93 | 21 | 21 | +0 | 0 % | 0 % | 11 | non |
| 15 | 2.00 | 1.71 | 16 | 10 | -6 | 2 % | 18 % | 98 | non |
| 16 | 1.99 | 2.12 | 113 | 131 | +18 | 42 % | 35 % | 325 | oui |
| 17 | 2.00 | 1.75 | 29 | 38 | +9 | 67 % | 73 % | >400 | oui |
| 18 | 2.00 | 2.37 | 20 | 20 | +0 | 63 % | 60 % | 311 | oui |
| 19 | 1.99 | 2.74 | 12 | 16 | +4 | 35 % | 12 % | 232 | oui |
| 20 | 2.00 | 2.03 | 5 | 0 | -5 | 0 % | 0 % | 14 | non |
| 21 | 0.90 | 0.91 | 0 | 5 | +5 | 27 % | 33 % | 102 | oui |

Écart de D+ porté par les tronçons « autre chemin » : **+65 m** ; par les tronçons sur le même chemin : **-1 m** (total +64 m).
Trois plus gros écarts de tronçon : T12 (+48 m, autre chemin), T11 (+26 m, autre chemin), T9 (-22 m, autre chemin).

### (b) Échantillonnage et bruit

| | Points bruts | Points à 30 m | Pas moyen (m) | Long. rééchantillonnée / long. brute | D+ seuil 0 | seuil 2 | seuil 5 (méthode) | seuil 10 |
|---|---|---|---|---|---|---|---|---|
| Référence | 2725 | 1364 | 29.1 | 0.969 | 885 | 772 | 601 | 509 |
| Calculé | 1560 | 1403 | 29.5 | 0.981 | 943 | 820 | 665 | 552 |

Les deux tracés passent par la même fonction `refs.resample` (30 m) et les mêmes altitudes du paquet. Le pas moyen est mesuré en ligne droite entre échantillons (un peu moins de 30 m dans les virages).

### (c) Hors zone et sans altitude

| | Points bruts hors bbox | Altitudes absentes | Altitudes égales à 0 |
|---|---|---|---|
| Référence | 0 | 0 | 0 |
| Calculé | 0 | 0 | 0 |

### (d) Autres causes

- Référence : plus grand saut entre deux points GPX consécutifs 135 m, 8 saut(s) de plus de 100 m ; début-fin à 22 m.
- Altitude du paquet à la position GPX vs à sa projection sur la route (760 points à moins de 25 m, soit 56 % de la trace) : écart moyen +0.02 m, écart absolu moyen 0.25 m, 0 % des points à plus de 5 m d'écart.
- D+ de la référence recalculé avec les altitudes lues sur la route : 586 m (au lieu de 601 m), soit -15 m en tout, dont **-5 m** sur les tronçons sur le même chemin.
- Allers-retours (échantillons à moins de 10 m d'un autre passage de la même trace, en séquences de 3 ou plus) : route 168 échantillons (5.04 km), dont 69 m de D+ ; référence 177 échantillons (5.31 km), dont 23 m de D+.

### Bilan

Écart total +64 m = autres chemins +65 m + D+ recalculé avec les altitudes lues sur la route -5 m (écart d'altitude de l'ordre de 0,1 m : simple bascule du seuil de 5 m, pas un décalage latéral) + reste sur chemins communs (bruit, phase de l'échantillonnage, allers-retours) +4 m.

## R5 — La Pompéenne

D+ référence 783 m, D+ calculé 742 m, écart -41 m (-5.2 %). Distance réf. 44.46 km, calculée 43.09 km.

### (a) Tronçons coupés aux points de 2 km

Les montées comptées par l'hystérésis sur la trace entière sont attribuées au tronçon où elles tombent (la somme des tronçons égale le D+ total). « Hors réf. » = part du tronçon calculé à plus de 25 m de la référence ; « Réf. hors route » = l'inverse. Tronçon « autre chemin » si l'une des deux parts dépasse 20 %. Hausdorff = plus grand écart latéral entre les deux tracés sur le tronçon (échantillons de 30 m).

| Tr. | Long. réf. (km) | Long. calc. (km) | D+ réf. (m) | D+ calc. (m) | Écart D+ (m) | Hors réf. | Réf. hors route | Hausdorff (m) | Autre chemin |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2.01 | 0.80 | 82 | 44 | -38 | 7 % | 28 % | 224 | oui |
| 2 | 1.99 | 1.62 | 15 | 45 | +30 | 44 % | 61 % | 371 | oui |
| 3 | 2.01 | 0.54 | 5 | 5 | +0 | 44 % | 76 % | >400 | oui |
| 4 | 1.99 | 1.76 | 12 | 10 | -2 | 59 % | 92 % | >400 | oui |
| 5 | 2.00 | 0.66 | 53 | 0 | -53 | 32 % | 37 % | 235 | oui |
| 6 | 2.00 | 0.73 | 21 | 13 | -8 | 0 % | 72 % | 166 | oui |
| 7 | 2.00 | 1.59 | 45 | 48 | +3 | 25 % | 74 % | 155 | oui |
| 8 | 2.00 | 1.66 | 5 | 0 | -5 | 80 % | 69 % | 372 | oui |
| 9 | 2.00 | 4.50 | 36 | 51 | +15 | 79 % | 76 % | >400 | oui |
| 10 | 2.00 | 1.97 | 28 | 38 | +10 | 28 % | 39 % | 335 | oui |
| 11 | 2.01 | 1.82 | 10 | 5 | -5 | 54 % | 60 % | 316 | oui |
| 12 | 1.99 | 2.77 | 78 | 78 | +0 | 92 % | 79 % | >400 | oui |
| 13 | 2.00 | 2.81 | 39 | 33 | -6 | 60 % | 86 % | >400 | oui |
| 14 | 2.00 | 1.51 | 32 | 28 | -4 | 56 % | 81 % | >400 | oui |
| 15 | 2.00 | 3.01 | 90 | 113 | +23 | 92 % | 64 % | >400 | oui |
| 16 | 2.00 | 2.11 | 0 | 10 | +10 | 73 % | 62 % | 205 | oui |
| 17 | 2.00 | 2.42 | 24 | 27 | +3 | 42 % | 46 % | 140 | oui |
| 18 | 2.00 | 2.09 | 37 | 37 | +0 | 6 % | 1 % | 51 | non |
| 19 | 1.99 | 1.79 | 42 | 40 | -2 | 3 % | 12 % | 114 | non |
| 20 | 2.00 | 1.88 | 22 | 18 | -4 | 21 % | 24 % | 215 | oui |
| 21 | 2.00 | 2.18 | 74 | 68 | -6 | 25 % | 25 % | 230 | oui |
| 22 | 2.00 | 2.41 | 33 | 31 | -2 | 74 % | 77 % | 226 | oui |
| 23 | 0.45 | 0.46 | 0 | 0 | +0 | 0 % | 0 % | 25 | non |

Écart de D+ porté par les tronçons « autre chemin » : **-39 m** ; par les tronçons sur le même chemin : **-2 m** (total -41 m).
Trois plus gros écarts de tronçon : T5 (-53 m, autre chemin), T1 (-38 m, autre chemin), T2 (+30 m, autre chemin).

### (b) Échantillonnage et bruit

| | Points bruts | Points à 30 m | Pas moyen (m) | Long. rééchantillonnée / long. brute | D+ seuil 0 | seuil 2 | seuil 5 (méthode) | seuil 10 |
|---|---|---|---|---|---|---|---|---|
| Référence | 3337 | 1483 | 29.4 | 0.980 | 1057 | 950 | 783 | 652 |
| Calculé | 1343 | 1437 | 29.4 | 0.979 | 1000 | 899 | 742 | 636 |

Les deux tracés passent par la même fonction `refs.resample` (30 m) et les mêmes altitudes du paquet. Le pas moyen est mesuré en ligne droite entre échantillons (un peu moins de 30 m dans les virages).

### (c) Hors zone et sans altitude

| | Points bruts hors bbox | Altitudes absentes | Altitudes égales à 0 |
|---|---|---|---|
| Référence | 0 | 0 | 0 |
| Calculé | 0 | 0 | 0 |

### (d) Autres causes

- Référence : plus grand saut entre deux points GPX consécutifs 112 m, 3 saut(s) de plus de 100 m ; début-fin à 36 m.
- Altitude du paquet à la position GPX vs à sa projection sur la route (654 points à moins de 25 m, soit 44 % de la trace) : écart moyen -0.01 m, écart absolu moyen 0.35 m, 0 % des points à plus de 5 m d'écart.
- D+ de la référence recalculé avec les altitudes lues sur la route : 781 m (au lieu de 783 m), soit -2 m en tout, dont **+2 m** sur les tronçons sur le même chemin.
- Allers-retours (échantillons à moins de 10 m d'un autre passage de la même trace, en séquences de 3 ou plus) : route 265 échantillons (7.95 km), dont 93 m de D+ ; référence 38 échantillons (1.14 km), dont 23 m de D+.

### Bilan

Écart total -41 m = autres chemins -39 m + D+ recalculé avec les altitudes lues sur la route +2 m (écart d'altitude de l'ordre de 0,1 m : simple bascule du seuil de 5 m, pas un décalage latéral) + reste sur chemins communs (bruit, phase de l'échantillonnage, allers-retours) -4 m.

## Conclusions

Pour chaque référence : écart de D+ (calculé - référence) réparti entre les tronçons sur un autre chemin, la bascule du seuil de 5 m (recalcul avec les altitudes lues sur la route) et le reste.

| Réf. | Écart D+ (m) | Autres chemins (m) | Bascule de seuil (m) | Reste (m) | Tronçons autre chemin | Sauts GPX > 100 m |
|---|---|---|---|---|---|---|
| R1 | -37 | -26 | +0 | -11 | 7 / 11 | 20 |
| R2 | -10 | +2 | -10 | -2 | 5 / 18 | 39 |
| R3 | +54 | +68 | -5 | -9 | 7 / 13 | 49 |
| R4 | +64 | +65 | -5 | +4 | 16 / 21 | 8 |
| R5 | -41 | -39 | +2 | -4 | 20 / 23 | 3 |

Lecture : le bruit d'échantillonnage (b), les altitudes manquantes ou hors zone (c) et le décalage latéral de la trace (d) n'expliquent presque rien. L'écart vient des tronçons où l'itinéraire emprunte d'autres chemins que la référence. Les sauts de plus de 100 m entre points GPX (R1 : 20, R2 : 39, R3 : 49) peuvent venir d'un échantillonnage clairsemé (R3 : 563 points pour 25 km) ou de trous dans la chaîne OSM (R1, R2) : le script ne les départage pas. Les tronçons « autre chemin » ne dépendent que des points de passage tous les 2 km : entre deux points, Valhalla choisit son chemin.
