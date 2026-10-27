# C8 : poids ajouté par le module de calcul, 27 octobre 2026

Critère : 50 Mo au plus. **Tenu** sur tous les chiffres.

- Après : `clone-apres` (commit aae7605, avec le module natif), construit par `expo run:ios/android` en release.
- Avant : second clone neuf, `git checkout 646c309` (dernier commit sans le module), mêmes commandes
  (`npm ci`, `npx expo prebuild --clean`), puis Android `./gradlew app:assembleRelease` (mêmes options
  que `expo run:android`, sans installer) et iOS `xcodebuild ... -configuration Release -destination 'platform=iOS Simulator,name=iPhone 17'`
  (sans installer : l'app installée reste celle de `clone-apres`).
- Mesures : `stat -f %z`, `unzip -l`, `du -sk`. Mo = 1 000 000 octets.

## Android (APK release universel : 4 ABI, armeabi-v7a, arm64-v8a, x86, x86_64)

| Mesure | Avant | Après | Écart |
|---|---|---|---|
| APK release universel (octets) | 142 940 595 | 172 962 636 | **+30 022 041 (+30,0 Mo)** |
| `lib/arm64-v8a/` dans l'APK (octets, fichiers stockés non compressés) | 35 359 248 | 42 880 512 | **+7 521 264 (+7,5 Mo)** |
| Hors `lib/` dans l'APK (octets compressés) | 8 510 697 | 8 737 908 | +227 211 (+0,2 Mo) |

Écart arm64 = `libvalhalla-wrapper.so` (7 521 264 octets) ; les trois autres ABI : armeabi-v7a 6 017 176, x86 8 290 784, x86_64 7 907 088.
Le reste (+0,2 Mo) : données de Valhalla (`default.json`, `tzdata`, classes Kotlin).

**Chiffre qui représente un vrai téléphone** : le téléphone reçoit un seul ABI, `arm64-v8a`, donc environ
**+7,7 Mo** (7,5 + 0,2). L'APK universel (+30 Mo) ne sert qu'à l'émulateur ou à un APK distribué à la main ;
il contient aussi les ABI x86 et 32 bits, inutiles sur un téléphone récent.
Contrôle : un APK avant construit en arm64 seul fait 44 234 548 octets, soit 44,2 Mo.

## iOS (simulateur iPhone 17, binaire fat : arm64 + x86_64)

| Mesure | Avant | Après | Écart |
|---|---|---|---|
| Dossier `RutaPulse.app` (`du -sk`, Ko) | 103 024 | 129 300 | **+26 276 Ko (+26,9 Mo)** |
| Binaire principal `RutaPulse` (octets, fat) | 28 457 280 | 53 849 792 | **+25 392 512 (+25,4 Mo)** |
| Binaire principal, tranche arm64 seule (`lipo -thin`, octets) | 13 990 208 | 26 373 824 | **+12 383 616 (+12,4 Mo)** |
| Dossier `Frameworks/` (Ko) | 69 496 | 69 496 | 0 |

**Chiffre qui représente un vrai iPhone** : la tranche arm64 seule, soit environ **+12,4 Mo** de binaire
(le `.app` d'un iPhone, sans la tranche x86_64 du simulateur, grossit d'environ 13 Mo). Les chiffres du
simulateur comptent deux architectures, donc environ le double. Tout l'ajout est dans le binaire principal
(valhalla-mobile est lié statiquement), rien dans `Frameworks/`.

Limite : ce sont des tailles sur disque d'un build de simulateur et d'un APK. Le téléchargement réel
(App Store, Play Store) est compressé et n'a pas été mesuré.
