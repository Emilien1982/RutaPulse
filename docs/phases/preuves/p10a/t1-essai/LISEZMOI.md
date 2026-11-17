# Essai jetable T1 (phase 10a, critère C1)

Date : 17 novembre. Émulateur `emulator-5584` (Android). Rien n'a été installé sur le téléphone réel.

## Ce qui est prouvé
1. Un APK release, signé par une clé de test (créée avec `keytool`, hors dépôt), s'installe après désinstallation de l'app existante : `dumpsys-build1.txt` (versionCode 1).
2. On y a téléchargé la zone Nancy (en coupant « Wi-Fi seulement », l'émulateur n'ayant pas de Wi-Fi) et enregistré un itinéraire : `liste-avant-maj.png`.
3. Un APK build 2 (versionCode 2), même clé, s'installe par-dessus avec `adb install -r` ("Success") : `install-r-build2.txt`, `dumpsys-build2.txt` (`firstInstallTime` inchangé, `lastUpdateTime` plus récent). L'itinéraire est toujours là : `liste-apres-maj.png`.
4. Même certificat : `apksigner-build1.txt`, `apksigner-build2.txt`, `comparaison-certificats.txt` (SHA-256 identique).

## Fichiers
- `build1.log`, `build2.log` : sorties brutes de `./gradlew app:assembleRelease` (temps à la fin).
- `taille-apk-*.txt`, `badging-*.txt`, `place-*.txt` : taille, versionCode lu dans l'APK, place libre sur `/`.
- `versioncode-apres-prebuild.txt` : preuve que `android.versionCode` d'`app.json` arrive dans `build.gradle`.
- `withReleaseSigning.js` : le plugin Expo essayé (signature release lue hors dépôt).
- `flow-*.yaml` : parcours Maestro utilisés (`flow-enregistrer.yaml` est une copie de `e2e/p06-enregistrer.yaml`).

## Ce que l'essai apprend (pour T3 et l'ADR 0022)
- Signature : un plugin Expo (`withAppBuildGradle`) ajoute un `signingConfigs.release` qui lit un fichier de propriétés dont le chemin est dans la variable `RUTAPULSE_SIGNING`, et fait pointer la release dessus. Aucune édition à la main de `mobile/android/`. `expo prebuild` sans `--clean` le réapplique sans doublon.
- Numéro de build : `android.versionCode` dans `app.json`, puis `expo prebuild`.
- Temps : 6 min 21 s (premier build, à froid), 4 min 10 s (second, cache Gradle chaud). Taille : environ 172 Mo (180 249 733 octets), car l'APK contient les 4 architectures.
- Pièges : voir le compte rendu (sortie en erreur si la clé manque, y compris pour un build debug ; `maestro` absent du PATH, à prendre dans `~/.maestro/bin`).
