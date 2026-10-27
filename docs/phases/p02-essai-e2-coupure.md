# Essai E2 : coupures et empreinte fausse (C3, C2)

Essai jetable, rien dans le dépôt. Date : 26 octobre 2026.
Appareils : Android `Pixel_6_API_34_arm64` (emulator-5554), iOS « iPhone 17 » (iOS 26.5).
Build debug (dev client), id `fr.vttnav.e2`, copie de `mobile/` dans `app/`.
Seuls écarts de la copie : adresse du catalogue (`http://10.0.2.2:8099` sur Android,
`http://localhost:8099` sur iOS) et `parseFile` qui accepte `http://` au lieu de `https://`
(sinon le catalogue de test est refusé). Le reste du code de téléchargement est celui du dépôt.
Serveur : `server.py`, débit 1,5 Mo/s par fichier (> 100 Ko), journal `server.log`
(copie : `cap/server.log.copy`). Fichiers = paquet Nancy v3 récupéré sur github.com, 9 empreintes vérifiées.
Catalogue « faux » : empreinte de `terrain.pmtiles` remplacée (fichier n°6 sur 9, 5 fichiers contrôlés avant).
Captures et listes de dossiers : `cap/`.

## a. Réseau coupé au milieu d'un gros fichier

### Android (vraie coupure : `svc wifi disable` + `svc data disable`, 19:43:49)
- Pendant le téléchargement de `N48E005.hgt` (25,9 Mo), 6 s après son départ.
- Dossier avant la coupure : `.plan.json`, `LICENCES.md` (2 107), `contours.pmtiles` (3 809 985), `N48E005.hgt` partiel (8 323 072). Pas de `.ready.json`.
- État affiché 8 s et 20 s après : « En attente du réseau · 4 Mo sur 111 » (`cap/and-a3-cut-20s.png`). Compte les 4 Mo des fichiers contrôlés seulement. Dossier : toujours pas de `.ready.json`.
- Réseau rétabli à 19:44:20. Le journal montre `GET /catalogue.json` (relecture par l'app), puis à 19:44:25 (5 s après) `N48E005.hgt` redemandé en entier (le partiel est réécrit depuis 0).
- Fichiers redemandés : seulement `N48E005.hgt` et les suivants. `LICENCES.md` et `contours.pmtiles` ne sont PAS redemandés.
- Fin : `.ready.json` (1 751 octets) écrit, `.plan.json` effacé, 9 fichiers aux bonnes tailles (`cap/and-a-final-dir.txt`), écran « Prête sans réseau » (`cap/and-a6-ready.png`).
- Résultat : OK.
- Remarque : la connexion coupée n'a pas été vue fermée par le serveur (pas de ligne ABORTED : le serveur est resté bloqué sur l'écriture, la coupure est côté émulateur). Sans effet pour l'app.

### iOS (pas de mode avion sur simulateur : arrêt du serveur à la place, 20:03:47, 6 s après le début de `N48E005.hgt`)
- Dossier avant : `.plan.json`, `LICENCES.md`, `contours.pmtiles` (le partiel est dans `tmp/`, hors du dossier de zone).
- Pendant la panne (3 s) l'écran garde « 13 Mo sur 111 » avec la croix, sans état particulier (c'est un essai raté + attente de 5 s, pas une « attente du réseau »), `cap/ios-a2-cut.png`.
- Serveur relancé à 20:03:51 ; l'app redemande `N48E005.hgt` à 20:03:52 (essai 2), reprend seule.
- Fichiers redemandés : `N48E005.hgt` puis la suite ; `LICENCES.md`, `contours.pmtiles` pas redemandés.
- Fin : `.ready.json` écrit, `.plan.json` effacé, 9 fichiers (`cap/ios-a-final-dir.txt`).
- Résultat : OK.

## b. App tuée au milieu d'un fichier

