# Phase 8b, T1 (essai) : luminosité, cap de la position, caméra qui suit

Essai jetable fait le 16 novembre 2026, builds **release** sur iOS (iPhone 17,
iOS 26.5) et sur Android (émulateur `emulator-5584`, API 34). Le code vit sur la
branche locale `claude/p08b-essai` (jamais poussée) ; une copie de l'écran de test
est dans `essai-EssaiScreen.tsx.txt`. Versions : `expo-brightness` **~58.0.3**
(installée par `npx expo install expo-brightness`), `@maplibre/maplibre-react-native`
**11.5.0**, `expo-location` ~58.0.19. L'écran de test est minimal (route `/essai`,
ouverte par un lien `rutapulse://essai?puck=...&track=...&zoom=...`), pas la maquette.

## Résumé

| Point | iOS | Android | Verdict |
|---|---|---|---|
| 1 Luminosité | le simulateur ignore l'écriture : lecture 0,5 avant et après `setBrightnessAsync(1)` | prouvé : la fenêtre seule passe à 1,0, le réglage système ne bouge pas, et tout revient seul en arrière-plan ou si l'app est fermée | **Android prouvé ; iOS partiel** (effet réel visible seulement sur téléphone ; comportement iOS établi par la doc Apple et Expo, deux sources) |
| 2 Cap de la position | `UserLocation` (JS) dessine la flèche d'après la course, suit la trace, halo dessiné ; sans cap : rond sans flèche | idem, flèche seulement quand l'émulateur donne un cap | **prouvé** sur les deux ; couches maison aussi prouvées |
| 3 Caméra qui suit | `trackUserLocation="default"` : suit, sort du suivi au geste, le bouton le remet | idem | **prouvé** sur les deux, par deux méthodes |

## 1. Luminosité (`expo-brightness`)

### iOS
- Doc Apple (`UIScreen.brightness`, `apple-…-extrait.txt`) : la valeur est celle
  **de tout le téléphone**. « Les changements restent en vigueur jusqu'à ce que la
  personne **verrouille** son téléphone, **même si elle ferme ton app avant** ;
  au déverrouillage suivant le système remet le réglage d'origine. » Doc Expo SDK 58
  (`doc-expo-brightness-extrait.txt`) : même phrase, et `restoreSystemBrightnessAsync`
  est **Android seulement** (sur iOS c'est une fonction vide).
- Donc sur iOS : app fermée de force ou plantée, la luminosité **reste au maximum**
  jusqu'au verrouillage de l'écran ; rien ne peut la rendre à ce moment-là. Il faut
  **mémoriser la valeur lue** (`getBrightnessAsync`) avant de la monter, et la
  réécrire (`setBrightnessAsync(valeur)`) à la fin du suivi et au passage en arrière-plan.
  Pendant le suivi l'écran est gardé allumé (`useKeepAwake`), donc il n'est pas verrouillé
  par le délai de veille : seul le bouton latéral le verrouille.
- **Sur le simulateur** : lecture 0,5 avant ; après `setBrightnessAsync(1)` la lecture
  reste **0,5** ; l'écriture n'a donc aucun effet observable
  (`ios-log-luminosite.txt`, lignes `BRIGHT`). La luminosité réelle est à juger sur un
  vrai téléphone (déjà dans la liste de PILOTAGE.md).
- Arrière-plan (`ios-log-luminosite-arriere-plan.txt`) : `AppState` passe par
  **`inactive` puis `background`**, puis `active` au retour ; le JavaScript tourne
  encore au moment de ces changements d'état (il a pu écrire ses lignes de journal),
  donc l'app **a le temps** de réécrire la luminosité sur `background`. À faire sur
  `background` (pas sur `inactive`, qui arrive aussi pour le centre de contrôle).
- Permission, plugin : aucun sur iOS (le module répond « accordée » sans rien demander).

### Android
Mesure par `adb shell dumpsys display` (ligne « Display Brightness », la luminosité
réellement appliquée) et par les journaux (`android-luminosite-dumpsys.txt`,
`android-luminosite-logcat.txt`). Réglage système au départ : 102 sur 255 (0,3976).

| Étape | Luminosité appliquée | Réglage système |
|---|---|---|
| départ | 0,3976 | 102 |
| après `setBrightnessAsync(1)` (bouton) | **1,0** | 102 (inchangé) |
| app en arrière-plan (touche Home) | 0,3976 (**rendue seule**) | 102 |
| retour au premier plan | **1,0** (le réglage de la fenêtre est resté) | 102 |
| après `restoreSystemBrightnessAsync()` | 0,3976 | 102 |
| MAX de nouveau, puis app fermée de force | 0,3976 (**rendue seule**) | 102 |

- `setBrightnessAsync` ne touche **que la fenêtre de l'activité** (le code natif
  écrit `window.attributes.screenBrightness`). Le réglage du téléphone n'est jamais
  modifié.
