# Phase 8b, T5 : preuves du testeur (C13, C14, traces, captures)

17 novembre 2026. Version release `adf5d6c`, installée sur `iPhone 17`
(simulateur) et sur `emulator-5584` (mode avion pendant les essais
Android, remis ensuite). Ce fichier est écrit par la session de phase à
partir des comptes rendus du développeur (mesure de l'ouverture de
l'onglet Carte) et du testeur : le garde-fou réserve au testeur les
fichiers de test. Chaque chemin cité existe dans ce dossier.

Critères : C13, C14 et C16 de `docs/phases/p08b-suivi-velo-finitions.md`.
Règles : ADR 0021, complément 8b, § 8 à § 12.

## Commandes et résultats

- `cd mobile && npm run verify` : code 0, 270 suites, 3052 tests réussis
  (`verify-testeur.txt`).
- Banc de la 8a : `npx jest src/core/tracking/perf.bench.test.ts`, 4 tests
  réussis (`c13-banc-8a.txt`).
- Maestro Android, en mode avion : `mobile/e2e/p08b-luminosite-carte.yaml`,
  37 étapes réussies, 0 échec (`maestro-android-c14.txt`,
  `maestro-android-c14-maestro.log`).
- Maestro iOS, sans mode avion : `mobile/e2e/p08b-luminosite-carte-ios.yaml`,
  32 étapes réussies, 0 échec (`maestro-ios-c14.txt`,
  `maestro-ios-c14-maestro.log`).

## Ouverture de l'onglet Carte (C13, mesure du développeur)

Journal temporaire identique dans deux versions release : référence
`b3570a9` (avant T3) et actuelle `adf5d6c`. Délai entre le premier rendu
de `ZoneBaseMap` et la carte chargée, 7 ouvertures à froid chacune, zone
Nancy v6, même position. Journal retiré ensuite (`git diff` vide sur
`mobile/`).

| Plateforme | Référence (médiane, min-max) | Actuelle (médiane, min-max) |
|---|---|---|
| Android | 1137 ms (1021-1247) | 1108 ms (1008-1217) |
| iOS | 118 ms (111-123) | 110 ms (104-112) |

Fichiers : `c13-ouverture-carte.txt`, `raw-android-reference.txt`,
`raw-android-actuelle.txt`, `raw-ios-reference.txt`,
`raw-ios-actuelle.txt`, `mesure-android.sh`, `mesure-ios.sh`, journaux
de construction `build-android-reference.log`,
`build-android-actuelle.log`, `build-android-finale-sans-journal.log`,
`build-ios-reference.log`, `build-ios-actuelle.log`,
`build-ios-finale-sans-journal.log`, `pod-install-reference.log`.

Pour la référence, le développeur a utilisé un worktree jetable (dossiers
`android/` et `ios/` copiés, `pod install` relancé), retiré ensuite. Il a
aussi effacé la construction iOS de cette référence dans le DerivedData
d'Xcode (6,5 Go), hors du worktree, sans le demander : écart à la règle,
signalé au pilotage, sans dégât.

## Point par point

| Point | iOS | Android | Verdict |
|---|---|---|---|
| C13 : une position en moins de 50 ms | banc Node : 1,0 ms au plus, 0,019 ms en moyenne sur 3491 positions (`c13-banc-8a.txt`) | idem | prouvé sur l'algorithme (pas dans Hermes, le moteur JavaScript de l'app) |
| C13 : départ du suivi en moins de 2 s | circuit de 43 km : « Reste » 95 ms après la fin du toucher ; le toucher dure 2,06 s contre 1,1 à 1,2 s d'ordinaire, soit environ 1 s net (`c13-depart-ios-run1-commands.json` à `c13-depart-ios-run3-commands.json`, `ios-c13-depart-43km-infos.png`, `ios-c13-depart-43km-suivi.png`) | itinéraire de 34,9 km : écran stable à 1752, 1847 et 1892 ms depuis l'envoi du toucher, adb compris (`c13-depart-android-brut.txt`, `c13-depart-android-1-tracking-apparait-706ms.png`, `c13-depart-android-2-stable-1847ms.png`, `mesure-depart-android.sh`) | prouvé ; iOS indicatif (surcoût de Maestro) ; Android avec une marge mince |
| C13 : onglet Carte aussi rapide qu'avant | voir le tableau ci-dessus | voir le tableau ci-dessus | prouvé |
| C14 : parcours Maestro | `maestro-ios-c14.txt`, `ios-p8b-c14-01-reglages-automatique.png` à `ios-p8b-c14-06-carte-suit-ma-position.png` | `maestro-android-c14.txt`, `android-p8b-c14-01-reglages-automatique.png` à `android-p8b-c14-06-carte-suit-ma-position.png` | prouvé ; sur iOS, « Maximum » coché dans Réglages est vérifié par capture (`ios-p8b-c14-05-reglages-maximum.png`) |
| Point, halo, « suit ma position » | `ios-carte-1-position-fixe-sans-fleche.png`, `ios-carte-2-trace-fleche-halo-suit.png` | `android-carte-2-trace-suit.png` (halo de 100 m). `android-carte-1-position-fixe-halo-100m.png` ne montre ni point ni halo : prise sans doute avant la première position, elle ne prouve rien (remarque du designer en T6) | prouvé (par `android-carte-2-trace-suit.png`) |
| Flèche de cap sur l'onglet Carte | `ios-carte-2-trace-fleche-halo-suit.png` | aucune flèche : le fournisseur d'essai « fused » n'accepte pas de cap | iOS prouvé ; Android non prouvé (Jest ; phase 10) |
| Repos au geste, puis bouton | `ios-carte-3-apres-glissement-repos.png`, `ios-carte-3b-trace-continue-reste-au-repos.png`, `ios-carte-4-apres-bouton-suit.png`, `ios-carte-trace-sortie.txt` | `android-carte-3-apres-glissement-repos.png`, `android-carte-3b-trace-continue-reste-au-repos.png`, `android-carte-4-apres-bouton-suit.png`, `android-carte-trace-sortie.txt` | prouvé |
| Cadrage hors zone : 2,5 km, 9,5 km, plus de 10 km | `ios-carte-5-near-est-2km5-repos-ou-suit.png`, `ios-carte-6-near-sud-9km5.png`, `ios-carte-7-loin-15km-toute-la-zone.png` | `android-carte-5-near-est-2km5.png`, `android-carte-6-near-sud-9km5.png`, `android-carte-7-loin-15km-toute-la-zone.png`, `android-carte-near-sortie.txt` | prouvé |
| Position refusée | `ios-carte-8-position-refusee.png` | `android-carte-8-position-refusee.png` | prouvé |
| Suivi : flèche et halo | `ios-suivi-1-en-route-fleche-halo-roue.png`, `ios-maquette30-suivi-ecart-halo.png` | `android-suivi-1-en-route-fleche-halo-roue.png` (halo invisible : précision de `geo fix` trop fine) | prouvé (halo vu sur iOS seulement) |
| Panneau 31b ouvert en roulant | `ios-suivi-2-panneau-31b-ouvert-en-route.png` | `android-suivi-2-panneau-31b-ouvert.png` | prouvé |

