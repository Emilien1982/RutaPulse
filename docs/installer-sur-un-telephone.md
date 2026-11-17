# Installer RutaPulse sur un téléphone

> Guide de la phase 10a (critère C7), pour le test interne. Les décisions
> sont dans l'[ADR 0022](adr/0022-distribution-test-interne.md).
> Pour l'instant, seulement Android : l'iPhone viendra plus tard (fin du
> guide).

## Qui fait quoi

| Qui | Quoi |
|---|---|
| Claude | Fabrique l'APK (le fichier d'installation d'une app Android) avec `npm run build:apk`, et l'essaie sur l'émulateur (le téléphone simulé du Mac). |
| Claude | Tient à jour le registre des APK remis, en fin de guide. |
| Émilien | Installe l'APK sur son téléphone, par câble ou par fichier. |
| Émilien | Sauvegarde la clé de signature, une fois (voir plus bas). |
| Claude | N'installe **rien** sur le téléphone d'Émilien, sauf s'il le demande ce jour-là. |

## Avant la première installation

- Le téléphone doit être un Android récent en 64 bits. L'APK ne contient
  que la version `arm64-v8a` (processeur ARM 64 bits) : il ne s'installe
  pas sur un vieux téléphone 32 bits.
- Si une ancienne app RutaPulse est déjà sur le téléphone (par exemple
  une app d'essai installée par un câble pendant le développement),
  **désinstalle-la d'abord**. Sa signature est différente : Android
  refuserait la nouvelle par-dessus.
- Désinstaller efface les itinéraires, les zones téléchargées et les
  réglages de l'app. On ne le fait qu'une fois, à ce moment-là.

## Voie 1 : par fichier (sans câble)

1. Claude te donne le chemin de l'APK sur le Mac, par exemple
   `mobile/apk/RutaPulse-1.0.0-1.apk` dans le dossier du projet.
2. Copie ce fichier dans ton Google Drive depuis le Mac. AirDrop ne
   marche pas vers un Android.
3. Sur le téléphone, ouvre Google Drive et touche le fichier, puis
   « Télécharger ».
4. Ouvre le fichier téléchargé (notification ou app « Fichiers »).
5. Android demande d'autoriser l'installation d'apps venues de cette
   source (« sources inconnues ») : touche « Paramètres », active
   « Autoriser depuis cette source » pour Drive (ou pour « Fichiers »),
   puis reviens en arrière.
6. Touche « Installer ». Si Google Play Protect (le contrôle d'apps de
   Google) prévient que l'app est inconnue, choisis « Installer quand
   même » : c'est normal pour une app qui n'est pas sur le Play Store.
7. Après l'installation, tu peux couper l'autorisation de l'étape 5.

## Voie 2 : par câble

`adb` (Android Debug Bridge, l'outil qui parle au téléphone par le câble)
est installé avec Android Studio, dans
`~/Library/Android/sdk/platform-tools/adb`.

1. Sur le téléphone, active une fois les « Options pour les
   développeurs ». Sur un Samsung : Paramètres › À propos du téléphone ›
   Informations sur le logiciel › touche 7 fois « Numéro de version ».
   Le chemin change selon la marque (sur un Pixel : À propos du
   téléphone › « Numéro de build »). Active ensuite le « Débogage USB »
   dans ces options.
2. Branche le téléphone au Mac et accepte « Autoriser le débogage USB »
   sur le téléphone.
3. Dans le Terminal du Mac, depuis le dossier `mobile/` du projet :

   ```bash
   ~/Library/Android/sdk/platform-tools/adb devices
   ```

   Ton téléphone apparaît dans la liste, avec son numéro de série. Une
   ligne qui commence par `emulator-` est l'émulateur du Mac, pas ton
   téléphone.
4. Installe, en remplaçant `<numéro>` par le numéro de série du
   téléphone :

   ```bash
   ~/Library/Android/sdk/platform-tools/adb -s <numéro> install -r apk/RutaPulse-1.0.0-1.apk
   ```

   La réponse attendue est `Success`.
5. Claude peut lancer cette commande pour toi, **seulement si tu le dis
   ce jour-là**.

## Mettre à jour par-dessus

- Une nouvelle version s'installe **par-dessus** l'ancienne, par l'une
  des deux voies : le fichier ouvert propose « Mettre à jour », ou
  `adb install -r` répond `Success`.
- Tes itinéraires, tes zones et tes réglages restent.
- Deux conditions, vérifiées par Claude avant de te remettre l'APK :
  il est signé par la même clé, et son numéro de build (de fabrication)
  est plus grand
  que celui installé. Android refuse un retour en arrière.
- Paramètres Android › Applications › RutaPulse montre seulement
  « 1.0.0 » (la version), pas le numéro de build. Le numéro de build se
  lit par câble : `adb shell dumpsys package fr.rutapulse.app`, ligne
  `versionCode`.

## Sauvegarder la clé de signature (une fois)

La clé de signature prouve que chaque nouvelle version vient bien de
RutaPulse. **Si elle est perdue, plus aucune mise à jour ne s'installe
par-dessus** : il faut désinstaller, et tes itinéraires sont perdus.
Claude l'a créée le 17 novembre 2026. Elle vit sur le Mac, hors du dépôt
git, dans le dossier caché `~/.rutapulse/` :

- `rutapulse-release.p12` : la clé elle-même, chiffrée par son mot de
  passe ;
- `signing.properties` : le mot de passe en clair, et le chemin de la
  clé. Ce fichier ne quitte jamais le Mac.

Ce que tu fais, une fois :

1. **Le mot de passe.** Dans le Finder, menu Aller › Aller au dossier…,
   tape `~/.rutapulse`, puis ouvre `signing.properties` avec TextEdit.
   Le mot de passe est la valeur après `storePassword=` (c'est le même
   pour `keyPassword=`). Copie-le dans ton gestionnaire de mots de passe,
   dans une fiche « RutaPulse, clé Android », avec l'alias (le nom de la
   clé dans le fichier) `rutapulse`.
   Ferme TextEdit sans rien modifier.
2. **Le fichier de clé.** Copie `rutapulse-release.p12` (du même dossier)
   à deux endroits hors du Mac : ton nuage (iCloud Drive ou Google Drive)
   **et** une clé USB. Il est chiffré : il peut aller dans un nuage. Le
   mot de passe, lui, ne voyage jamais avec le fichier.
3. **Vérifie une copie.** Dans le Terminal, tape `shasum -a 256 ` (avec
   l'espace), fais glisser la copie de la clé USB dans la fenêtre, puis
   Entrée. Le résultat doit être exactement l'empreinte du fichier
   ci-dessous.

Les copies locales de Time Machine ne comptent pas comme sauvegarde :
macOS les efface pour faire de la place. Un disque Time Machine externe,
lui, compte.

### Empreintes (publiques, pas secrètes)

Une empreinte SHA-256 est une suite de chiffres et de lettres calculée à
partir d'un fichier : deux fichiers identiques ont la même, le moindre
changement la modifie.

| Quoi | Empreinte SHA-256 |
|---|---|
| Fichier `rutapulse-release.p12` | `0886e1b57d78227e4f96ca97f875653fc9babe2d6c7bbbb80017a65fe6541756` |
| Certificat de la clé (`CN=RutaPulse`) | `43:FC:EA:D7:B0:EC:6C:74:1B:11:1C:3B:2B:62:09:6A:B1:4F:86:93:B6:D5:0B:73:BC:1F:5C:5A:00:32:B9:AF` |

L'empreinte du certificat est celle qu'affiche
`apksigner verify --print-certs` sur chaque APK remis : si elle change,
l'APK n'est pas signé par la clé de RutaPulse.

### Restaurer la clé sur un nouveau Mac

1. Recrée le dossier `~/.rutapulse/` et copie-y `rutapulse-release.p12`.
2. Recrée `signing.properties` à la main, 4 lignes : `storeFile=` (chemin
   complet de la clé), `keyAlias=rutapulse`, `storePassword=` et
   `keyPassword=` (le mot de passe de ton gestionnaire).
3. Dans le Terminal : `chmod 700 ~/.rutapulse` puis
   `chmod 600 ~/.rutapulse/*`.

## Fabriquer un APK (pour Claude)

- Depuis `mobile/` : `npm run build:apk`. La commande lit
  `~/.rutapulse/signing.properties` (ou le fichier donné par la variable
  d'environnement `RUTAPULSE_SIGNING`). Elle produit
  `mobile/apk/RutaPulse-<version>-<build>.apk` (dossier ignoré par git)
  et affiche `apksigner verify --print-certs`. Elle **n'installe rien**.
- Elle refuse un APK signé par la clé de débogage. Sans fichier de
  signature, elle s'arrête. Elle refuse aussi d'écraser un APK qui
  existe déjà sous le même nom.
- Avant chaque APK remis : augmenter de 1 `android.versionCode` et
  `ios.buildNumber` (le numéro de build, c'est-à-dire de fabrication)
  dans `mobile/app.json`, dans un commit à part (« Passer au build N »),
  puis ajouter une ligne au registre.
- La colonne « Commit » du registre se remplit avec la ligne `Commit :`
  affichée par la commande. On ne remet jamais un APK marqué
  « ATTENTION : modifications non commitées ».

## Registre des APK remis

| Date | Version | Build | Commit | SHA-256 du fichier APK | Remarque |
|---|---|---|---|---|---|
| 2026-11-17 | 1.0.0 | 1 | `1afa69a` | `7cc80be3ddefc6657869dedc4f52ba28578c8307fbd71c214612b71703e82b4e` | Premier APK signé par la vraie clé, `arm64-v8a` seul, 52 Mo. Pas encore installé sur le téléphone. |

Pour vérifier qu'un fichier APK est bien celui du registre :
`shasum -a 256 <fichier>.apk`.

## iPhone, plus tard

Pas d'iPhone pour l'instant : l'app iOS n'est vérifiée que sur le
simulateur du Mac. Le jour venu, l'installation se fera par Xcode avec un
compte Apple gratuit (signature valable 7 jours, à renouveler). Voir
l'[ADR 0022 § 9](adr/0022-distribution-test-interne.md) et l'essai 2
(`docs/essais/02-suivi-verrouille.md`, § C5).
