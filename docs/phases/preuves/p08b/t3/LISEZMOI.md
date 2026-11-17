# Phase 8b, T3 : onglet Carte et point du suivi — preuves du testeur

16 et 17 novembre 2026. Tests du testeur en version finale (release) sur
iOS (simulateur `iPhone 17`) et sur Android (émulateur `emulator-5584`).
Ce fichier est écrit par la session de phase à partir du compte rendu du
testeur : le garde-fou réserve au testeur les fichiers de test. Chaque
chemin cité ci-dessous existe dans ce dossier.

Critère : C10 de la spec (`docs/phases/p08b-suivi-velo-finitions.md`).
Règles : ADR 0021, complément 8b, § 9 et contrôles T3-a et T3-b.

## Constructions et tests

- `cd mobile && npm run verify` : avant les tests du testeur, 3024 tests
  réussis (`verify-avant.txt`). Après ses ajouts, 3035 réussis et 1 échec
  voulu, qui prouve le défaut D1 (`verify-final.txt`). La sortie après la
  correction de D1 est notée plus bas.
- Android : `cd mobile/android && ./gradlew app:assembleRelease`
  (`gradle-release.txt`), puis `adb -s emulator-5584 install -r`. Toutes
  les commandes `adb` passent par `a.sh`, qui impose `-s emulator-5584`.
- iOS : `npx expo run:ios --device "iPhone 17" --configuration Release`
  (`ios-build.txt`).

Tests ajoutés par le testeur (dans `mobile/src/`) :
- `features/map/ZoneMapT3Testeur.test.tsx` (5 tests) : toucher sans
  position puis glissement ; 9,5 km au sud ; près d'un coin ; plus de
  10 km ; « Recentrer » refait le cadrage d'ouverture.
- `core/zones/openingT3Testeur.test.ts` (5 tests) : villes dedans et
  dehors, frontière 9,9 / 10,1 km, zoom 11,57 de la maquette 90.
- `features/map/UserPuckLayersT3Testeur.test.tsx` : valide chaque filtre
  du point avec le validateur officiel `@maplibre/maplibre-gl-style-spec`.

## Point par point

