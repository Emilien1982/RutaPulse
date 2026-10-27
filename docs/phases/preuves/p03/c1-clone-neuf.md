# C1 : compilation depuis un clone neuf, 27 octobre 2026

Clone de la branche **poussée** sur GitHub (pas du worktree) :
`git clone --branch claude/adoring-williamson-4f81fd https://github.com/Emilien1982/RutaPulse.git clone-apres`

- Commit cloné (`git rev-parse HEAD`) : `aae7605ff69753003e2572f8839a2dd0610375cc` (T4).
  La branche poussée a un commit de retard sur le worktree (T5, f6164c9 : mesures
  C2, C5, C7, documents seulement). Le code compilé est celui de T4.
- Machine : Mac, simulateur iPhone 17 (iOS 26.5), émulateur `emulator-5554` (AVD Pixel_6_API_34_arm64).

| Étape (dans `clone-apres/mobile`) | Durée | Code de sortie |
|---|---|---|
| `git clone` | 5 s | 0 |
| `npm ci` | 8 s | 0 |
| `npx expo prebuild --clean` | 33 s | 0 |
| `npx expo run:ios --configuration Release --device "iPhone 17"` | environ 7 min (13:37:31 à 13:44, dernière écriture du journal ; 569 s jusqu'à mon Ctrl-C) | 0 (voir note 1) |
| `npx expo run:android --variant release --device emulator-5554` | environ 5 min 10 s (13:47:00 à 13:52:07, installation ; 561 s jusqu'à mon Ctrl-C) | 0 (voir note 1) |

Aucune autre commande sur le build : pas de réglage, pas de fichier ajouté à la main.

Preuves de réussite lues dans les journaux :
- iOS : `› Build Succeeded`, puis `Installing .../Release-iphonesimulator/RutaPulse.app` et ouverture sur iPhone 17.
  `.app` produit : 129 300 Ko (`du -sk`).
- Android : `BUILD SUCCESSFUL in 5m 1s`, puis installation de
  `android/app/build/outputs/apk/release/app-release.apk` (172 962 636 octets, 27 oct. 13:52) ;
  `dumpsys package` : `lastUpdateTime=2026-10-27 13:52:07`.

Note 1 : en version release, `expo run` reste en avant-plan après l'installation (il garde un serveur Metro
inutile). Je l'ai arrêté par Ctrl-C (SIGINT) une fois l'app installée et lancée ; le code 0 est celui rendu
après cet arrêt. Je l'ai arrêté quelques minutes après la fin de l'installation (j'étais occupé ailleurs) : la durée réelle de compilation est donc la première, plus courte.

Note 2 (honnêteté) : le binaire de valhalla-mobile 0.6.4 (iOS) **venait du cache de SwiftPM** du Mac
(« Downloading binary artifact » n'a pas bloqué ni été exercé). Cette preuve ne montre donc pas qu'un Mac
sans cache télécharge et vérifie le binaire. Les caches Gradle (Maven) et npm étaient aussi chauds.

## Versions Swift résolues (ADR 0015, § 6)

Lues dans `clone-apres/mobile/ios/RutaPulse.xcworkspace/xcshareddata/swiftpm/Package.resolved` :

- anycodable 0.6.7 (révision 862808b207)
- light-swift-untar 1.0.4 (révision fcff1f1b82)
- maplibre-gl-native-distribution 6.31.0 (révision 13e41ab3d7)
- valhalla-mobile 0.6.4 (révision 852dd75c35)
- valhalla-openapi-models-swift 0.6.0 (révision a6e37f5e2c)

`swift-docc-plugin` n'apparaît pas dans le fichier (outil de documentation, absent de l'app).
Les deux dépendances non figées par nous : `valhalla-openapi-models-swift` 0.6.0 (attendu 0.6.x), `light-swift-untar` 1.0.4 (attendu 1.x).
