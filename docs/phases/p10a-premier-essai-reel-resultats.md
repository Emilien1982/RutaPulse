# Phase 10a — Premier essai réel : résultats

> Commencée et terminée le 17 novembre 2026, en une session de phase
> (passation écrite après T3, puis suite dans la même session sur demande
> du pilotage).
> Spec : [p10-finition-test-interne.md](p10-finition-test-interne.md),
> partie 10a (critères C1 à C9). ADR :
> [0022](../adr/0022-distribution-test-interne.md), accepté par Émilien le
> 17 novembre.
> Branche `claude/phase-10a-essai-reel-414250`, poussée, non fusionnée.
>
> **Les 9 critères sont tenus, dont 2 avec réserve.** C4 : les dialogues
> dessinés par le système (position, sélecteur de fichiers, partage)
> suivent la langue du téléphone, sur iOS comme sur Android ; tout ce que
> l'app dessine est en français (décision du pilotage). C6 : iOS vérifié
> sur simulateur seulement, comme prévu (pas d'iPhone).

## En bref

- **Icône A** (le soleil rayé) sur iOS et Android (adaptative, avec une
  version monochrome) ; plus aucune image d'Expo.
- **Écran de démarrage** crème `#F4E4C1`, rond du soleil cerclé de brun,
  sans saut vers le premier écran ; fondu de 300 ms.
- **Français** seule langue déclarée sur iOS ; permissions iOS inutiles
  (et en anglais) retirées.
- **APK signé** : `npm run build:apk` fabrique
  `mobile/apk/RutaPulse-1.0.0-1.apk` (52 Mo, `arm64-v8a`), signé par une
  clé propre au projet rangée dans `~/.rutapulse/`, hors du dépôt. La
  commande n'installe jamais rien.
- **Guide d'installation** (`docs/installer-sur-un-telephone.md`) et
  **fiche d'essai terrain** (`docs/essais/terrain-1.md`).
- `npm run verify` : 274 suites, **3 074 tests** réussis. `pytest` :
  **280 tests** réussis (fabrique inchangée). CI verte (run plus bas).
- **Rien n'a été installé sur le téléphone d'Émilien.**

## Où sont les preuves

Toutes sous `docs/phases/preuves/p10a/` (abrégé `p10a/`). Chaque dossier
a son `LISEZMOI.md`.

| Quoi | Chemin |
|---|---|
| Essai jetable T1 (C1) | `p10a/t1-essai/LISEZMOI.md` |
| Aperçus de l'icône et du démarrage validés par Émilien | `p10a/t1-design/LISEZMOI.md` |
| T2, développeur (icône, démarrage, français) | `p10a/t2/LISEZMOI.md`, `p10a/t2-c4/` |
| T2, testeur (captures iOS et Android, en anglais et en français) | `p10a/t2-test/LISEZMOI.md` |
| T3, APK signé, verrous, audit | `p10a/t3/LISEZMOI.md` |
| T4, APK installé et parcours de fumée en mode avion | `p10a/t4/LISEZMOI.md` |
| T5, comparaison du designer | `design/comparaisons/p10a-t5-icone-demarrage.md` |
| Audit final des secrets (C9) | `p10a/audit-final.txt` |
| `pytest` | `p10a/pytest.txt` |
| Sources de l'icône et planche du démarrage | `design/v1/icone/`, `design/v1/71-demarrage.html` |
| Parcours Maestro de fumée | `mobile/e2e/p10a-fumee-apk.yaml` |

## Critère par critère

| Critère | Verdict | Preuves |
|---|---|---|
| C1 Essai d'abord | tenu | `p10a/t1-essai/LISEZMOI.md` : APK release signé par une clé de test, installé après désinstallation (`dumpsys-build1.txt`) ; build 2 par-dessus, `Success` (`install-r-build2.txt`, `dumpsys-build2.txt` : `firstInstallTime` inchangé) ; itinéraire toujours là (`liste-avant-maj.png`, `liste-apres-maj.png`) ; même certificat (`comparaison-certificats.txt`) |
| C2 Icône A | tenu | `p10a/t2-test/c2-ios-accueil.png` (icône entière et nom), `c2-android-tiroir.png`, `c2-android-icone-zoom.png` ; tests sur le contenu des PNG dans `mobile/app.test.ts` ; comparaison T5 conforme (`design/comparaisons/p10a-t5-icone-demarrage.md`). L'anneau du dock Android vient du lanceur Pixel (app suggérée, A1), pas de nos fichiers |
| C3 Démarrage | tenu | iOS : `p10a/t2-test/c3-ios-d2.jpg` à `c3-ios-d5.jpg`, `c3-ios-5.png` ; Android : `c3-android-b1.png` à `b3`, `c3-android-1.png`, `c3-android-2.png`, `p10a/t2/android-demarrage-1.png`, `p10a/t2/android-apres-lancement.png` ; comparaison T5 (M1 et M2 mineurs). Pas de vidéo (pas de `ffmpeg`) : suites de captures |
| C4 Français partout | **tenu avec réserve** : les dialogues du système suivent la langue du téléphone (décision du pilotage du 17 novembre) | `p10a/t2-c4/Info.plist.extrait.txt` (`CFBundleDevelopmentRegion` fr, `CFBundleLocalizations` [fr], texte de position en français) ; iOS en anglais : `p10a/t2-test/c4-ios-en-dialogue-position.png` (titre et boutons du système en anglais, texte de l'app en français), `c4-ios-en-menu-itineraire.png` (français) ; iOS en français : `c4-ios-fr-dialogue-position.png` ; Android en anglais : `p10a/t4/c4-android-en-dialogue-position.png`, `p10a/t2-test/c4-android-en-selecteur-fichiers.png` (système en anglais), `p10a/t4/c4-android-en-alerte-app.png` (alerte de l'app en français) |
| C5 APK signé | tenu | `p10a/t3/build-apk.log`, `p10a/t3/apksigner-verify.txt` (`CN=RutaPulse`) ; verrous : `p10a/t3/release-sans-variable.log` (échec franc), `debug-sans-variable.log` (passe), `refus-ecrasement.txt` ; `p10a/t3/audit.txt` ; installé après désinstallation sur `emulator-5584` (`p10a/t4/install.txt`, `sha256.txt`) ; parcours de fumée en mode avion, 23 étapes sur 23 (`p10a/t4/maestro-sortie.txt`, `avion-etat-avant.txt`, `06-barre-etat-mode-avion.png`, `09-maestro-02-itineraire-calcule.png`, `10-liste-itineraires.png`) |
| C6 iOS sur simulateur | tenu ; pas d'appareil (pas d'iPhone) | construction Release unique ; `p10a/t2-test/c2-ios-accueil.png`, `c3-ios-d4.jpg`, `c4-ios-fr-dialogue-position.png`, `c4-ios-en-itineraires.png` |
| C7 Guide d'installation | tenu (relu par le relecteur, à relire par le pilotage) | `docs/installer-sur-un-telephone.md` : voies par fichier et par câble, sources inconnues, mise à jour par-dessus, sauvegarde de la clé, empreintes, registre des APK remis |
| C8 Fiche d'essai terrain | tenu (relue deux fois par le relecteur, à relire par le pilotage) | `docs/essais/terrain-1.md` : toute la liste du pilotage et les sections « Reporté » de 8a et 8b, dans l'ordre d'une sortie ; ce que la v1 ne fait pas encore est séparé |
| C9 Secrets, verify, pytest, CI | tenu | `p10a/audit-final.txt` (trois commandes de l'ADR 0022 § 8 : rien) ; `p10a/t4/verify.txt` (274 suites, 3 074 tests) ; `p10a/pytest.txt` (280 tests) ; run de la CI plus bas |

## Intégration continue

À compléter après le push de ce document (run lu par l'API publique de
GitHub).

## Décisions prises pendant la phase

- **T1 validé par Émilien** (« ok avec les 7 points ») : copie du `.p12`
  dans son nuage et sur une clé USB, mot de passe dans son gestionnaire ;
  APK `arm64-v8a` seul ; clé créée par Claude ; registre des APK dans le
  guide ; anneau brun au démarrage ; démarrage caché dès la police
  chargée ; icônes iOS sombre, teintée et en couches plus tard.
- **C4 tenu avec réserve** sur les deux plateformes (pilotage).
- Le guide est écrit par la session de phase (le garde-fou refuse
  `docs/` au développeur), puis relu (pilotage).
- Le registre des APK porte le commit **et** l'empreinte SHA-256 de
  l'APK (relecteur).
- La clé `locales` d'`app.json` a été retirée : elle cassait la release
  Android (`lintVitalRelease`). iOS reste en français par
  `ios.infoPlist`.

## Incidents de la phase

- **Garde-fou** : il a refusé au développeur d'écrire le guide
  d'installation dans `docs/`. Pas de contournement ; question au
  pilotage, qui a confié le guide à la session de phase.
- **Garde-fou** : il a refusé au développeur d'effacer
  `mobile/languages/fr.json` (devenu inutile) ; la session de phase l'a
  retiré (fichier créé pendant la phase, dans le worktree).
- **Relecture de T2** : deux défauts bloquants (appel au module natif
  dans `src/app/`, contraire à l'ADR 0011 ; preuves de C4 périmées),
  corrigés au premier aller-retour.
- **Relecture de T4** : la première version de la fiche d'essai
  demandait de vérifier une notification et un suivi téléphone
  verrouillé que la v1 n'a pas (V2). Corrigée et relue.
- Rien n'a été effacé hors du worktree ; rien n'a été installé sur le
  téléphone d'Émilien.

## Ce qu'Émilien doit faire

1. **Sauvegarder la clé, une fois** (guide, « Sauvegarder la clé de
   signature ») : mot de passe de `~/.rutapulse/signing.properties` dans
   son gestionnaire ; `rutapulse-release.p12` dans son nuage et sur une
   clé USB ; contrôle de l'empreinte `0886e1b5…6541756`.
2. Valider la fusion.
3. Installer `RutaPulse-1.0.0-1.apk` sur son téléphone avec le guide
   (désinstaller d'abord toute ancienne app RutaPulse d'essai), puis
   rouler avec la fiche `docs/essais/terrain-1.md`.

## Reporté

- **Phase 10b** :
  - `colorPrimary` encore à `#023c69` (bleu d'Expo) dans les ressources
    Android générées : à vérifier sur une alerte Android (T5, hors
    périmètre) ;
  - planche 71 et `tokens.md` : le fond sous le démarrage iOS est la
    carte déjà dessinée quand une zone est installée (T5, M2) ;
  - `design/v1/icone/LISEZMOI.md` : le fondu se voit aussi sur Android
    (T5).
- **Avec un iPhone** : couleurs du rond plus vives pendant l'animation
  d'ouverture d'iOS (T5, M1 : profil sRGB à ajouter peut-être) ; icônes
  iOS sombre, teintée et en couches ; installation et signature gratuite.
- **Non vu** : l'icône à thème d'Android rendue par un lanceur ; la
  durée du fondu (non mesurée).