| Point | iOS | Android | Verdict |
|---|---|---|---|
| T3-a : un seul point (pas de point natif en plus) | `ios-a-2-trace-suit.png` | `android-a-2-trace-suit.png` | prouvé |
| T3-a : la caméra suit une trace rejouée | `ios-a-2-trace-suit.png`, `ios-suivi-1-en-roulant.png` | `android-a-2-trace-suit.png`, `android-a-8-avant-double-toucher.png` | prouvé |
| T3-a : un glissement remet le bouton au repos | `ios-a-3-apres-glissement.png`, `ios-a-3b-trace-continue-apres-glissement.png` | `android-a-3-apres-glissement.png`, `android-a-3b-trace-continue.png` | prouvé |
| T3-a : le bouton remet « suit » | `ios-a-4-apres-bouton.png` | `android-a-4-apres-bouton.png` | prouvé |
| T3-a : double toucher pendant « suit » | garde le suivi : `ios-zoom-journal.txt`, `ios-a-5-avant-double-toucher.png`, `ios-a-6-apres-double-toucher.png` | garde le suivi : `android-a-8-avant-double-toucher.png`, `android-a-9-apres-double-toucher.png` | prouvé |
| T3-a : pincement à deux doigts | non faisable | non faisable (`sendevent` refusé sans droits root ; `a-pincement.py`) | non prouvé (phase 10) |
| T3-a : position fixe, rond sans flèche | `ios-a-1-position-fixe.png` | `android-a-1-position-fixe.png` | prouvé |
| Toucher sans position, puis glissement (cas du relecteur) | non reproductible (voir limites) ; `ios-sanspos-journal.txt` | bouton « suit » puis repos, pas de saut à la première position : `android-sanspos-journal.txt`, `android-sanspos-1-apres-toucher.png` à `android-sanspos-4-apres-2e-fix.png` | Android prouvé ; iOS couvert par Jest seulement |
| T3-b : ouverture à 2,5 km, 9,5 km, près d'un coin | `ios-ouverture-est25.png`, `ios-ouverture-sud95.png`, `ios-ouverture-coin.png` | `android-ouverture-est25.png`, `android-ouverture-sud95.png`, `android-ouverture-coin.png` | prouvé |
| T3-b : centre sur le bord accepté (iOS) et non rabattu (Android), position visible avec ses marges | point à environ 32 pt de « Nouvel itinéraire » (sud), 54 pt du bord (coin) | 32 dp (sud) | prouvé |
| T3-b : message « hors de la zone » d'au moins 48 de haut | environ 47 à 48 pt | 48 dp | prouvé |
| T3-b : plus de 10 km, toute la zone | `ios-ouverture-loin.png` | `android-ouverture-loin.png` | prouvé |
| Question (b) : « Recentrer » refait le cadrage | `ios-recentrer-est25-1-apres-glissement.png`, `ios-recentrer-est25-2-apres-recentrer.png` | `android-recentrer-est25-2-apres-recentrer.png` et `android-recentrer-sud95-2-apres-recentrer.png`, identiques octet pour octet aux ouvertures ; `android-recentrer-journal.txt` | prouvé |
| Ouverture dans la zone : centrée, zoom 14, « suit » | état « suit » lu | `android-ouverture-dans-la-zone.png`, état « suit » lu | prouvé (zoom jugé à l'image) |
| Position refusée : viseur barré, toucher → boîte « Position désactivée » | `ios-refuse-1-ouverture.png`, `ios-refuse-2-apres-toucher.png` | `android-refuse-0.png`, `android-refuse-1-apres-refus.png`, `android-refuse-2-apres-toucher.png`, `android-refuse-3-boite.png` | prouvé |
| Point du suivi : flèche (cap) et halo | `ios-suivi-1-en-roulant.png` | `android-suivi-1-en-roulant.png` | prouvé |
| Point du suivi : gris sans flèche, GPS perdu | `ios-suivi-2-gps-perdu-18s.png` | `android-suivi-2-gps-perdu.png`, `android-suivi-3-gps-coupe-16s.png` | **échec D1**, corrigé ensuite (voir plus bas) |
| Écran de création : point avec flèche et halo | `ios-creation-1-en-roulant.png` (flèche) | `android-creation-3-precision-100m.png` (halo ; pas de cap, voir limites) | prouvé |
| Écran de création : pas d'état « suit » | état « Recentrer » lu | `android-creation-1.png`, `android-creation-2-zoom.png` | prouvé |
| Halo au rayon exact | non mesuré à l'image | non mesuré | non prouvé (Jest : 12,7 pt pour 5 m au zoom 17) |
| C13 : une position en moins de 50 ms | banc Node `perf.bench.test.ts` : 1,0 ms au plus, 0,020 ms en moyenne sur 3491 positions | idem | partiel (pas sur appareil) |
| C13 : l'onglet Carte s'ouvre aussi vite qu'avant | non mesuré | démarrage à froid : 297 à 351 ms (`android-c13-demarrage-a-froid.txt`), sans référence d'avant | non prouvé ; reporté en T5 |

## Défaut D1 : la flèche reste quand le GPS est perdu

- Entrée : suivi en route, puis plus aucune position. Android :
  `cmd location set-location-enabled false` pendant 16 s. iOS :
  `xcrun simctl location … clear` pendant 18 s.
- Attendu (ADR 0021, question (a)) : rond gris, sans flèche.
- Obtenu, sur les deux : rond gris **avec** la flèche blanche. « Signal
  GPS perdu » s'affiche bien.
- Cause : dans `UserPuckLayers.tsx`, le filtre `['==', 1, 0]` n'est pas
  valide (la clé doit être une chaîne). MapLibre natif le refuse et garde
  le filtre d'avant. L'imitation de MapLibre dans Jest ne valide rien,
  d'où le test du testeur avec le validateur officiel.

## Limites et surprises

1. **Android : l'émulateur n'envoie pas `geo fix` à l'onglet Carte.**
   L'onglet demande une précision « BALANCED », comme avant la 8b, et le
   GPS de l'émulateur reste éteint. Ce n'est pas une régression. Le
   testeur a utilisé un fournisseur de position d'essai « fused »
   (`a-mock.sh`, `a-mock-rejeu.py`, `a-ouverture.sh`), retiré à la fin.
   Ce fournisseur ne donne pas de cap : sur Android, l'onglet Carte et la
   création sont vus sans flèche. La flèche Android est prouvée sur
   l'écran de suivi (GPS de l'émulateur), et la flèche de l'onglet Carte
   sur iOS.
