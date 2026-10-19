# ADR 0001 — Construire l'app avec React Native et Expo

- Statut : Accepté le 2026-10-19
- Date : 2026-10-19
- Détail des recherches : [docs/04-architecture-annexe-recherches.md](../04-architecture-annexe-recherches.md)

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- RutaPulse vise Android et iOS avec un seul code (cadrage, docs/03).
- Émilien connaît bien React Native (bibliothèque pour écrire des apps
  mobiles en JavaScript).
- L'app a besoin de code natif (écrit dans le langage de la plateforme) :
  calcul d'itinéraire en C++, GPS en arrière-plan, notification sur l'écran
  verrouillé.
- La documentation de React Native recommande de démarrer avec un framework
  (cadre de travail) comme Expo.

## Décision

- React Native avec **Expo SDK 58** (SDK : kit de développement), sorti le
  15 octobre 2026, qui embarque React Native 0.88.
- Langage : TypeScript (JavaScript avec des types vérifiés), en mode strict.
- On utilise des **development builds** (versions de développement : notre
  propre app compilée avec ses modules natifs), pas Expo Go (l'app de
  démonstration d'Expo, qui ne peut pas charger nos modules natifs).
- Les dossiers natifs `android/` et `ios/` sont générés par Expo à partir de
  la configuration (principe « CNG », Continuous Native Generation,
  génération continue du code natif). On ne les modifie pas à la main.
- Le code natif à nous passe par l'**Expo Modules API** (interface pour
  écrire un module natif en Swift pour iOS et en Kotlin pour Android).
- Compilation sur le Mac d'Émilien, avec Xcode et Android Studio (outils de
  développement d'Apple et de Google). Le service
  EAS Build (compilation en ligne d'Expo) reste possible dans son offre
  gratuite, mais n'est pas nécessaire.
- Si l'essai 1 montre un blocage propre au SDK 58, trop récent, on se replie
  sur le SDK 57 (React Native 0.86).

## Alternatives rejetées

- **React Native sans framework** : il faut alors assembler soi-même ce
  qu'Expo fournit (configuration native, modules, mises à jour). Plus de
  travail, aucun gain pour nos besoins.
- **Flutter** ou **Kotlin Multiplatform** (autres outils multiplateformes) :
  Émilien ne les connaît pas, et ses préférences vont à React Native.
- **Deux apps natives** (Swift et Kotlin) : deux codes à écrire. Contraire au
  cadrage.

## Conséquences

- Positif : un seul code, des modules Expo maintenus (localisation,
  notifications, SQLite, fichiers), une configuration native reproductible.
- Négatif : MapLibre React Native v11 impose la « New Architecture »
  (nouvelle architecture interne de React Native). Toutes nos bibliothèques
  doivent la supporter.
- Négatif : le SDK 58 n'a que quelques jours. Des bibliothèques tierces
  peuvent tarder à suivre.
- À éprouver (essai 1) : brancher valhalla-mobile, distribué pour iOS par
  Swift Package Manager (gestionnaire de paquets d'Apple), dans un projet
  Expo qui utilise CocoaPods (autre gestionnaire de paquets iOS).

## Sources

- React Native recommande un framework : https://reactnative.dev/docs/environment-setup
- Expo SDK 58 : https://expo.dev/changelog/sdk-58
- Expo Modules API : https://docs.expo.dev/modules/overview/
- Offres EAS : https://docs.expo.dev/billing/plans/
