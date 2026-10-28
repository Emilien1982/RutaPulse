# Preuves de la tâche T2 (phase 5) : `height` et `traceAttributes`

Date : 28 octobre 2026. Code natif final de T2 (modifié à 13:04), builds
release à 13:12 (iOS) et 13:16 (Android). Copié ici par la session de phase
depuis le dossier de travail du développeur.

## Contenu

- `build-ios.log` : build release iPhone 17, « Build Succeeded ».
- `build-android.log` : `:valhalla-route:compileReleaseKotlin` (ligne
  1087), puis `BUILD SUCCESSFUL`. APK installé sur `Pixel_6_API_34_arm64`.
- `ios/`, `android/` : réponses d'un composant temporaire (retiré avant le
  commit), lancé au démarrage de l'app release avec la zone Nancy v3 :
  - `t2-route.json` : `route` A-B réussit ;
  - `t2-ts-height.json`, `t2-ts-trace.json` : `computeHeights` et
    `computeTerrain` par le vrai chemin TypeScript, `ok: true` ;
  - `t2-brut.json` : réponses brutes (A-B, ligne à la main, `null` en mode
    `range`, erreurs 312, 114, 444, JSON invalide → 100) ;
  - `t2-ferme.json` : après `close()`, `height` et `traceAttributes`
    rejettent `ERR_ENGINE_NOT_OPEN` ;
  - `android/avion-pendant-essai.txt` : valeur de
    `adb shell settings get global airplane_mode_on` lue par le
    développeur pendant l'essai (`1`).
- `verify-session-2.log` : `npm run verify` relancé par la session de phase.

## Limite

Le fichier du mode avion ne porte ni horodatage ni commande. Le
fonctionnement hors ligne sur Android est prouvé plus nettement par l'essai
T1 (`../t1-essai/LISEZMOI.md`), et le sera par le parcours Maestro en mode
avion de T7 (C13).
