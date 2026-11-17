# Phase 8b, T2 (luminosité) : preuves du testeur

Date : 16 novembre 2026. Builds **release** du code non commité de T2, sur l'émulateur
Android `emulator-5584` (Pixel, API 34, mode avion actif, remis à la fin) et sur
l'iPhone 17 (iOS 26.5). Le téléphone réel n'a pas été touché.

## Commandes

- Tests : `cd mobile && npm run verify` -> `Test Suites: 256 passed, 256 total` /
  `Tests: 2945 passed, 2945 total` (sortie complète : `verify.txt`).
- Android : `npx expo prebuild --platform android`, puis
  `cd android && ./gradlew app:assembleRelease` -> `BUILD SUCCESSFUL in 5m 31s`
  (`gradle-release.txt`), puis `adb -s emulator-5584 install -r app/build/outputs/apk/release/app-release.apk`.
- iOS : `npx expo prebuild --platform ios`, puis
  `npx expo run:ios --device "iPhone 17" --configuration Release` (`ios-build.txt`).
- Android : touches par `adb -s emulator-5584 shell input tap`, position par
  `adb ... emu geo fix`, trace rejouée par `essais/08-suivi-velo/t3-outils/android_replay.py`
  (une position par seconde, 20 m entre deux, 20 positions immobiles au départ), luminosité lue par
  `adb ... shell dumpsys display | grep "Display Brightness"`.
- iOS : parcours Maestro (`ios-flow-*.yaml`), trace `ios-p5-trace-4nov-5m.json` rejouée par `ios_replay.py`.

## Tests ajoutés par le testeur

- `mobile/src/core/tracking/brightnessPermission.test.ts` : `app.json` bloque `android.permission.WRITE_SETTINGS` (ADR § 8.4).
- `mobile/src/features/map/tracking/TrackingSettingsPanelSwipe.test.tsx` : un glissement long vers le bas ferme le panneau, un glissement court non (ADR § 8.6).
- Les tests du développeur couvrent déjà : règle `wantsMaxBrightness`, hook (Android et iOS), `updateSettings` (fusion, deux écritures rapides), lecture champ par champ, Réglages, roue, panneau, retour Android, fermeture au jaune.

## Critère par critère

