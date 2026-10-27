# ADR 0007 — Données locales et gestion de l'état, avec TanStack

- Statut : Accepté le 2026-10-19 (révisé le 2026-10-19 : TanStack DB retiré, à la demande d'Émilien)
- Date : 2026-10-19
- Précisé par l'[ADR 0016](0016-itineraire-en-creation.md) (2026-10-27) : clé de Query par tronçon, Pacer pendant le glisser
- Détail des recherches : [docs/04-architecture-annexe-recherches.md](../04-architecture-annexe-recherches.md), section TanStack

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- Données à garder sur le téléphone : la liste des itinéraires (nom, points,
  tracé, infos) et les paquets de zone téléchargés.
- État vivant à partager entre écrans :
  1. le tracé en cours de création, avec « annuler » ;
  2. le suivi en cours, mis à jour par la tâche GPS, qui tourne hors des
     écrans ;
  3. les calculs d'itinéraire, asynchrones (le résultat arrive plus tard).
- Émilien veut découvrir les bibliothèques TanStack quand elles conviennent
  vraiment.

## Décision

- **Fichiers** (`expo-file-system`) : paquets de zone, fichiers GPX
  (format d'échange de traces GPS).
- **Base locale** (`expo-sqlite`, base de données SQLite dans le
  téléphone) : les itinéraires.
- **TanStack Query** (`@tanstack/react-query` 5.104.5) : les appels
  asynchrones, **y compris la lecture des itinéraires dans SQLite**. Après
  chaque création, renommage ou suppression, on invalide la requête (on
  demande à Query de relire) : la liste se met à jour. Calcul d'itinéraire (la clé est la liste des points : annuler
  retrouve le résultat déjà calculé), lecture du catalogue des zones,
  téléchargements. Réglage `networkMode: 'always'` pour les calculs locaux,
  sinon Query les met en pause sans réseau.
- **TanStack Store** (`@tanstack/react-store` 0.11.2) : l'état du tracé en
  cours (points, historique pour annuler) et l'état du suivi (position,
  prochaine indication). Il est utilisable hors des composants, donc depuis
  la tâche GPS.
- **TanStack Pacer** (`@tanstack/react-pacer` 0.24.1, en version 0.x) : limiter la
  fréquence de trois actions : recalcul pendant qu'on déplace un point,
  rafraîchissement de l'écran de suivi, mise à jour de la notification.
- **Pas de TanStack DB** en v1 : il ajoute une couche au-dessus de SQLite
  pour mettre les écrans à jour seuls. Query le fait déjà pour une liste de
  quelques dizaines d'itinéraires. DB devient utile avec une synchronisation
  vers un serveur (idée « comptes et sauvegarde en ligne », non planifiée).
  Il est aussi en version 0.x.
- **Pas de TanStack Form** en v1 : le seul champ à saisir est le nom d'un
  itinéraire. Un champ de texte simple suffit.
- **Pas de TanStack Router** : il ne supporte pas React Native (voir
  ADR 0008).
- **Pas de TanStack Virtual** : les listes sont courtes ; `FlatList` (liste
  de React Native) suffit.
- **Textes de l'app** : rangés dans un seul fichier de traductions
  françaises, appelé par une petite fonction `t()`. Pas de bibliothèque de
  traduction en v1.

## Alternatives rejetées

- **Zustand** (petite bibliothèque d'état très répandue) : ferait le même
  travail que TanStack Store. Store convient aussi, et Émilien veut
  découvrir TanStack.
- **Redux Toolkit** : trop de cérémonie pour trois états.
- **TanStack DB par-dessus SQLite** (proposé d'abord) : rafraîchit les
  écrans seul, mais Query le fait déjà ici. Une dépendance en version 0.x
  pour un gain faible.
- **AsyncStorage** (stockage clé-valeur simple) : peu adapté à des tracés
  de milliers de points.

## Conséquences

- Positif : chaque bibliothèque TanStack a un rôle précis et justifié.
- Négatif : Store et Pacer sont en version 0.x. Leur API
  (interface de programmation) peut changer. On fige les versions et on lit les notes de version avant chaque
  mise à jour.
- Une règle simple sépare les rôles : données gardées = SQLite, lues par
  Query ; résultats asynchrones = Query ; état vivant de session = Store.

## Sources

- TanStack Query et React Native : https://tanstack.com/query/latest/docs/framework/react/react-native
- Mode réseau de Query : https://tanstack.com/query/latest/docs/framework/react/guides/network-mode
- TanStack Store : https://tanstack.com/store/latest/docs/overview
- TanStack Pacer : https://tanstack.com/pacer/latest/docs/overview
- TanStack Form et React Native : https://tanstack.com/form/latest/docs/framework/react/guides/react-native
- Versions npm : https://registry.npmjs.org/-/v1/search?text=%40tanstack%2Freact&size=50
