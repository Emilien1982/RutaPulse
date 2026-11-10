# Essai 08 (T1, partie B) : le suivi sur les deux simulateurs

Essai jetable de la phase 8a, fait le 10 novembre 2026 sur iOS (iPhone 17,
iOS 26.5) et sur Android (émulateur `emulator-5584`, Pixel 6, API 34), avec
des builds **release**. Le code de l'essai est sur la branche locale jetable
`claude/p08a-essai` (jamais poussée) ; ce dossier n'en garde que les preuves.
Un écran de test (`/essai`) a servi : carte de la zone Nancy v6, suivi par
`camera.easeTo`, `useKeepAwake`, bouton B4. Tout est du code minimal, pas
la maquette 30.

## Résumé

| | iOS | Android | Verdict |
|---|---|---|---|
| B1 trace rejouée | prouvé (1 position par seconde, cap fourni) | prouvé (1 par seconde, cap fourni) | **prouvé**, `travel` de Maestro marche sur les deux |
| B2 caméra | prouvé | prouvé | **prouvé** pour le suivi et le geste ; « sans saccade » non jugé (voir plus bas) |
| B3 écran allumé | prouvé par `isActivated` (iOS ne se lit pas autrement) | prouvé par `dumpsys power` | **prouvé** (iOS : le levier ; l'extinction réelle du téléphone n'est pas observable) |
| B4 `traceRoute` dans l'app | identique au Mac (4 itinéraires) | identique au Mac, sauf un séparateur décimal dans un texte parlé | **prouvé**, 10 à 210 ms |
| B5 vrai GPX VTT | **pas de vrai GPX** ; trace simulée | | **partiel** : 2,1 % sans direction (seuil 10 %) |
| B6 deux formes recalées | identiques sur 1 et 2, pas sur 3 et 3d | idem | **prouvé** (identiques ou non, comme sur le Mac) |

## B1. Une trace rejouée fait avancer la position

- iOS : `xcrun simctl location <udid> start --speed=4 <points>` (points
  séparés, 20 m entre deux). `watchPositionAsync` (`BestForNavigation`,
  `timeInterval: 1000`) rend **une position par seconde**, `heading`
  présent (course, 157 à 190 degrés sur la trace) et `speed` = 4. Preuve :
  `preuves/ios-log-complet.txt` (lignes `POS`).
  Avec `set` seul : une seule position, `heading` = -1.
- Android : `adb -s emulator-5584 emu geo fix <lon> <lat>` une fois par
  seconde (`b1-android-rejeu.py`). Une position par seconde, `heading`
  présent (calculé par l'émulateur d'après les deux dernières positions),
  `speed` **peu fiable** (0,2 à 4,4 m/s pour 4 m/s réels, à cause de la
  gigue des appels `adb`). Preuve : `preuves/android-logcat-b1b2.txt`.
  Une position « par défaut » de l'émulateur (48.83092, 5.98405) apparaît
  avant la trace.
- Maestro `travel` (`requetes/b1-maestro-travel.yaml`, 7 points, 4 m/s) :
  **marche sur les deux**. iOS : une position tous les 100 ms, `heading` =
  -1, `speed` = -1 (`preuves/b1-ios-maestro-travel.txt`). Android : une
  position toutes les 0,9 s, `heading` 0, `speed` 0, `mocked: true`
  (`preuves/b1-android-maestro-travel.txt`, logcat).
- Surprises : `travel` ne donne pas de cap ; sur Android, Maestro a planté le
  système de l'émulateur une fois (`system_server` mort, démarré de nouveau
  par `adb reboot`) pendant un `tapOn`, pas pendant `travel`. À savoir pour
  les parcours Maestro.

## B2. Caméra et geste

- `camera.easeTo({ center, bearing, zoom: 16, padding: { top: 350 }, duration: 1000 })`
  une fois par seconde (`setInterval`), cap = `coords.heading` ou, à défaut,
  relèvement calculé entre deux positions. Les journaux `CAM easeTo` et
  `REGION did` montrent un centre qui suit la position et un cap qui
  tourne (iOS : 157 à 205 degrés ; Android : 198 à 205 degrés) :
  `preuves/ios-log-complet.txt`, `preuves/android-logcat-b1b2.txt`.
  Captures : `preuves/ios-b2-suivi-t32.png` (la carte tourne et suit,
  noms de rues tournés selon le cap), `preuves/android-b2-suivi-t25.png`
  (carte tournée selon le cap, zoom 16 ; le texte de l'écran de test est
  coupé en haut, sans importance). Le premier essai Android n'avait pas
  touché « Suivi » (le bouton avait changé de place) : seul le deuxième, celui
  de `android-logcat-b1b2.txt`, compte.