| Point | Android | iOS | Verdict |
|---|---|---|---|
| Rubrique « Pendant le suivi », Automatique par défaut | `android-02-reglages-auto.png` | `ios-02-reglages-auto.png` | prouvé |
| Choisir Maximum dans Réglages, gardé après arrêt et relance | `android-03`, `android-04-reglages-max-apres-relance.png` (arrêt forcé puis relance) | `ios-03-reglages-max.png` (relance non refaite : même code) | Android prouvé ; iOS partiel |
| Roue dentée sur le suivi, panneau fermé | `android-05b-suivi-roue-fermee-guidage.png` | `ios-05b-suivi-roue-fermee-guidage.png` | prouvé |
| Panneau 31b montre « Maximum » | `android-06-panneau-ouvert.png` | `ios-06-panneau-ouvert.png`, `ios-06b-...` | prouvé |
| Changer dans le panneau change Réglages | panneau -> Automatique, puis `android-14-reglages-automatique-apres-panneau.png` | `ios-08-panneau-automatique.png` puis `ios-10-reglages-automatique-apres-panneau.png` | prouvé |
| Le panneau ne bloque pas le guidage | ouvert, la distance passe de 1,7 km à 1,3 km puis 850 m... (`android-07`, `android-panneau-ferme-seul-journal.txt`) | panneau ouvert pendant la trace : `ios-06b` | prouvé (Android) ; iOS partiel (une capture) |
| Fermeture seule à moins de 100 m | ouvert, 140 m -> 40 m : fermé (`android-panneau-ferme-seul-journal.txt`) | observé : panneau ouvert pendant « Recherche du GPS » fermé au premier point (déjà à 10 m d'une direction), `ios-07` | Android prouvé ; iOS prouvé au premier point |
| Ouvert alors que c'est déjà jaune : reste ouvert | `android-panneau-ouvert-deja-jaune.txt`, `android-12-...png` | non fait | Android prouvé |
| Retour Android : ferme le panneau d'abord, puis boîte « Terminer la sortie ? » | `android-retour-journal.txt`, `android-09-retour2-boite.png` | sans objet | prouvé |
| « © OpenStreetMap » visible au-dessus du panneau | `android-06`, `ios-06` | idem | prouvé |
| Luminosité 1,0 avec Maximum, rien avec Automatique | `android-luminosite-dumpsys.txt` : départ 0,3976 ; suivi Maximum 1,0 ; panneau -> Automatique 0,3976 ; -> Maximum 1,0 ; 3e suivi en Automatique 0,3976 | non observable | Android prouvé |
| Luminosité rendue à la fin, en arrière-plan, remise au retour | même fichier : Home 0,3976 ; retour 1,0 ; fin (résumé) 0,3976 ; fin en Automatique 0,3976 | non observable | Android prouvé |
| `WRITE_SETTINGS` absente de l'APK | `android-aapt-permissions.txt` (aapt dump permissions) : absente ; `dumpsys package` : absente | sans objet | prouvé |
| C13 : rien ne ralentit le suivi | pas de mesure chiffrée faite (la banc de la 8a n'a pas été rejoué) ; le suivi a avancé normalement (1 position/s, panneau ouvert ou non) | idem | **non prouvé** (T5 mesure C13) |

## Ce qui n'est pas observable sur le simulateur iOS

- La luminosité réelle : l'essai T1 a montré que le simulateur ignore `setBrightnessAsync` (lecture 0,5 avant et après).
  Aucun journal de l'app n'est émis par le code de luminosité, donc rien à lire. Les appels `getBrightnessAsync` /
  `setBrightnessAsync(valeur)` au retour, à `background` et à la fin sont prouvés par les tests du hook (mocks), pas par
  le simulateur. À juger sur un vrai iPhone (liste de PILOTAGE.md).
- Le comportement « app fermée de force : luminosité restée au maximum » est un écart documenté (ADR § 8.3), non testable.

## Observations (aucune bloquante)

1. Panneau ouvert pendant « Recherche du GPS », il se ferme au premier point si ce point est déjà à 100 m ou moins d'une
   direction (vu sur iOS, `ios-07`/journal ; vu sur Android au 2e suivi : `android-11-panneau-automatique.png` montre
   le panneau fermé en jaune, 100 m). Conforme à la règle écrite (passage de faux à vrai), mais l'utilisateur qui ouvre la
   roue juste après « Démarrer » peut la voir se refermer. À signaler au pilotage, non bloquant.
2. Android : l'interrupteur « Télécharger en Wi-Fi seulement » est sur « non » alors que le défaut est « oui » ; iOS est sur
   « oui ». Je n'ai pas modifié ce réglage. Cause probable : réglage fait lors d'essais précédents de cet émulateur. La lecture champ par
   champ garde bien `wifiOnly` (il est resté « non » après tous mes changements de luminosité).
3. Les parcours Maestro iOS `ios-flow-*.yaml` sont des aides de ce test, pas des parcours C14.
   Le retour par « Itinéraires » (texte) et `info-back` n'ont pas marché sur iOS ; un balayage depuis le bord gauche, oui.
4. Le panneau sous « Recherche du GPS » (iOS) cache le point de position (`ios-06-panneau-ouvert.png` : un point noir
   coupé au bord du panneau) : avant le premier point, la marge de la caméra n'a pas de quoi cadrer. Cosmétique.

## Captures release à comparer aux maquettes

Android : `android-05b-suivi-roue-fermee-guidage.png`, `android-06-panneau-ouvert.png`, `android-03-reglages-max.png`,
`android-02-reglages-auto.png`. iOS : `ios-05b-suivi-roue-fermee-guidage.png`, `ios-06b-panneau-ouvert-en-route.png`,
`ios-06-panneau-ouvert.png`, `ios-03-reglages-max.png`, `ios-02-reglages-auto.png`.

## Après corrections

Code non commité après trois passes de corrections. Disque : 37 Go libres avant chaque construction.

- `npm run verify` : exit 0, `Test Suites: 257 passed, 257 total` / `Tests: 2958 passed, 2958 total` (`verify-apres-corrections.txt`).
- Android : `./gradlew app:assembleRelease` -> `BUILD SUCCESSFUL in 19s` (`gradle-release-apres-corrections.txt`), `adb -s emulator-5584 install -r` -> Success. iOS : `npx expo run:ios --device "iPhone 17" --configuration Release` (`ios-build-apres-corrections.txt`), sans désinstaller.
- Mode avion actif sur Android pendant les essais, remis à la fin.

| Point | Android | iOS | Verdict |
|---|---|---|---|
| Panneau ouvert pendant « Recherche du GPS », première position déjà à 100 m (Android) / 10 m (iOS) d'une direction : il reste ouvert | `apres-android-02-panneau-pendant-recherche.png`, `apres-android-03-panneau-apres-premiere-position.png` (panneau ouvert, panneau du haut jaune 100 m), `apres-android-premiere-position-proche-journal.txt` (6 relevés sur 12 s : panneau=1) | `apres-ios-02-panneau-pendant-recherche.png`, `apres-ios-03-apres-premiere-position.png` (jaune 10 m, panneau ouvert) | prouvé |
| Panneau ouvert en route : point de position au-dessus du panneau | `apres-android-04-panneau-ouvert-en-route.png` : point à environ 96 dp au-dessus du bord du panneau | `apres-ios-04-panneau-ouvert-en-route.png` : point à environ 76 pt (attendu environ 72) | prouvé |
| Attribution au-dessus du panneau | visible dans les captures Android ci-dessus | visible dans les captures iOS | prouvé |
| Onglet Réglages, segments (liseré) | `apres-android-01-reglages.png` | `apres-ios-05-reglages-segments.png` | prouvé (bord posé net, pas de liseré de 1 pt visible à l'oeil) |
| Panneau : sélecteur aussi correct | `apres-android-04` (Maximum noir) | `apres-ios-03`, `-04` | prouvé |
| Luminosité (non-régression) | `apres-android-luminosite.txt` : panneau -> Maximum 1,0 ; en route 1,0 ; après Terminer 0,3976 | non observable | Android prouvé |

### Petit simulateur iOS
`iPhone SE (2nd generation)` existe, mais seulement sous le runtime iOS 15.2, et l'app release demande iOS 16.4 minimum (`MinimumOSVersion` de `Info.plist`) : elle ne s'y installe pas. Non fait, sans création ni téléchargement.

### Incident d'environnement
Une fois, SpringBoard (écran d'accueil du simulateur) a planté (`SpringBoard-2026-11-16-223735.ips`) : l'app était encore en vie, rien à voir avec elle. Essai refait.