### Android (`am force-stop` à 19:46:47, 6 s dans `N48E006.hgt`)
- Avant : `.plan.json`, `LICENCES.md`, `contours.pmtiles`, `N48E005.hgt` complet (25 934 402), `N48E006.hgt` partiel 9 764 864.
- Après la mort : `N48E006.hgt` partiel 9 961 472 resté dans le dossier de zone ; pas de `.ready.json`. Journal : `N48E006.hgt ABORTED sent=10092544/25934402`.
- Relance (19:46:53, deep link du dev client) : reprise seule, sans geste. 19:46:58 `N48E006.hgt` redemandé en entier. Seul ce fichier et la suite sont redemandés ; `LICENCES.md`, `contours.pmtiles`, `N48E005.hgt` ne le sont pas.
- Pas de `.ready.json` avant la fin ; à 19:47:56 tout est là, `.ready.json` écrit, `.plan.json` effacé (`cap/and-b-final-dir.txt`).
- Résultat : OK. (La capture après relance montre le menu du dev client, pas l'écran Zones : `cap/and-b2-relaunch.png`.)

### iOS (`simctl terminate` à 20:09:34, 6 s dans `N48E006.hgt`)
- Avant et après la mort : `.plan.json`, `LICENCES.md`, `contours.pmtiles`, `N48E005.hgt` complet ; `N48E006.hgt` absent du dossier de zone (`cap/ios-b-before-kill.txt`, `cap/ios-b-after-kill.txt`). Pas de `.ready.json`.
- Le partiel (8 847 360 octets) reste dans `<conteneur>/tmp/CFNetworkDownload_SQUsZa.tmp` : il y était encore à la fin de l'essai, après la zone prête (non nettoyé par l'app, cf. E1).
- Relance par `simctl launch` : reprise seule, 20:09:38 `N48E006.hgt` redemandé (2 s). Les trois premiers fichiers ne sont pas redemandés. Journal : `ABORTED sent=8912896/25934402`.
- Fin 20:10:36 : `.ready.json` écrit, 9 fichiers (`cap/ios-b-final-dir.txt`).
- Résultat : OK.

## c. Catalogue à empreinte fausse (`terrain.pmtiles`)

### Android
- Journal : `terrain.pmtiles` demandé 3 fois (19:49:50, 19:50:01, 19:50:13), chaque fois reçu en entier (8 775 665 octets), refusé par l'empreinte. 5 s entre deux essais. Aucun 4e essai.
- État final : « Échec du téléchargement · 73 Mo sur 111 » avec « Réessayer » et la croix (`cap/and-c3-failed.png`).
- Dossier : `.plan.json`, `LICENCES.md`, `contours.pmtiles`, `N48E005.hgt`, `N48E006.hgt`, `map.pmtiles` gardés ; `terrain.pmtiles` effacé ; pas de `.ready.json` (`cap/and-c-final-dir.txt`).
- Résultat : OK.

### iOS
- Journal : `terrain.pmtiles` demandé 3 fois (20:18:24, 20:18:36, 20:18:48), reçu en entier à chaque fois. Aucun 4e essai.
- État final : « Échec du téléchargement · 73 Mo sur 111 », « Réessayer » (`cap/ios-c1-failed.png`).
- Dossier : `.plan.json`, `LICENCES.md`, `contours.pmtiles`, `N48E005.hgt`, `N48E006.hgt`, `map.pmtiles` ; pas de `terrain.pmtiles`, pas de `.ready.json` (`cap/ios-c-final-dir.txt`).
- Résultat : OK.

## Défauts et remarques sur le code de l'app (non corrigés)
1. iOS : le fichier partiel d'un téléchargement interrompu par la mort de l'app reste dans `tmp/CFNetworkDownload_*.tmp` (8,8 Mo ici) et l'app ne le nettoie pas. Le système peut vider `tmp`, mais sans garantie de délai. Peu grave (aucune incidence sur la zone), à noter.
2. Pendant un essai raté suivi de l'attente de 5 s (cas iOS « serveur arrêté »), l'écran garde l'état « en cours » sans signe de panne (progression figée). Pas de défaut fonctionnel.
3. Le catalogue exige `https://` : pour tester en local il a fallu modifier la copie. Rien à corriger dans l'app.
4. Au lancement sur Android, un dialogue de permission de position apparaît sur l'écran Carte (normal).

## Nettoyage
Serveur et Metro (mes processus) arrêtés ; `fr.vttnav.e2` désinstallé des deux appareils ; Wi-Fi et données réactivés sur l'émulateur. Le téléphone physique (R5CR21B1KDW) et l'autre émulateur n'ont pas été touchés.