- **Geste détecté** : `onRegionWillChange` et `onRegionDidChange` donnent
  `userInteraction: true` pour un glissement (iOS par Maestro `swipe`,
  Android par `adb input swipe`) et `false` pour les `easeTo` du code
  (`animated: true`). Les 10 s de pause fonctionnent (`CAM paused 9 s left`
  ... puis reprise) : `preuves/ios-log-complet.txt`,
  `preuves/android-logcat-geste.txt`. Captures : `ios-b2-apres-geste.png`,
  `android-b2-apres-geste.png`.
- Points d'attention : (1) un geste long donne **plusieurs** événements
  `user=true` (Android : 2 `will` et 2 `did`), la pause se prolonge à chaque
  fois, c'est voulu mais à écrire ; (2) l'événement `did` d'un `easeTo`
  arrive en retard d'un cycle (son centre est celui du cycle précédent) : il
  ne faut pas s'en servir pour lire la position de la caméra ;
  (3) `easeTo` renvoyé chaque seconde avec `duration: 1000` : les journaux
  ne montrent aucune erreur, mais « sans saccade » ne se juge pas sur des
  captures ni en simulateur. À regarder sur téléphone (phase 10).

## B3. Écran allumé

- iOS : `expo-keep-awake` 58.0.3 expose `isActivated` (lit
  `UIApplication.shared.isIdleTimerDisabled`). Journal
  (`preuves/ios-log-complet.txt`, lignes `KA` et `APPSTATE`) :
  `false` avant, `true` après `useKeepAwake`, **`false` en arrière-plan**
  (le module le coupe tout seul), **`true` au retour**, `false` après
  démontage. Le simulateur ne s'éteint pas de lui-même : l'extinction
  réelle n'est donc pas observable. Ce qui est prouvé : le verrou est
  posé, coupé en arrière-plan et reposé au retour.
- Android : délai de veille mis à 15 s
  (`settings put system screen_off_timeout 15000`, remis à `2147483647`
  ensuite). Sans `useKeepAwake` : l'écran s'éteint (`Asleep`) à +25 s.
  Avec : `Awake` à +26 s, avec `SCREEN_BRIGHT_WAKE_LOCK
  'WindowManager/displayId:0'` et `mHoldScreenWindow` = l'app
  (`preuves/android-b3-dumpsys.txt`). Arrière-plan : verrou relâché à
  l'instant (écran éteint à son tour au bout du délai, normal). Retour
  au premier plan avant le délai : verrou repris, `Awake` à +25 s
  (`preuves/android-b3-retour-dumpsys.txt`). Après démontage : `Asleep`
  à +26 s.
- Surprise : sur Android, le changement de `screen_off_timeout` éteint
  l'écran tout de suite si l'écran est resté inactif plus longtemps que le
  nouveau délai ; il faut réveiller l'écran avant de mesurer.

## B4. `traceRoute` dans l'app, en release

- Ajouté au module `valhalla-route` : iOS `AsyncFunction("traceRoute")`
  (`traceRoute(rawRequest:)`), Android `AsyncFunction("traceRoute")`
  (`traceRouteRaw`), TypeScript `traceRoute(requestJson)`, sur le modèle
  de `traceAttributes`. Même gestion d'erreur : un refus revient en JSON
  `{code, message}`.
- Requêtes : celles de l'ADR (un point tous les 20 m, `map_snap`, coût
  `bicycle`/`mountain`/`use_roads: 0`, `fr-FR`), pour les 4 lignes
  (`requetes/b4-<n>-trace_route.json`) ; ce sont les lignes de l'essai A :
  1 itinéraire créé, 2 circuit de Haye, 3 GPX simulé, 3d circuit sans bruit.
- **Mêmes réponses que sur le Mac** (`python3 -I b4-compare.py <dossier>`) :
  - iOS : les 8 réponses (`trace_route` et `trace_attributes`, 4 lignes)
    sont **identiques au JSON près** (`preuves/b4-ios-vs-mac.txt`).
  - Android : les 4 `trace_attributes` sont identiques ; les 4
    `trace_route` ne diffèrent que par le champ parlé
    `verbal_post_transition_instruction` : « 1.5 kilomètres » (Android)
    contre « 1,5 kilomètres » (Mac et iOS), **un séparateur décimal qui
    suit la langue du téléphone**. Les textes écrits (`instruction`), les
    types, les indices, les longueurs et la forme sont identiques
    (`preuves/b4-android-vs-mac.txt`). L'app n'utilise pas ce champ.
  - Le Mac de comparaison utilise la **même** `valhalla_tiles.tar` que les
    simulateurs (empreinte `aee29641…`, copiée du simulateur iOS) : la
    copie du scratchpad de la session (`2076a43c…`) a une autre empreinte
    que la v6 installée, bien qu'elle ait la même taille.
