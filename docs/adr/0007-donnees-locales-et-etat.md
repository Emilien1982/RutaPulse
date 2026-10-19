# ADR 0007 — Données locales et gestion de l'état, avec TanStack

- Statut : Proposé
- Date : 2026-10-19
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
- **TanStack DB** (`@tanstack/react-db` 0.5.11 avec
  `@tanstack/expo-db-sqlite-persistence`) : la collection « Mes
  itinéraires », gardée dans SQLite. Les écrans lisent des requêtes vivantes
  (live queries) : la liste se met à jour seule après un ajout, un
  renommage ou une suppression. TanStack DB est en version 0.x : on
  l'enferme dans un seul module `itineraries`, pour pouvoir le remplacer par
  du SQLite direct sans toucher aux écrans.
- **TanStack Query** (`@tanstack/react-query` 5.104.5) : les appels
  asynchrones. Calcul d'itinéraire (la clé est la liste des points : annuler
  retrouve le résultat déjà calculé), lecture du catalogue des zones,
  téléchargements. Réglage `networkMode: 'always'` pour les calculs locaux,
  sinon Query les met en pause sans réseau.
- **TanStack Store** (`@tanstack/react-store` 0.11.2) : l'état du tracé en
  cours (points, historique pour annuler) et l'état du suivi (position,
  prochaine indication). Il est utilisable hors des composants, donc depuis
  la tâche GPS.
- **TanStack Pacer** (`@tanstack/react-pacer` 0.24.1, en bêta) : limiter la
  fréquence de trois actions : recalcul pendant qu'on déplace un point,
  rafraîchissement de l'écran de suivi, mise à jour de la notification.
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
- **SQLite direct sans TanStack DB** : plus simple et stable, mais il
  faudrait rafraîchir les écrans à la main. Reste le plan de repli.
- **AsyncStorage** (stockage clé-valeur simple) : peu adapté à des tracés
  de milliers de points.

## Conséquences

- Positif : chaque bibliothèque TanStack a un rôle précis et justifié.
- Négatif : Store, DB et Pacer sont en version 0.x ou en bêta. Leur API
  (interface de programmation) peut changer. On fige les versions et on lit les notes de version avant chaque
  mise à jour.
- Négatif : trois bibliothèques d'état à apprendre. Une règle simple les
  sépare : données gardées = DB, résultats asynchrones = Query, état vivant
  de session = Store.

## Sources

- TanStack Query et React Native : https://tanstack.com/query/latest/docs/framework/react/react-native
- Mode réseau de Query : https://tanstack.com/query/latest/docs/framework/react/guides/network-mode
- TanStack DB, persistance SQLite : https://tanstack.com/db/latest/docs/guides/sqlite-persistence
- TanStack Store : https://tanstack.com/store/latest/docs/overview
- TanStack Pacer : https://tanstack.com/pacer/latest/docs/overview
- TanStack Form et React Native : https://tanstack.com/form/latest/docs/framework/react/guides/react-native
- Versions npm : https://registry.npmjs.org/-/v1/search?text=%40tanstack%2Freact&size=50
