# ADR 0006 — Suivi en arrière-plan et notification unique

- Statut : Accepté le 2026-10-19 (à confirmer par l'essai 2)
- Date : 2026-10-19
- Détail des recherches : [docs/04-architecture-annexe-recherches.md](../04-architecture-annexe-recherches.md), risques 5 et 6

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- Pendant le suivi, l'écran reste allumé. Téléphone verrouillé, le suivi
  continue et la prochaine indication s'affiche dans **une seule**
  notification, mise à jour (cadrage, fonctions 7 et 8).
- Android et iOS limitent le GPS en arrière-plan.
- La batterie doit tenir plusieurs heures.

## Décision

- **GPS** : `expo-location`, nouvelle API (interface de programmation)
  `expo-location/next`, en bêta dans Expo SDK 58 (SDK : kit de
  développement). On y ajoute `expo-task-manager` pour recevoir les
  positions en arrière-plan. Profil de localisation « fitness » (activité sportive).
- **Android** : le suivi tourne dans un foreground service (service de
  premier plan, tâche qui continue avec une notification visible). Cette
  notification **est** l'indication : on la met à jour en rappelant
  `ensureBackgroundSessionStarted` avec un nouveau texte. Une seule
  notification à l'écran.
- **iOS** : une Live Activity (bandeau en direct sur l'écran verrouillé)
  avec `expo-widgets`, mise à jour à chaque nouvelle indication. Repli si
  l'essai échoue : une notification locale (`expo-notifications`) envoyée
  toujours avec le même identifiant, ce qui remplace la précédente, au
  niveau `passive` (sans son).
- **Guidage** : notre code TypeScript (JavaScript typé) place la position
  sur le tracé, avec `@turf/turf` (calculs géographiques), et choisit la
  prochaine manœuvre de Valhalla (moteur de calcul d'itinéraire, voir
  ADR 0002). La notification n'est mise à jour que si le texte change ou si
  la distance affichée change de palier (par exemple 500 m, 200 m, 50 m).
- **Écran allumé** : `expo-keep-awake`, actif seulement pendant le suivi.
- **Batterie** : pas de mise à jour d'écran plus d'une fois par seconde,
  style de carte sombre pendant le suivi, arrêt du GPS à la fin du suivi.

## Alternatives rejetées

- **react-native-background-geolocation** (Transistor Software) : très
  complet, mais licence payante pour les versions finales Android. Contraire
  à la règle « aucun coût ».
- **Notifee** (notifications avancées) : archivé en avril 2026.
- **expo-live-activity** (Software Mansion) : archivé le 1er juin 2026 ; il
  renvoie lui-même vers `expo-widgets`.
- **Ancienne API de `expo-location`** : sa notification de service est
  fixée au démarrage. Aucun moyen documenté de la mettre à jour.
- **Module natif écrit par nous** : plan B si l'API bêta d'Expo pose
  problème. Plus de code natif à maintenir.

## Conséquences

- Positif : uniquement des modules Expo, gratuits et maintenus.
- Négatif : `expo-location/next` est en bêta. Son API peut changer d'une
  version d'Expo à l'autre.
- Négatif : deux mécanismes de notification différents (Android et iOS)
  derrière une même fonction TypeScript.
- Inconnus, à éprouver par l'essai 2 : mise à jour de la notification
  Android quand l'app est en arrière-plan ; fréquence de mise à jour permise
  pour une Live Activity ; fonctionnement avec un compte Apple gratuit ;
  consommation de batterie réelle.
- Le cadrage prévoit la publication sur les stores (magasins d'applications)
  plus tard. Les règles de Google sur la localisation en arrière-plan
  devront alors être relues.

## Sources

- expo-location, API `next` : https://docs.expo.dev/versions/v58.0.0/sdk/location-next.md
- expo-location : https://docs.expo.dev/versions/latest/sdk/location/
- expo-widgets : https://docs.expo.dev/versions/latest/sdk/widgets/
- expo-notifications : https://docs.expo.dev/versions/latest/sdk/notifications/
- Apple, identifiant de notification : https://developer.apple.com/tutorials/data/documentation/usernotifications/unnotificationrequest/identifier.md
- expo-live-activity archivé : https://github.com/software-mansion-labs/expo-live-activity
- Batterie, mesures OsmAnd : https://osmand.net/docs/user/troubleshooting/general
