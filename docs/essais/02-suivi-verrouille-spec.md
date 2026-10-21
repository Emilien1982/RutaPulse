# Essai 2 — Suivi téléphone verrouillé : spec

> Spec de l'essai décrit dans [docs/04-architecture.md](../04-architecture.md)
> (« Essais jetables », ligne 2, et « Sur simulateurs »). Décision à
> éprouver : [ADR 0006](../adr/0006-suivi-arriere-plan-notification.md).
> Résultats : [02-suivi-verrouille.md](02-suivi-verrouille.md).

## Objectif

Savoir si le suivi continue téléphone verrouillé, avec **une seule**
notification mise à jour à chaque nouvelle indication : notification du
service au premier plan sur Android, Live Activity (bandeau en direct sur
l'écran verrouillé) sur iOS.

## Appareils réservés

Un essai 3 tourne en même temps. Ne rien utiliser d'autre que :

| Plateforme | Appareil | Comment le viser |
|---|---|---|
| Android | AVD (appareil virtuel Android) `Pixel_6_API_34_arm64`, Android 14 | `adb -s emulator-5554` **toujours** : un vrai téléphone est aussi branché en USB, ne jamais y toucher |
| iOS | Simulateur « iPhone 17 », iOS 26.5 | UDID `DAF21CEF-2D81-4ABE-9CEC-689BCF1A295D`, jamais `booted` |
| Metro (serveur de développement JavaScript) | port 8081 | — |

Identifiant de l'app : `fr.vttnav.essai2` (Android et iOS).

Shell non interactif : `export ANDROID_HOME=$HOME/Library/Android/sdk
LANG=fr_FR.UTF-8`.

## Trace rejouée

- Source : référence R3 de l'essai 1 (« Forêt de Haye », VisuGPX
  A7jnmrvO13, 25,1 km), fichier
  `/Users/utilisateur/dev_ai/vtt-nav/.claude/worktrees/essai-1-9fd65c/essais/01-calcul-hors-ligne/zone/references/gpx/R3.gpx`.
- Rééchantillonnée à vitesse constante : **5 m/s (18 km/h), un point par
  seconde, 3 600 points, soit 1 h et 18 km**. Pas d'accélération : le
  rejeu dure vraiment 1 h.
- Le GPX n'est pas mis dans le dépôt (source tierce). Le script qui
  fabrique la trace est versionné, la trace produite est ignorée par git.

## Fausse indication

- L'app embarque la même trace (géométrie seule). Elle place chaque
  position reçue sur la trace et en déduit la distance parcourue `d`.
- Indication `k = floor(d / 200)`. Texte : `Indication k : <manœuvre>`,
  avec une manœuvre tirée d'une liste fixe (par exemple « tournez à
  gauche », « tout droit », « tournez à droite »…) selon `k`.
- La notification n'est mise à jour **que** quand `k` change (comme
  l'ADR 0006). Environ 90 changements sur l'heure.

## Critères

| # | Critère | Attendu | Mesure |
|---|---|---|---|
| C1 | Positions, écran verrouillé et app en arrière-plan | ≥ 1 position par 5 s en moyenne, aucun trou > 30 s, sur 1 h | Journal horodaté de l'app (une ligne par position reçue) |
| C2 | Mise à jour de la notification | Nouveau texte affiché < 5 s après la position qui franchit le palier de 200 m, sur ≥ 20 changements | Heure Mac d'injection de la position qui franchit le palier → heure Mac où le texte apparaît (Android : `dumpsys notification` chaque seconde ; iOS : capture d'écran chaque seconde + lecture du texte) |
| C3 | Notification unique | Jamais plus d'une notification de l'app | Android : nombre de notifications du paquet à chaque relevé. iOS : nombre de Live Activities de l'app (journal de l'app) et absence de notification classique |
| C4 | Live Activity iOS | Affichée sur l'écran verrouillé et mise à jour | Captures de l'écran verrouillé à deux indications différentes |
| C5 | Signature avec un compte Apple gratuit | Noter ce qu'elle demande | Documentation Apple et Expo, sans rien acheter |
| C6 | Permissions | Liste par plateforme, avec le texte d'explication exigé par les stores | Manifeste et Info.plist produits par le build + règles des stores |

Hors essai (déjà notés dans `PILOTAGE.md`, à vérifier sur un vrai
téléphone) : batterie, précision du GPS réel.

## Tâches

### T1 — Trace, rejeu et analyse (sur le Mac)

Dossier : `essais/02-suivi-verrouille/outils/`. Python 3 sans dépendance
externe, bash.

1. `fabriquer-trace.py` : lit R3.gpx, écrit `trace-1h.json` (3 600 points
   `[lat, lon]`, un par seconde à 5 m/s, avec `d` cumulée en mètres) et une
   version GPX. Écrit aussi la géométrie à embarquer dans l'app.
2. `rejouer.sh android|ios` : envoie un point par seconde, avec correction
   de la dérive (le point `i` part à `t0 + i` s).
   - Android : `adb -s emulator-5554 emu geo fix <lon> <lat>`.
   - iOS : `xcrun simctl location <UDID> set <lat>,<lon>`.
   - Journal : une ligne par point, heure Mac en millisecondes, `i`, `d`,
     lat, lon (`journaux/<plateforme>-rejeu.tsv`).
   - Options : premier point et nombre de points (pour un essai court).
