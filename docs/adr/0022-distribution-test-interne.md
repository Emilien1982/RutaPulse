# ADR 0022 — APK Android signé pour le test interne

- Statut : Accepté (validé par Émilien le 17 novembre 2026, avec les recommandations des 7 points : copie de la clé hors du Mac, APK `arm64-v8a` seul, clé créée par Claude en T3, registre des APK dans le guide, anneau brun, démarrage caché dès la police chargée, icônes iOS sombre, teintée et en couches plus tard)
- Date : 2026-11-17 (phase 10a, tâche T1 de [p10](../phases/p10-finition-test-interne.md))
- Précise l'[ADR 0010](0010-distribution-test-interne.md) pour Android.
  S'appuie sur l'essai jetable T1 ([compte rendu](../phases/preuves/p10a/t1-essai/LISEZMOI.md)).

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- Émilien installe un APK (paquet d'installation Android) sur son
  téléphone, hors de Google Play, et le met à jour après chaque
  correction.
- Android n'accepte une mise à jour que si elle est signée par **la même
  clé**. Sinon il faut désinstaller, et les itinéraires, les zones et
  les réglages sont perdus. Une clé perdue ne se recrée pas.
- L'essai T1 a prouvé sur l'émulateur, avec une clé de test : un APK
  release (version finale, sans outils de débogage) signé s'installe,
  puis un build (fabrication) 2 s'installe par-dessus et garde
  l'itinéraire enregistré.
- Deux pièges vus par l'essai : son plugin (module d'extension) exige la
  clé même pour un build de débogage ; l'APK pèse 172 Mo, car il
  contient 4 architectures de processeur.
- Le dépôt sera public : aucun secret ne doit y entrer.

## Décision

### 1. Une clé Android propre au projet, hors du dépôt

- Dossier `~/.rutapulse/` (droits `700`). Il contient :
  - `rutapulse-release.p12` : la clé, au format PKCS12 (format standard
    de coffre à clés) ;
  - `signing.properties` : chemin de la clé, alias et mots de passe.
- Les deux fichiers ont les droits `600` (lisibles par Émilien seul).
- Création, une seule fois, par Claude (développeur, tâche T3) :

  ```sh
  keytool -genkeypair -storetype PKCS12 \
    -keystore ~/.rutapulse/rutapulse-release.p12 -alias rutapulse \
    -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=RutaPulse" \
    -storepass:file ~/.rutapulse/pass.tmp   # effacé juste après
  ```

- RSA 4096 bits. Validité 10 000 jours (27 ans) : Android recommande
  25 ans au moins.
- Le mot de passe est tiré au hasard (32 caractères), écrit dans des
  fichiers, jamais affiché ni copié dans un journal. En PKCS12, le
  mot de passe de la clé est celui du coffre : `storePassword` et
  `keyPassword` ont la même valeur.
- Le certificat porte seulement `CN=RutaPulse` (CN : nom commun). Il est
  lisible par quiconque a l'APK : ni nom ni e-mail dedans.

### 2. La sauvegarde de la clé

La clé est la seule pièce du projet qu'on ne peut pas refaire. Il faut
**deux choses, rangées à deux endroits** : le fichier de clé, et son mot
de passe.