2. **iOS : le simulateur garde une position en mémoire** même après
   `location clear` : le cas « toucher sans position » n'y est pas
   reproductible.
3. Pour voir le point gris, il faut couper le GPS (Android) ou effacer la
   position (iOS) : sinon les simulateurs répètent la dernière position.
4. Android : deux `input tap` rapprochés ont ouvert la fiche d'un circuit
   (bouton remis au repos, comme prévu). Le double toucher valable
   utilise deux `input swipe` de 40 ms, à 150 ms d'écart (`a-touch.sh`).
5. Cas « plus de 10 km » : le point peut sortir à moitié en haut de
   l'écran (`ios-ouverture-loin.png`). C'est le comportement d'avant,
   gardé par la spec.

## Scripts et données

`a.sh`, `a-etat.sh`, `a-tap-text.sh`, `a-touch.sh`, `a-suivi-a.sh`,
`a-pincement.py`, `rejeu-android.py`, `trace-4ms-480pts.json`,
`ios-ouverture.sh`, `ios-recentrer-near.sh`, `ios-suivi-a.sh`,
`ios-waypoints.txt`, `flows/`, `maestro-est25-recentrer.txt`,
`maestro-est25-swipe.txt`, `android-nav-1.png`.

## Après correction de D1

- Correction : `mobile/src/features/map/UserPuckLayers.tsx` met le filtre
  `['boolean', false]` quand le GPS est perdu. Le développeur a mis à
  jour `TrackingPuck8b.test.tsx`.
- `npm run verify` : 265 suites, 3036 tests réussis, test du testeur
  `UserPuckLayersT3Testeur.test.tsx` compris (`verify-apres-d1.txt`).
- Constructions release : Android `gradle-release-apres-d1.txt`
  (installé par `install -r`) ; iOS `ios-build-apres-d1.txt`.
- Cas rejoué : suivi en route, GPS perdu plus de 10 s, puis retour du GPS.
  - Android : trace rejouée (25 positions), `cmd location
    set-location-enabled false` pendant 16 s, puis 8 positions de plus.
    Captures : `android-suivi-4a-avant-coupure.png`,
    `android-suivi-4-gps-perdu-apres-d1.png`,
    `android-suivi-5-gps-revenu-apres-d1.png`.
  - iOS : `simctl location start`, `simctl location clear` pendant 18 s,
    puis une nouvelle trace. Captures : `ios-suivi-3a-avant-coupure.png`,
    `ios-suivi-3-gps-perdu-apres-d1.png`,
    `ios-suivi-5-gps-revenu-apres-d1.png`.
- Résultat sur les deux : GPS perdu, rond gris **sans flèche** et
  « Signal GPS perdu » ; GPS revenu, rond bleu avec la flèche blanche, et
  le texte disparaît. Sur iOS, le halo bleu clair reste visible pendant
  la perte (précision de la dernière position gardée) : à regarder par
  le designer en T6.
- **Verdict D1 : corrigé et prouvé.** La ligne « gris sans flèche » passe
  à « prouvé ». Restent non prouvés : le pincement à deux doigts, le cas
  du relecteur sur iOS, le rayon du halo mesuré à l'image, la flèche de
  l'onglet Carte sur Android, et C13 pour l'ouverture de l'onglet Carte
  (reporté en T5).