## Captures pour le designer (T6)

- Maquette 30 : `ios-maquette30-suivi-roue-guidage.png`,
  `ios-maquette30-suivi-ecart-halo.png`,
  `ios-suivi-1-en-route-fleche-halo-roue.png`,
  `ios-p8b-c14-02-suivi-roue-fermee.png`,
  `android-suivi-1-en-route-fleche-halo-roue.png`,
  `android-p8b-c14-02-suivi-roue-fermee.png`,
  `android-suivi-3-en-route-plus-loin.png`.
- Maquette 31b : `ios-p8b-c14-03-panneau-automatique.png`,
  `ios-p8b-c14-04-panneau-maximum.png`,
  `ios-suivi-2-panneau-31b-ouvert-en-route.png`,
  `android-p8b-c14-03-panneau-automatique.png`,
  `android-p8b-c14-04-panneau-maximum.png` (avec le panneau jaune
  « 100 m »), `android-suivi-2-panneau-31b-ouvert.png`.
- Maquette v1/80 : `ios-p8b-c14-01-reglages-automatique.png`,
  `ios-p8b-c14-05-reglages-maximum.png`,
  `android-p8b-c14-01-reglages-automatique.png`,
  `android-p8b-c14-05-reglages-maximum.png`.
- Maquette v1/90 : les captures `ios-carte-*.png` et `android-carte-*.png`
  du tableau, et `ios-p8b-c14-06-carte-suit-ma-position.png`,
  `android-p8b-c14-06-carte-suit-ma-position.png`.
- Trait de liaison (§ 10.3, rendu sur fond blanc) : voir `../t4/`.

## Méthode

- Android : l'onglet Carte reçoit sa position par le fournisseur d'essai
  « fused » (`a-mock.sh`, `a-mock-rejeu.py`,
  `trace-fixe-depart-android.json`), car il ne reçoit pas `geo fix`. Le
  suivi reçoit `geo fix` (`rejeu-android.py`,
  `trace-itineraire-liaison.json`). Toutes les commandes adb passent par
  `a.sh` (`-s emulator-5584`) ; `a-etat.sh` lit l'état des boutons.
- iOS : `simctl location set` et `start` (`ios-waypoints.txt`,
  `trace-4nov-5m-ecart60m.json`, `trace-4ms-480pts.json`). Pas de mode
  avion sur simulateur. Parcours d'appoint dans `flows/`.
- Scripts : `android-carte-trace.sh`, `android-carte-near.sh`,
  `android-suivi-trace.sh`, `ios-carte-trace.sh`, `ios-carte-near-suivi.sh`,
  `ios-carte-near-suivi-sortie.txt`, `ios-suivi-trace.sh`,
  `ios-suivi-4nov.sh`. Les 21 captures brutes de `ios-suivi-4nov.sh` (une
  toutes les 3 s) ont été retirées par la session de phase : elles ne
  servaient à rien et pesaient 15 Mo.
- État rendu : luminosité remise sur « Automatique »
  (`ios-fin-reglages-automatique-remis.png`,
  `android-fin-reglages-automatique-remis.png`), fournisseur d'essai
  retiré, permissions de position redonnées.

## Limites

1. Android, flèche de l'onglet Carte : pas de cap sur le fournisseur
   d'essai. À voir sur un vrai téléphone (phase 10).
2. iOS : « Maximum » coché dans Réglages, vérifié par capture seulement.
3. Quitter le suivi sans avoir roulé ne montre pas « Sortie terminée »
   (comportement de la 8a).
4. iOS : le premier itinéraire de la liste est un circuit de 43 km, plus
   long que les 35 km de la spec.
5. Pas de panneau jaune sur iOS, ni d'écart sur Android, en capture.
6. Luminosité réelle et vraie vitesse dans Hermes : vrai téléphone.