- Temps (appel natif seul, `performance.now()` autour de
  `await valhalla.traceRoute(...)`, ligne 1 = 34 km, 1 703 points) :
  | | 1er appel | 2e et 3e | `traceAttributes` |
  |---|---|---|---|
  | iOS ligne 1 | 89 ms | 12 à 13 ms | 11 ms |
  | iOS ligne 3 (GPX) | 22 ms | 17 à 18 ms | 15 ms |
  | Android ligne 1 | 120 à 206 ms | 12 à 14 ms | 11 à 13 ms |
  | Android ligne 3 | 28 à 32 ms | 16 à 18 ms | 15 à 16 ms |
  Départ du suivi (C12 : < 2 s) : traceRoute + traceAttributes font
  **moins de 0,25 s** sur ces simulateurs. **Ce sont des simulateurs sur un
  Mac** : le temps d'un vrai téléphone n'est pas mesuré.
- Refus : forme vide → `{"code":114,"message":"Insufficiently specified
  required parameter 'shape' or 'encoded_polyline'"}` ; forme hors zone →
  `{"code":172, "message":"Exceeded breakage distance for all pairs: 2000
  meters"}`. Dans les deux cas, du JSON, pas de plantage (iOS et Android).
  Sur Android le message est enveloppé : `ValhallaError(code=114, ...)`.
- Journaux : `preuves/ios-log-b4.txt`, `preuves/android-logcat-b4.txt`,
  réponses brutes `preuves/ios-raw/`, `preuves/android-raw/`,
  `preuves/mac-*`.

## B5. Un vrai GPX VTT : pas trouvé, trace simulée

Aucun GPX de sortie VTT dans `~/dev_ai/vtt-nav/` ni `~/Downloads` (vide) ;
le dépôt n'a que des GPX de 3 à 4 points. **La trace ci-dessous est
SIMULÉE, pas un enregistrement.**

- Circuit : « Petite Suisse Lorraine à VTT » (relation 15712020, la seule
  autre ligne du paquet Nancy v6 avec celui de Haye), 34 904 m.
- Simulation (`b5-gpx-simule.py`) : un point par seconde à 4 m/s (8 727
  points), erreur GPS lente (AR(1), corrélation d'environ 33 s), erreur
  moyenne de 3,8 m (3 à 5 m en variant : 2,8 m et 4,6 m aussi essayés), 5
  graines pour 3 m/axe et 3 pour 2,2 et 3,6. Éclaircie à un point tous les
  20 m (environ 1 775 points) puis `trace_route` `map_snap` sur le Mac
  (Docker Valhalla 3.9.1, mêmes tuiles que les simulateurs).
- **Part sans direction : 2,1 % partout** (746 m sur 35 460 m ; entre
  2,1 % et 2,1 % sur les 11 essais, `preuves/b5-sortie.txt`), sous le seuil
  de 10 %. Longueur recalée / longueur de la trace : 95,6 % à 97,1 %. Et
  c'est **toujours le même morceau, la fin** : du km 34,69 au km 35,44,
  écart jusqu'à 270 m (`preuves/b5-ou-sans-direction.txt`) : la fin du
  circuit n'est pas praticable à vélo pour Valhalla (déjà vu sans bruit à
  l'essai A). Donc le bruit seul ne coupe rien ici, et la part « non recalé »
  d'un vrai GPX reste **à mesurer** sur un vrai enregistrement.
- 52 directions (55 pour 1 graine sur 5), 5 « de moins de 30 m » ; la
  liste de la graine 1 est dans `preuves/b5-directions-seed1.md`. Pas de
  demi-tour fantôme sur la graine 1 ; la graine 4 donne 3 directions de
  plus (voir `b5-mesures.json`, `smells` = 8) : non relues une à une.
- Les directions n'ont pas été relues par un cycliste.
- Fichiers : `preuves/b5-gpx-simule-seed1.gpx` (la trace simulée),
  `preuves/b5-trace_route-reponse-seed1.json`, `preuves/b5-mesures.json`.

## B6. Les deux formes recalées

`preuves/b6-divergence.txt` (réponses identiques sur Mac, iOS et Android) :

| Ligne | `trace_route` | `trace_attributes` | Résultat |
|---|---|---|---|
| 1 itinéraire créé | 1 015 points, 34 033 m | idem | **identiques** |
| 2 circuit de Haye | 1 025 points, 21 327 m | idem | **identiques** |
| 3 GPX simulé bruité | 1 264 points | 1 299 points | diffèrent à partir du point 533 (km 16,31), le demi-tour fantôme |
| 3d circuit sans bruit | 1 262 points, 34 167 m | 1 297 points, 34 904 m | identiques sur les 1 262 premiers points, puis `trace_route` s'arrête 737 m avant la fin |

Donc, comme prévu par l'écart accepté de l'ADR (type de voie donné
seulement tant que les formes sont identiques depuis le départ) : sûr pour
1 et 2, partiel pour les GPX.

## Ce qui n'est pas prouvé

- Un téléphone réel (GPS, batterie, confort de la caméra, temps de calcul
  réels, extinction réelle de l'écran sur iOS).
- Un vrai GPX VTT (B5).
- La fluidité de la caméra (voir B2).
- `edge_walk` : non repris (inutilisable, essai A).
