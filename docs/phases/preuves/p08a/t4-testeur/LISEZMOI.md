# Phase 8a, T4 — preuves du testeur (écran d'arrivée)

Code testé : commits bddf7e7 et 20d1c21. Builds release, sans menu de
développement. Ce fichier est écrit par la session de phase d'après le
rapport du testeur (le garde-fou interdit au testeur d'écrire autre chose
que des tests).

Tests Jest du testeur : `mobile/src/features/map/tracking/TrackingEndTester.test.tsx`
(22 tests, écrits d'après C6, C7 et l'ADR 0021 § 4 et § 5.2).

`cd mobile && npm run verify`, fin de sortie :

```
Test Suites: 245 passed, 245 total
Tests:       2878 passed, 2878 total
```

## iPhone 17 — « Itinéraire du 4 nov. », 622 m

Trace tirée de la géométrie de la route, une position tous les 5 m
(`essais/08-suivi-velo/t3-outils/trace_from_saved_route.py`), rejouée par
`ios_replay.py`.

| Capture | Attendu | Affiché |
|---|---|---|
| `ios-01-infos-622m-d31.png` | Infos : 622 m, D+ 31 m | 622 m, D+ 31 m, D− 13 m |
| `ios-02-suivi-avant-terminer-300m.png` | après 300 m : reste environ 320 m | « Reste 310 m, D+ restant 25 m » |
| `ios-03-sortie-terminee.png` | « SORTIE TERMINÉE », 300 m | 300 m, D+ 6 m (31 − 25), 1 min |
| `ios-04-apres-fermer-retour-infos.png` | « Fermer » → Infos | Infos |
| `ios-06-arrivee-580m-d27.png` | « ARRIVÉE ! », environ 590 m (arrêt à 30 m de la fin) | 580 m, D+ 27 m, 1 min |
| `ios-07-fermer-arrivee-retour-infos.png` | « Fermer » → Infos | Infos |

Le D+ de l'arrivée (27 m) est calculé sur les positions gardées, pas sur
le tracé : d'où l'écart avec les 31 m de l'écran Infos.

## Émulateur Android (emulator-5584) — circuit de 34,9 km, D+ 459 m

Trace tirée de la géométrie du circuit, une position tous les 50 m, une
par seconde (`android_replay.py`).

| Capture | Attendu | Affiché |
|---|---|---|
| `android-01-infos-boucle-34-9km-d459.png` | Infos : 34,9 km, D+ 459 m | 34,9 km, D+ 459 m, D− 456 m |
| `android-04-suivi-400m.png`, `android-05-boite-terminer.png`, `android-06-sortie-terminee.png` | « Terminer » après 400 m : boîte, puis « SORTIE TERMINÉE », 400 m | boîte, puis 400 m, D+ 5 m, 1 min |
| `android-03-apres-fermer-retour-infos.png` | « Fermer » → Infos | Infos |
| `android-07-arrivee-run2.png` | « ARRIVÉE ! », environ 34,3 km (cordes de la trace jusqu'à 30 m de la fin) | 34,4 km, D+ 436 m, 12 min |
| `android-02-arrivee-36-0km-d478.png` | 1er rejeu, faussé (voir plus bas) | 36,0 km, D+ 478 m, 12 min |

**1er rejeu faussé.** Au démarrage, le panneau affichait « Reste 32,6 km »
au lieu de 34,9 km : la première position reçue était la dernière position
gardée par l'émulateur, 2,3 km plus loin sur le circuit. Le saut jusqu'au
vrai départ compte en ligne droite (ADR 0021 § 4) : environ 1,7 km et du D+
en trop. Le 2e rejeu, avec un départ propre (`adb emu geo fix` du départ
avant de démarrer), donne 34,4 km pour 34,3 km attendus (écart 0,3 %).
Explication déduite des chiffres, pas observée directement.
**Point à traiter** : sur un vrai téléphone, une première position
ancienne (en cache) pourrait aussi fausser la distance réelle. Repris dans
les résultats de la phase.

Le D+ de 436 m est 5 % sous les 459 m de l'écran Infos : une position
tous les 50 m coupe le relief.

## Non vérifié ici

- Maestro sur Android (taps par `adb input tap`, pour ne pas replanter
  l'émulateur) : en T6.
- Retour système d'Android sur l'appareil : Jest seulement (T6).
- Repassage près du départ à mi-parcours sur appareil : Jest seulement.
- D+ comparé à une mesure indépendante : seulement à l'écran Infos.

## Astuces pour T6

- iOS : Maestro `tapOn` par texte ne trouve rien ; utiliser
  `point: "x%,y%"` en pourcentages entiers. `idb` inutilisable.
- Android : avant de rejouer, `adb -s emulator-5584 emu geo fix <lon> <lat>`
  du départ, démarrer le suivi, vérifier que « Reste » vaut la longueur.