- Pour rendre : `restoreSystemBrightnessAsync()` (remet `BRIGHTNESS_OVERRIDE_NONE`).
  Vérifié : `isUsingSystemBrightnessAsync()` repasse à `true`.
- Arrière-plan et fermeture de force : le système n'applique le réglage de la fenêtre
  que si elle est au premier plan ; **rien à rendre**, Android le fait. Au retour,
  la fenêtre garde son réglage : si l'app veut le « Maximum » elle n'a pas à le
  réécrire, mais elle doit l'avoir rendu elle-même si le suivi s'est arrêté
  pendant l'absence.
- Permission : `setBrightnessAsync` et `restoreSystemBrightnessAsync` n'en demandent
  **aucune**. `WRITE_SETTINGS` ne sert qu'à `setSystemBrightnessAsync` (réglage du
  téléphone), dont l'app n'a pas besoin.
- **Surprise** : le plugin de configuration de `expo-brightness` (qui ajoute
  `WRITE_SETTINGS` au manifeste) s'applique **tout seul** au `prebuild`, sans être
  écrit dans `app.json` : l'APK construit contient `android.permission.WRITE_SETTINGS`
  (`android-permissions-sans-plugin.txt`). C'est une permission spéciale, mal vue sur
  Google Play, inutile ici. Pour l'enlever : dans `app.json`, `android.blockedPermissions:
  ["android.permission.WRITE_SETTINGS"]` ; le `prebuild` écrit alors
  `tools:node="remove"` (`android-manifest-blockedPermissions.txt`). Résultat sur
  l'APK : voir la section « Suite » en bas.
- Automatique : `restoreSystemBrightnessAsync` = luminosité « Automatique » du
  téléphone (le réglage système, y compris la luminosité adaptative, reprend la main).

### Ce que l'app doit rendre, et quand (recommandation)
- Bibliothèque : `expo-brightness ~58.0.3`, sans plugin.
- « Maximum » : mémoriser `getBrightnessAsync()` (iOS) ; `setBrightnessAsync(1)`.
- « Automatique », fin du suivi ou arrêt du réglage : Android `restoreSystemBrightnessAsync()`,
  iOS `setBrightnessAsync(valeur mémorisée)`.
- Arrière-plan (`AppState` = `background`) : même rendu ; au retour (`active`), si le
  suivi tourne encore et le choix est « Maximum », remettre le maximum.
- App fermée de force : Android, rien ; iOS, **non rattrapable** (reste au maximum
  jusqu'au verrouillage) : à dire dans l'ADR comme écart connu.

## 2. Cap de `UserLocation`

Trace rejouée : iOS `xcrun simctl location <udid> start --speed=4 <40 points>`
(`ios-waypoints.txt`, un point tous les 20 m) ; Android un `adb -s emulator-5584 emu
geo fix` par seconde (`rejeu-android.py`, `trace-4ms-480pts.json`). Carte nord en haut
(`touchRotate` coupé). Scripts : `ios-essai.sh`, `android-essai.sh`.

- **Composant `UserLocation` (JS) avec `accuracy` et `heading`** : lit sa propre
  position (module de localisation de MapLibre, pas `expo-location`). Il dessine un
  rond bleu bordé de blanc, un **halo** de précision (rond bleu clair) et une **flèche
  triangulaire** tournée selon `coords.heading` (course, donc vient du mouvement, pas
  d'une boussole). Captures : `ios-js-native-2-trace-t12.png` (flèche vers le sud,
  cap 187°), `android-js-native-4-apres-bouton-suit.png` (flèche vers le sud, 180°).
  **Sans cap** (position fixe, `ios-js-native-1-position-fixe.png`,
  `android-js-native-1-position-fixe.png`) : rond et halo, **pas de flèche**. Le
  composant ne dessine la flèche que si `heading` est un nombre ; constaté : avec `-1` (iOS) ou sans cap (Android) aucune
  flèche n'est dessinée.
- **Halo** : dessiné sur les deux. Son rayon est approché par une formule fixe
  (`9 px + précision × 100` au zoom 22, interpolée) : à Nancy et au zoom 17 il fait
  environ **deux fois** le vrai rayon (23 px contre 12,7 px pour 5 m). Les couches
  maison (ci-dessous) donnent le rayon exact avec `précision / (78271,5 × cos(lat))
  × 2^zoom`.
- **`NativeUserLocation mode="course"`** (équivalent natif) : sur iOS, le mode
  « course » **se comporte comme « heading »** (boussole, d'après la doc de la
  bibliothèque) : sur le simulateur, rond sans flèche ni halo
  (`ios-native-native-2-trace-t12.png`). Sur Android : flèche dans un rond blanc avec
  anneau gris (`android-native-native-4-apres-bouton-suit.png`) mais la flèche de cette
  capture ne pointe pas vers le sud alors que le cap vaut 180° : non expliqué, non
  retenu. **Écarté.**
- **Solution de repli (couches maison)** : une source GeoJSON avec la position, un
  cercle de précision (rayon exact), un symbole « flèche » (image `essai/arrow.png`,
  `icon-rotate = heading`, `icon-rotation-alignment: map`) et le rond ; la flèche est
  filtrée (`['has','heading']`) : **pas de cap, pas de flèche**. Prouvé sur iOS
  (`ios-own-manual-2-trace-t12.png` flèche à 187°, `ios-own-manual-1-position-fixe.png`
  rond seul) et Android (`android-own-manual-4-apres-bouton-suit.png`). Cap pris dans
  `coords.heading` ; **piège** : `expo-location` donne `heading = 0` (Android) ou `-1`
  (iOS) quand il n'y a pas de cap, avec `speed = 0` : `0` n'est donc pas « nord »
  tant que la vitesse est nulle. Relèvement entre deux positions (> 1 m) en repli :
  écrit dans l'écran de test mais **jamais déclenché** (le cap était toujours fourni
  dès que la position bougeait) : **non prouvé**.
- **Recommandation** : `UserLocation` (JS) de MapLibre avec `accuracy` et `heading`
  suffit pour le cap et pour « sans cap = rond sans flèche » ; prendre les couches
  maison **seulement** si le design veut la flèche de la maquette (couleurs, taille,
  halo exact) : le composant ne permet de changer ni l'image de la flèche ni la couleur
  des ronds sans les remplacer (il prend des `children`, comme le fait déjà
  `MapPosition.tsx`, mais alors on perd la flèche et le halo fournis).
- Cap sur simulateur : vient bien de la **course** (mouvement de la trace), pas de la
  boussole (absente). iOS : une position par seconde avec cap (157 à 189°). Android :
  cap seulement quand deux positions différentes se suivent ; la première position
  et les positions répétées n'ont pas de cap (`hdg=0`, pas de flèche) ;
  la vitesse est peu fiable (0,6 à 3,1 m/s pour 4 réels), comme à l'essai de la 8a.
  Le confort réel se juge en phase 10.

## 3. Caméra qui suit, puis repos au geste

- **Prop `trackUserLocation="default"` + `onTrackUserLocationChange`** (v11.5.0) :
  la carte se centre sur la position à chaque fix (iOS : `REGION did` centre = position ;
  Android idem). Un glissement au doigt (iOS Maestro `swipe` ; Android `adb input swipe`)
  fait émettre **`TRACKCHANGE null`** puis `REGION will user=true` : le suivi est sorti
  tout seul. Le bouton (`btn-follow`, simple `setFollowing(true)` qui remet la prop) donne
  `TRACKCHANGE default` et la carte revient sur la position. Journaux :
  `ios-log-js-native.txt`, `android-log-js-native.txt` ; captures `*-3-apres-geste.png`
  puis `*-4-apres-bouton-suit.png`. Sur Android l'événement `null` arrive **deux fois**
  pour un geste ; sur iOS une fois.
- **Zoom** : `trackUserLocation` **garde le zoom courant**, il n'impose pas 14 : le
  zoom de départ vient de `initialViewState.zoom` (essayé : 17 et 14 ; le journal montre
  le zoom 16,999 conservé pendant le suivi). Le zoom que l'utilisateur règle au pincement
  est conservé aussi.
- **Méthode maison** (`easeTo` à chaque fix, `duration: 900`, et `userInteraction` de
  `onRegionDidChange` pour sortir du suivi) : marche aussi, même résultat
  (`*-own-manual-*`, journaux `FOLLOW off (manual, gesture)` puis `BUTTON follow`).
  Elle donne le contrôle du zoom (14 à chaque fix, si voulu) mais envoie un `easeTo` par
  seconde (inutile avec la prop native).
- **Recommandation** : `trackUserLocation="default"` + `onTrackUserLocationChange`
  (l'état « suit ma position » = la valeur du rappel ; `null` = repos). Pour le zoom 14
  d'ouverture : `initialViewState` ou un `easeTo({ zoom: 14 })` une seule fois, au
  premier fix, comme `ZoneMap.tsx` le fait déjà.
- **Rapidité d'ouverture** (`ouverture-zoom.txt`, délai du montage JS à `onDidFinishLoadingMap`,
  3 ouvertures à froid par zoom, simulateurs sur Mac) : iOS zoom 9 : 154, 154, 158 ms ;
  zoom 14 : 178, 159, 171 ms. Android zoom 9 : 393, 346, 331 ms ; zoom 14 : 404, 464,
  711 ms. Pas de ralentissement net à iOS ; sur Android le zoom 14 est un peu plus lent
  et plus variable (affichage de tuiles plus nombreuses, pas de position attendue ici).
  Mesure d'un simulateur : à refaire par le testeur (C13).

## Surprises
- Le plugin de `expo-brightness` ajoute `WRITE_SETTINGS` sans qu'on l'ait demandé.
- iOS : la luminosité n'est jamais rendue d'elle-même à la fermeture de l'app, seulement
  au verrouillage ; le simulateur ne permet pas de la voir bouger.
- Le halo de `UserLocation` est surévalué (≈ ×2 à Nancy).
- `expo-location` : `heading` 0 / -1 = « inconnu », pas « nord ».
- Maestro : `tapOn: "SUIT"` (texte) échoue sur un `Pressable` iOS ; `tapOn: id:` marche.
  Sur Android, les gestes et taps ont été faits par `adb input` (pas de Maestro, car il
  avait fait tomber le système de l'émulateur à l'essai de la 8a).
- `adb … am start -d` avec `&` : il faut échapper (`\&`) sinon l'URL est coupée.

## Ce qui n'est pas prouvé
- La luminosité réelle d'un téléphone (iOS surtout), et ce qui reste après fermeture de
  force sur iOS : vu seulement dans la doc (Apple et Expo).
- Le confort de la flèche de cap, la précision réelle du halo : téléphone, phase 10.
- La flèche de `NativeUserLocation` sur Android (direction non expliquée).

## Fichiers
`ios-*.png`, `android-*.png` : captures. `ios-log-*.txt`, `android-log-*.txt`,
`android-luminosite-*.txt`, `ouverture-zoom.txt`, `maestro-*.txt` : journaux bruts.
`ios-essai.sh`, `android-essai.sh`, `rejeu-android.py`, `flows/`, `ios-waypoints.txt`,
`trace-4ms-480pts.json` : scripts et données de rejeu.

## Suite : `blockedPermissions` sur l'APK
Avec `android.blockedPermissions: ["android.permission.WRITE_SETTINGS"]` dans `app.json`
(essai local, remis comme avant ensuite), l'APK reconstruit **ne contient plus**
`WRITE_SETTINGS` (`android-permissions-avec-blockedPermissions.txt`, 0 ligne trouvée),
alors que `expo-brightness` y est toujours : **prouvé**. La luminosité par fenêtre
n'en a pas besoin (mesure du point 1 faite avant, sur l'APK qui avait la permission ;
elle ne l'utilise pas : le code natif de `setBrightnessAsync` n'appelle pas
`Settings.System`).
