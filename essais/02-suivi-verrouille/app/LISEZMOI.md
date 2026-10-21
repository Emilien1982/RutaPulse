# App de l'essai 2

App Expo (SDK 58) qui suit la position avec `expo-location/next` et met à jour
la notification du service au premier plan (Android) à chaque nouvelle
indication. Le journal est dans les documents de l'app : `essai2-journal.jsonl`.

## Construire (Android)

```
export ANDROID_HOME=$HOME/Library/Android/sdk LANG=fr_FR.UTF-8
./copier-trace.sh            # copie la géométrie de ../outils/sortie (ignorée par git)
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease -x lintVitalRelease -PreactNativeArchitectures=arm64-v8a
```

APK : `android/app/build/outputs/apk/release/app-release.apk`. Installer avec
`adb -s emulator-5554 install -r`, puis accorder les permissions (voir
`../preuves/commandes-permissions.txt`).

## Procédure avant chaque rejeu

Une session de suivi survit à la fermeture de l'app (le service garde ses
options) : sa notification peut rester affichée et fausser les mesures.

1. Appuyer sur « Arrêter » (ou désinstaller l'app puis la réinstaller).
2. Vérifier qu'il y a 0 notification de l'app :
   `adb -s emulator-5554 shell dumpsys notification --noredact | grep -c "pkg=fr.vttnav.essai2"`
3. Supprimer le journal : `adb -s emulator-5554 shell run-as fr.vttnav.essai2 rm -f files/essai2-journal.jsonl`
4. Appuyer sur « Démarrer le suivi », mettre l'app en arrière-plan.
5. Lancer l'observateur et le rejeu (`../outils/`), puis éteindre l'écran.
6. Relire le journal : `adb -s emulator-5554 shell run-as fr.vttnav.essai2 cat files/essai2-journal.jsonl`.

## iOS (simulateur iPhone 17, UDID `DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D`)

### Construire et installer

```
export LANG=en_US.UTF-8          # CocoaPods exige de l'UTF-8
./copier-trace.sh
npx expo prebuild --platform ios # crée ios/ (ignoré par git) et installe les Pods
cd ios && xcodebuild -workspace Essai2.xcworkspace -scheme Essai2 -configuration Release \
  -destination "platform=iOS Simulator,id=$UDID" -derivedDataPath <dossier> build
xcrun simctl install $UDID <dossier>/Build/Products/Release-iphonesimulator/Essai2.app
xcrun simctl privacy $UDID grant location-always fr.vttnav.essai2
```

Le build Release embarque le JavaScript : pas besoin de Metro.

### Procédure d'un rejeu iOS

Il n'y a pas d'outil de clic en ligne de commande (`idb_companion` absent, pas d'accès
« Accessibilité » pour `osascript`). L'app lit donc un fichier de commande au lancement :

0. `UDID=DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D` (jamais `booted` : un autre simulateur tourne).
1. `D=$(xcrun simctl get_app_container $UDID fr.vttnav.essai2 data)`
2. Mettre le simulateur au premier point de la trace **avant** de démarrer
   (`xcrun simctl location $UDID set 48.72804,6.15515`). Sinon la première position
   est celle du rejeu précédent, `d` saute et `k` ne redescend pas.
3. `rm -f $D/Documents/essai2-journal.jsonl ; echo demarrer > $D/Documents/commande.txt`
4. `xcrun simctl terminate $UDID fr.vttnav.essai2` puis `xcrun simctl launch $UDID fr.vttnav.essai2`
   (l'app lit `commande.txt`, le supprime et démarre le suivi et la Live Activity).
5. Verrouiller l'écran (session principale, outil simulateur, bouton LOCK). Pour un essai sans verrouillage : `xcrun simctl launch $UDID com.apple.Preferences` met seulement l'app en arrière-plan.
6. Lancer `outils/observer-ios.sh` puis `outils/rejouer.sh ios`.
7. Fin : `xcrun simctl terminate $UDID fr.vttnav.essai2`, `echo arreter > $D/Documents/commande.txt`,
   puis `xcrun simctl launch $UDID fr.vttnav.essai2` (l'app lit `commande.txt` au lancement ; elle termine la
   Live Activity, le journal reçoit une ligne `end` avec `actives: 0`), puis `cp $D/Documents/essai2-journal.jsonl` et
   `outils/expurger-journal.py` avant de verser le journal dans `preuves/`.

### Réglages de localisation sur iOS

- `expo-location/next` ignore l'intervalle sur iOS : le suivi en arrière-plan passe par
  `CLLocationUpdate.liveUpdates(profil)` (iOS 17+) avec une `CLBackgroundActivitySession` et,
  dès iOS 18, un `CLServiceSession` en autorisation « toujours ». Le système choisit le rythme
  (environ 1 position par seconde avec précision maximale). On garde `AUTOMOTIVE_NAVIGATION`, comme sur
  Android. Mesuré sur le simulateur : 302 positions pour 300 s de rejeu, plus grand trou 1,2 s.
- `isIosBackgroundLocationEnabled` ajoute `location` à `UIBackgroundModes` (`fetch` est
  ajouté par `expo-task-manager`).

### Live Activity

- `src/liveactivity.tsx` : mise en page (`createLiveActivity`, directive `'widget'`, composants
  `@expo/ui/swift-ui`). Ne pas ajouter d'entrée `widgets[]` pour elle dans `app.json`.
- `enablePushNotifications` : `false` (le compte Apple gratuit n'a pas le push).
- Démarrée au premier appel de `notify`, mise à jour seulement quand `k` augmente, terminée
  (`end('immediate')`) à l'arrêt. Si le système relance l'app pendant une session, elle reprend la
  Live Activity existante au lieu d'en créer une.
- Journal : lignes `liveactivity` (`action` start/update/end, `k`, `texte`, `actives`).
- Une Live Activity d'un lancement précédent (même après un redémarrage du simulateur) reste
  affichée tant qu'on ne la termine pas : l'app termine les anciennes au démarrage.

### Signature (appareil réel, compte Apple gratuit)

Fichiers produits par le prebuild (`ios/`) :

| Cible | Identifiant | Entitlements |
|---|---|---|
| App `Essai2` | `fr.vttnav.essai2` | `com.apple.security.application-groups` = `group.fr.vttnav.essai2` |
| Extension `ExpoWidgetsTarget` (`com.apple.widgetkit-extension`) | `fr.vttnav.essai2.ExpoWidgetsTarget` | `com.apple.security.application-groups` = `group.fr.vttnav.essai2` |

- Pas de `aps-environment` (push désactivé). `NSSupportsLiveActivitiesFrequentUpdates` est présent, à `false`.
- `Info.plist` de l'app : `NSSupportsLiveActivities` = vrai ; `UIBackgroundModes` = `fetch`, `location` ;
  `ExpoWidgets_EnablePushNotifications` = faux ; textes d'explication, tous en français dans `app.json` :
  `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSLocationAlwaysUsageDescription`,
  `NSLocationWhenInUseUsageDescription`, `NSMotionUsageDescription` (l'app n'utilise pas le mouvement ;
  le texte est exigé par le plugin) et `NSLocationTemporaryUsageDescriptionDictionary`
  (clé `ExpoLocationFullAccuracy`).
- Il faut donc : une équipe de signature (`DEVELOPMENT_TEAM`, non renseignée par le prebuild), deux
  identifiants d'app (app et extension) et un App Group enregistrés, la capacité « App Groups » sur
  les deux. Le simulateur ne vérifie rien de cela.

## Android : modules exclus

`expo-widgets` et `@expo/ui` ne servent qu'à iOS : ils sont exclus de la liaison Android
(`package.json`, clé `expo.autolinking.android.exclude`). Le manifeste release n'a plus de receiver de widget
(seuls restent `TaskBroadcastReceiver` et `ProfileInstallReceiver`).