3. `observer-android.sh` : chaque seconde, `dumpsys notification
   --noredact` sur l'émulateur ; écrit l'heure Mac, le nombre de
   notifications de `fr.vttnav.essai2`, et leur texte.
4. `observer-ios.sh` : chaque seconde, `xcrun simctl io <UDID> screenshot`
   puis lecture du texte de l'image (OCR, reconnaissance de texte) par le
   framework Vision de macOS (petit script Swift). Écrit l'heure Mac et le
   texte lu. Garde une capture par changement d'indication.
5. `analyser.py` : à partir des journaux (rejeu, observateur, journal de
   l'app), calcule C1 (positions par 5 s, plus grand trou), C2 (délai par
   changement, médiane, maximum, nombre < 5 s) et C3 (maximum de
   notifications). Écrit un tableau Markdown.
6. Preuve : `analyser.py` lancé sur de petits journaux fabriqués à la main,
   dont un avec un trou de 40 s et un avec deux notifications, qui doivent
   être signalés.

### T2 — App Expo et Android

Dossier : `essais/02-suivi-verrouille/app/`.

1. App Expo SDK 58 (mêmes versions que l'essai 1 : `expo ~58.0.16`,
   React Native 0.88.0), TypeScript, nom « Essai 2 », identifiant
   `fr.vttnav.essai2`. Build de développement (pas d'Expo Go). Metro sur le
   port 8081.
2. Suivi avec `expo-location/next` (API bêta, doc :
   https://docs.expo.dev/versions/v58.0.0/sdk/location-next.md) et ce
   qu'elle demande (`expo-task-manager` si besoin). Précision la plus haute,
   intervalle 1 s.
3. Android : service au premier plan dont la notification **est**
   l'indication, mise à jour en rappelant `ensureBackgroundSessionStarted`
   avec un nouveau texte (ADR 0006). Aucune autre notification.
4. Journal de l'app dans ses documents (`essai2-journal.jsonl`), une ligne
   par événement : position reçue (heure de l'appareil, heure de la
   position, lat, lon, `d`, `k`), mise à jour de la notification demandée,
   erreur. Il doit s'écrire aussi en arrière-plan.
5. Écran : bouton « Démarrer le suivi », bouton « Arrêter », indication
   courante, nombre de positions.
6. Permissions accordées par commande (`pm grant`, `appops`) pour ne pas
   cliquer. Les noter.
7. Preuve courte : 5 minutes de rejeu, app en arrière-plan, écran
   verrouillé ; `analyser.py` sur ces 5 minutes ; une capture de l'écran
   verrouillé avec la notification.
8. Build « release » prêt pour le rejeu d'1 h (sans Metro).

Garde-fou : si la notification du service ne se met pas à jour avec
`expo-location/next` après deux tentatives sérieuses, arrêt et compte
rendu (plan B de l'ADR 0006 : module natif à nous).

### T3 — iOS et Live Activity

1. Même app sur le simulateur iPhone 17 : localisation en arrière-plan
   (`UIBackgroundModes: location`), autorisation « Toujours » accordée par
   `xcrun simctl privacy <UDID> grant location-always fr.vttnav.essai2`.
2. Live Activity avec `expo-widgets` (doc :
   https://docs.expo.dev/versions/latest/sdk/widgets/) : indication
   courante, numéro `k`, distance parcourue. Démarrée au début du suivi,
   mise à jour quand `k` change, arrêtée à la fin. Le journal note chaque
   mise à jour et le nombre de Live Activities actives.
3. Preuve courte : 5 minutes de rejeu, app en arrière-plan, écran
   verrouillé ; captures de l'écran verrouillé à deux indications.
4. Build « release » simulateur prêt pour le rejeu d'1 h.
5. Noter tout ce que la signature demande (équipe, capacités, App Group).

Garde-fou : si la Live Activity ne s'affiche pas après deux tentatives
sérieuses, arrêt et compte rendu. Repli prévu par l'ADR 0006 : notification
locale au même identifiant.

### T4 — Rejeux d'1 h et résultats (session principale)

1. Rejeu d'1 h sur chaque plateforme, app en arrière-plan, écran
   verrouillé. Captures de l'écran verrouillé de temps en temps.
2. `analyser.py`, tableau des critères, captures dans
   `docs/essais/captures/02-*`.
3. Permissions et signature (C5, C6) : relevé par la session principale.

## Coût et risques

- Coût : moyen (2 à 3 sessions, dont 2 h de rejeu).
- `expo-location/next` est en bêta : son API peut différer de la doc.
- Le simulateur iOS ne met pas forcément l'app en pause comme un vrai
  iPhone : un succès sur simulateur reste à confirmer sur un vrai téléphone.
- L'émulateur Android est « branché sur secteur » : le mode Doze (veille
  profonde) ne se déclenche pas seul. Essai complémentaire si le temps le
  permet : 5 minutes en Doze forcé (`dumpsys deviceidle force-idle`).
