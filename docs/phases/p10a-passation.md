# Phase 10a — Passation après T3

> 17 novembre 2026. Note de la session de phase. La spec
> ([p10-finition-test-interne.md](p10-finition-test-interne.md), partie
> 10a) fait foi, avec l'[ADR 0022](../adr/0022-distribution-test-interne.md),
> accepté par Émilien le 17 novembre.

## État exact

- Worktree : `/Users/utilisateur/dev_ai/vtt-nav/.claude/worktrees/zealous-gates-8ea709`,
  branche `claude/phase-10a-essai-reel-414250`, **poussée**, non fusionnée.
- Commits de la phase :
  - `0489b4c` **T1** : essai jetable C1 (prouvé), ADR 0022, sources de
    l'icône A et de l'écran de démarrage (planche 71) ;
  - `02330d0` **T2** : icône, démarrage crème, français déclaré sur iOS,
    permissions iOS inutiles retirées (C2, C3, C4, C6) ;
  - `1afa69a` **T3** : vraie clé, plugin de signature, `npm run build:apk`,
    guide d'installation (C5 en partie, C7) ;
  - puis le commit de cette passation (registre du guide complété avec
    `1afa69a`, fiche d'essai terrain).
- `npm run verify` : 274 suites, **3 074 tests** réussis
  (`docs/phases/preuves/p10a/t3/verify.txt`). `pytest` : pas relancé
  (fabrique inchangée), à faire en fin de phase pour C9.
- **APK remis prêt** : `mobile/apk/RutaPulse-1.0.0-1.apk` (ignoré par git),
  52 Mo, SHA-256 `7cc80be3…2b4e`, certificat `CN=RutaPulse`
  `43:FC:EA:D7:…:32:B9:AF`. **Pas encore installé sur l'émulateur avec la
  vraie clé** : l'émulateur porte encore l'APK de T2, signé par la clé de
  débogage du gabarit d'Expo. Il faut désinstaller avant (signatures
  différentes).
- iOS : construction Release dans `.derived-ios/` (ignoré par git) :
  `.derived-ios/Build/Products/Release-iphonesimulator/RutaPulse.app`,
  installée sur le simulateur iPhone 17 d'UDID
  `DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D` (il y a deux « iPhone 17 »).
  **Ne pas reconstruire iOS** : une seule construction par plateforme.
- Clé : `~/.rutapulse/` (700), `rutapulse-release.p12` et
  `signing.properties` (600). Mot de passe jamais affiché. **La
  sauvegarde par Émilien reste à faire** (guide, section « Sauvegarder la
  clé ») : à rappeler par le pilotage.
- Place libre : 51 Go. Quota de la semaine : 58 % (seuil d'arrêt 85 %).

## Ce qui reste

| Tâche | Contenu | Remarques |
|---|---|---|
| T4 | Fiche d'essai terrain (C8) : **déjà rédigée**, `docs/essais/terrain-1.md`, à faire relire. Testeur : désinstaller puis installer `RutaPulse-1.0.0-1.apk` sur `emulator-5584`, zone Nancy (« Wi-Fi seulement » à désactiver), parcours Maestro de fumée en **mode avion** (carte et calcul d'un itinéraire), captures release | C5 complet. Les captures de T2 (icône, démarrage, français) sont déjà faites : `docs/phases/preuves/p10a/t2-test/` |
| T5 | Designer : compare icône et démarrage à la maquette v1/70 et à la planche 71 | Examiner l'**anneau rose saumon** autour de l'icône dans le dock Android sur fond sombre (`t2-test/c2-android-dock-zoom.png`), absent du tiroir d'apps |
| Fin | `docs/phases/p10a-premier-essai-reel-resultats.md` critère par critère, `pytest`, audit C9, push, CI vérifiée par l'API publique de GitHub, message de fin au pilote | Modèle : `p08b-suivi-velo-resultats.md` |

## Décisions prises pendant la phase

- T1 validé par Émilien (« ok avec les 7 points ») : copie du `.p12` dans
  son nuage et sur une clé USB, mot de passe dans son gestionnaire ;
  APK `arm64-v8a` seul ; clé créée par Claude ; registre des APK dans le
  guide ; anneau brun autour du démarrage ; démarrage caché dès la police
  chargée ; icônes iOS sombre, teintée et en couches plus tard.
- **C4 « tenu avec réserve » sur les deux plateformes** (pilotage) : le
  titre et les boutons des dialogues du système (position, sélecteur de
  fichiers, partage) suivent la langue du téléphone, même avec le
  français seule langue déclarée. Tout ce que l'app dessine est en
  français. Preuves : `t2-test/c4-ios-en-dialogue-position.png`,
  `t2-test/c4-android-en-selecteur-fichiers.png`. Le téléphone d'Émilien
  est en français.
- Le guide est écrit par la session de phase (le garde-fou refuse
  `docs/` au développeur), relu par le relecteur (décision du pilotage).
- Registre des APK : commit **et** SHA-256 de l'APK.

## Pièges appris

- La clé `locales` d'`app.json` casse la release Android
  (`lintVitalRelease`, `ExtraTranslation`) : retirée. iOS reste en
  français par `ios.infoPlist`.
- `pod install` plante avec `LANG=fr_FR.UTF-8` : lancer avec
  `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.
- `mobile/ios/build` est ramassé par Jest : construire iOS dans
  `.derived-ios/` à la racine du worktree.
- Conversion SVG → PNG : `qlmanage` perd la transparence ;
  `mobile/scripts/make-icons.js` passe par Chrome sans interface.
- Un APK de `versionCode` plus petit refuse de s'installer par-dessus
  (`INSTALL_FAILED_VERSION_DOWNGRADE`) ; un APK d'une autre clé aussi :
  désinstaller sur l'émulateur.
- Le plugin de signature ne se réapplique pas sur un `build.gradle` déjà
  modifié : `expo prebuild --clean` s'il change.
- Sur l'émulateur sans zone, l'app ne demande pas la position : le
  dialogue de position Android n'est visible qu'après le téléchargement
  d'une zone.
- Maestro n'est pas dans le PATH : `~/.maestro/bin/maestro`.
- `mobile/.essai-p10a/` (clé et plugin de l'essai T1) est exclu par
  `.git/info/exclude` du dépôt principal ; sans valeur, à laisser.
