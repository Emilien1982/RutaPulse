# ADR 0008 — Navigation entre écrans avec Expo Router

- Statut : Accepté le 2026-10-19
- Date : 2026-10-19

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- L'app a peu d'écrans : carte, création d'itinéraire, détail d'un
  itinéraire, mes itinéraires, zones, suivi.
- Émilien aurait aimé essayer TanStack Router.

## Décision

- **Expo Router** (version 58.0.24, publiée le 19 octobre 2026) : chaque
  écran est un fichier du dossier `app/`. Il est fourni avec Expo et repose
  sur React Navigation (bibliothèque de navigation de référence en React
  Native).

## Alternatives rejetées

- **TanStack Router** : sa documentation dit qu'il ne marche qu'avec React
  et ReactDOM (le rendu pour navigateur web). Un adaptateur React Native
  serait en préparation, mais rien de publié.
- **React Navigation seul** : marche très bien, mais demande de déclarer les
  écrans à la main. Expo Router le fait à partir des fichiers.

## Conséquences

- Positif : navigation maintenue avec Expo, liens profonds (ouvrir un écran
  précis depuis une notification) fournis.
- Négatif : aucun pour la v1.

## Sources

- Expo Router sur npm : https://registry.npmjs.org/-/v1/search?text=expo-router&size=3
- TanStack Router, démarrage rapide : https://github.com/TanStack/router/blob/main/docs/router/quick-start.md
