# Phase 8a — preuves finales du testeur (code b5c9ee0)

Builds release, sans menu de développement. Android : `emulator-5584`,
APK du 16 novembre 17 h 25 (« BUILD SUCCESSFUL » vérifié avant
l'installation). iOS : « iPhone 17 », release. Écrit par la session de
phase d'après le rapport du testeur (le garde-fou ne lui permet d'écrire
que des tests).

`cd mobile && npm run verify`, fin de sortie :

```
Test Suites: 249 passed, 249 total
Tests:       2902 passed, 2902 total
```

## C6 — 100 m roulés avant l'arrivée

Itinéraire non bouclé ; suivi démarré en étant placé sur le point d'arrivée.
Avant la correction : `../t6-testeur/ios-p5-defaut-arrivee-immediate-0m.png`.

| Capture | Attendu | Affiché |
|---|---|---|
| `ios-03-c6-apres-position-4s.png`, `ios-04-c6-sur-place-14s.png` (« Itinéraire du 4 nov. », 622 m) | pas d'« ARRIVÉE ! » sur place | panneau jaune « Arrivée 10 m », Reste 0 m, pas d'arrivée ; « Signal GPS perdu » (le simulateur n'envoie qu'une position) |
| `android-05-c6-demarrage-sur-arrivee-4s.png`, `android-06-c6-sur-place-12s.png` (itinéraire à la main de 359 m) | idem | panneau jaune « Arrivée 10 m », Reste 0 m, pas d'arrivée |

## Arrivée et « Terminer »

| Capture | Attendu | Affiché |
|---|---|---|
| `ios-final-c13a-06-arrivee.png` (Maestro `mobile/e2e/p08a-suivi-arrivee-ios.yaml`, réussi) | « ARRIVÉE ! » avec distance, D+, durée | 720 m (le détour de l'écart allonge), D+ 46 m, 2 min. Un 2e rejeu sans écart : 580 m, D+ 29 m, 1 min |
| `ios-final-c13a-07-apres-fermer.png` | « Fermer » → Infos | Infos |
| `ios-term-c13b-01` à `-04` (Maestro `p08a-suivi-terminer-ios.yaml`, réussi) | boîte, « SORTIE TERMINÉE », Infos | 190 m, D+ 5 m, 1 min ; puis Infos |
| `android-18-arrivee.png`, `android-19-apres-fermer-arrivee.png` | « ARRIVÉE ! » puis Infos | 330 m, D+ 21 m, 1 min ; puis Infos |
| `android-13-boite-terminer.png`, `android-14-sortie-terminee.png` | boîte puis « Sortie terminée » | boîte ; 2,4 km, D+ 61 m pour environ 200 m rejoués : faussé par l'émulateur (voir Réserves) |

## M3 — écart en pointillés

| Capture | Attendu | Affiché |
|---|---|---|
| `ios-m3-ecart-60m-pointilles-stable.png`, zoom `ios-m3-zoom-stable-crop.png` | pointillés espacés d'environ 10 pt | « 60 m jusqu'au tracé » ; points à 30 px pour 3 px/pt, soit environ 10 pt |
| `ios-05-m1-approche-rond-plein.png`, `android-10-approche-1.png` | idem, à grande distance | environ 10 pt (iOS 30 px / 3 ; Android 25 px / 2,6) |
| `ios-m3-ecart-40m-transitoire.png`, `ios-m3-zoom-transitoire-4pt-x4.png` | idem | points presque jointifs (environ 4 pt) juste à l'apparition de l'écart, pendant le recadrage ; 10 pt quelques secondes après |

## M1 et M2 — pictogrammes

| Capture | Pictogramme |
|---|---|
| `ios-02-m1-recherche-gps-mire.png` | mire GPS : « Recherche du GPS… » |
| `ios-05-m1-approche-rond-plein.png` | rond plein vert : « 1,4 km jusqu'au départ » |
| `ios-m3-ecart-60m-pointilles-stable.png` | trois ronds : écart au tracé |
| `ios-panneau-jaune-arrivee-50m.png` | drapeau à damier : « Arrivée 50 m », panneau jaune |

## M4 — cadrage au démarrage

`ios-final-c13a-02-depart.png` (itinéraire de 622 m entier à l'écran,
Reste 620 m, D+ 31 m), `android-11-depart-reste-359.png` (Reste 360 m).
Contrôle visuel ; le zoom n'est pas mesuré en chiffres.

## Autres captures

`ios-suivi-panneau-reste.png`, `ios-final-c13a-01-infos.png`,
`-03-direction-changee.png`, `-05-retour-sur-le-trace.png`,
`android-17-suivi-200m-b.png`, `android-00` à `android-04` (création de
l'itinéraire d'essai de 359 m, mode « À la main »), `android-07`,
`android-09`, `android-15`, `android-16`.

## Réserves

- L'émulateur Android répète d'anciennes positions (défaut connu, reporté
  à la phase 10) : 2,4 km affichés pour environ 200 m rejoués
  (`android-14`), après plusieurs `geo fix` éloignés. Le rejeu suivant,
  propre, donne 330 m pour 359 m de tracé. L'état « rond plein » n'a pas
  pu être obtenu sur Android pour la même raison.
- « Signal GPS perdu » : obtenu sur iOS ; pas sur Android (l'émulateur
  répète la position chaque seconde).
- Panneau jaune « Arrivée 10 m » avec « Reste 0 m » sur le point
  d'arrivée : petit écart de cohérence entre les deux chiffres.
- Pointillés plus serrés (environ 4 pt) pendant le recadrage, vus une fois
  sur iOS. Cause probable, non vérifiée : l'espacement est calculé avec le
  zoom gardé dans l'état (`TrackingMap.tsx`), en retard sur la caméra.