| Qui | Quoi | Quand |
|---|---|---|
| Claude | Crée la clé et `signing.properties` ; affiche l'empreinte SHA-256 du fichier `.p12` (`shasum -a 256`), pas le mot de passe | T3 |
| Émilien | Copie le mot de passe depuis `signing.properties` dans son gestionnaire de mots de passe (fiche « RutaPulse, clé Android », avec l'alias `rutapulse`) | T3, une fois |
| Émilien | Copie `rutapulse-release.p12` hors du Mac : son nuage (iCloud Drive ou Google Drive) **et** une clé USB | T3, une fois |
| Émilien | Vérifie qu'une copie donne la même empreinte (`shasum -a 256`) | T3, une fois |

- Le fichier `.p12` est chiffré par son mot de passe. On peut donc le
  copier dans un nuage. Le mot de passe ne voyage **jamais** avec lui.
- `signing.properties` ne sort pas du Mac : il contient le mot de passe
  en clair. On le refait à la main en cas de restauration (4 lignes).
- Les copies locales de Time Machine ne comptent pas : macOS les efface
  pour faire de la place. Un disque Time Machine externe compte.
- Clé perdue : nouvelle clé, désinstallation, itinéraires perdus.
  Gênant en test interne, grave après une publication.

### 3. La signature : un plugin de configuration Expo

- Un plugin `mobile/plugins/withReleaseSigning.js` (piste de l'essai),
  écrit avec `withAppBuildGradle`. On ne touche pas `mobile/android/`.
- Il ajoute `signingConfigs.release`, qui lit le fichier de propriétés
  désigné par la variable d'environnement `RUTAPULSE_SIGNING`. La release
  pointe sur lui au lieu de `signingConfigs.debug`.
- **Le débogage et la CI (vérification automatique sur GitHub) n'en
  souffrent pas.** Le fichier n'est lu que s'il existe. Sans lui, la
  configuration `release` reste vide, sans erreur.
- **Une release ne retombe jamais en silence sur la clé de débogage.**
  Trois verrous :
  1. Gradle (outil de compilation Android) : avant la tâche
     `preReleaseBuild`, une vérification arrête le build si la clé manque,
     avec le message « RUTAPULSE_SIGNING manquant : pas de release
     signée ». Cette tâche ne tourne que pour une release.
  2. Le plugin : s'il ne trouve plus la ligne à remplacer dans la
     release (modèle d'Expo changé), il s'arrête en erreur pendant le
     prebuild (génération des dossiers natifs).
  3. `npm run build:apk` lit le certificat de l'APK fabriqué et échoue
     s'il contient `CN=Android Debug`.
- À prouver en T3 : `npx expo run:android` (débogage) passe sans la
  variable ; `app:assembleRelease` échoue sans elle.
- Si le plugin change, lancer une fois `expo prebuild --clean` : il ne
  se réapplique pas sur un `build.gradle` déjà modifié.

### 4. La commande `npm run build:apk`

Un script `mobile/scripts/build-apk.sh`, lancé depuis `mobile/`. Il
enchaîne :

1. `RUTAPULSE_SIGNING` vaut `~/.rutapulse/signing.properties` si elle
   n'est pas donnée. Arrêt clair si le fichier manque.
2. `npx expo prebuild --platform android --no-install`.
3. `./gradlew app:assembleRelease -PreactNativeArchitectures=arm64-v8a`
   dans `android/`.
4. Copie de l'APK vers `mobile/apk/RutaPulse-<version>-<build>.apk`
   (par exemple `RutaPulse-1.0.0-1.apk`). Le dossier `mobile/apk/` est
   ajouté au `.gitignore`, ainsi que `*.apk`.
5. `apksigner verify --print-certs` sur la copie, puis le verrou 3.
6. Affiche le chemin, la taille et le certificat de l'APK.

Elle **ne lance jamais d'installation** : ni `adb install`, ni
`expo run:android`. Le téléphone d'Émilien est souvent branché au Mac.
Durée mesurée par l'essai : 4 à 6 minutes. Place prise sur le disque
par un premier build : environ 6 Go.

### 5. Le numéro de version

- `app.json` : `version` reste `1.0.0`. On ajoute
  `android.versionCode` (entier) et `ios.buildNumber` (même valeur, en
  texte), à 1 au départ.
- L'essai a prouvé que `android.versionCode` arrive dans `build.gradle`
  au prebuild.
- Avant **chaque APK remis** à Émilien : `versionCode` et `buildNumber`
  augmentent de 1, dans un commit à part (« Passer au build N »). Les
  APK fabriqués pour l'émulateur n'en ont pas besoin.
- Le guide d'installation (`docs/installer-sur-un-telephone.md`) tient
  un tableau « APK remis » : date, version, build, commit.

### 6. Taille : la release ne contient que `arm64-v8a`

L'émulateur et le téléphone d'Émilien sont en `arm64-v8a` (processeur
ARM 64 bits). La commande passe `-PreactNativeArchitectures=arm64-v8a`.

- Pour : APK bien plus léger (gain à mesurer en T3 ; les 172 Mo
  viennent surtout du code natif, en 4 copies), build plus court, moins
  de place prise sur le Mac.
- Contre : l'APK ne s'installe pas sur un vieux téléphone 32 bits
  (`armeabi-v7a`) ni sur un émulateur x86. Pour un proche dans ce cas,
  on refera un APK avec ses architectures. React Native conseille toutes
  les architectures pour une publication : pas notre cas.
- Le réglage vit dans la commande : le débogage ne change pas.

### 7. La mise à jour par-dessus

- Conditions : même clé, `versionCode` strictement plus grand que celui
  installé (Android refuse un retour en arrière).
- Deux voies, décrites dans le guide : `adb install -r <apk>` (par
  câble, lancé par Émilien ou sur son accord du jour), ou le fichier
  ouvert sur le téléphone (« Mettre à jour »).
- Désinstaller efface les itinéraires, les zones téléchargées et les
  réglages. On ne le fait qu'une fois : au passage de l'app de débogage
  (ou de l'APK de l'essai) à la vraie clé.
- Effet utile de la clé propre : un `expo run:android` lancé par erreur
  sur le téléphone échoue (signatures différentes) au lieu de remplacer
  l'app d'Émilien.

### 8. Ce qui reste hors du dépôt, et l'audit avant commit

Hors du dépôt : la clé `.p12`, `signing.properties`, les mots de passe,
les APK, l'identifiant d'équipe Apple (`DEVELOPMENT_TEAM`, réglé dans
Xcode, dans `ios/` qui est généré et ignoré).

Avant chaque commit qui touche à la signature ou à la version, depuis la
racine du dépôt (les trois commandes ne doivent rien afficher) :

```sh
git ls-files | grep -E '\.(p12|jks|keystore|apk|aab)$|signing\.properties'
git grep -nIE '(storePassword|keyPassword)[[:space:]]*[=:]|PRIVATE KEY|DEVELOPMENT_TEAM|developmentTeam|appleTeamId' -- ':!*.md'
git grep -nIF -f <(sed -n 's/^storePassword[=]//p' ~/.rutapulse/signing.properties)
```

La deuxième laisse les fichiers Markdown de côté : ils nomment ces mots
sans valeur. La troisième cherche le vrai mot de passe partout, sans
l'afficher. Le relecteur les lance aussi avant la fusion.

### 9. iOS, pour plus tard

Rien à faire en 10a. Avec un iPhone : signature gratuite par le compte
Apple personnel d'Émilien, installation par Xcode, à renouveler tous les
7 jours. Voir l'[essai 2, § C5](../essais/02-suivi-verrouille.md) ; un
essai sur le vrai iPhone précédera la procédure.

## Alternatives rejetées

- **Signer avec la clé de débogage** (`~/.android/debug.keystore`) :
  c'est le réglage par défaut d'Expo, donc rien à faire. Mais la clé est
  « non sûre par conception » (Android) et propre à ce Mac : si le
  fichier disparaît, plus de mise à jour possible. Et un build de
  débogage pourrait remplacer en silence l'app d'Émilien.
- **Signer après coup avec `apksigner`** : Gradle reste intact. Mais il
  faut deux étapes de plus (`zipalign`, puis `apksigner sign`), et la
  release sort d'abord signée par la clé de débogage. Le plugin est
  prouvé et tient en un seul endroit.
- **EAS Build (compilation d'Expo dans le nuage)** : rien à installer.
  Mais il faut un compte Expo, la clé est confiée à un tiers, et le
  quota gratuit est limité (montant non vérifié). Le build local marche
  en 4 à 6 minutes.
- **Un APK par architecture** (`splits.abi` de Gradle) : plus de
  fichiers à gérer pour un seul téléphone visé. Inutile aujourd'hui.

## Conséquences

- Positif : une commande produit un APK signé, vérifié et nommé ; les
  mises à jour gardent les itinéraires ; aucun secret dans le dépôt.
- Négatif : une clé à garder pour toujours, sauvegardée par Émilien ; un
  `versionCode` à augmenter à la main ; un APK pour téléphones 64 bits.
- À prouver en T3, sans nouvel essai jetable : débogage et release sans
  la variable, taille de l'APK `arm64-v8a`.

## Sources

- Signature Android, validité de 25 ans, clé perdue, fichier de
  propriétés hors des fichiers de build :
  https://developer.android.com/studio/publish/app-signing
- `apksigner` : https://developer.android.com/tools/apksigner
- Propriété `reactNativeArchitectures` :
  https://reactnative.dev/docs/build-speed
- Plugins de configuration Expo (`withAppBuildGradle`) :
  https://docs.expo.dev/config-plugins/plugins/
- `keytool` (options `-storepass:file`) :
  https://docs.oracle.com/en/java/javase/17/docs/specs/man/keytool.html
