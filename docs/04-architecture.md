# Étape 3b — Architecture de la v1 : synthèse

> 19 octobre 2026. Proposition de l'architecte, **validée par Émilien le 19 octobre 2026**.
> Détail des recherches et sources : [annexe](04-architecture-annexe-recherches.md).
> Décisions : ADR (fiches de décision d'architecture) dans [docs/adr/](adr/).

## En bref

1. React Native avec Expo, carte MapLibre, calcul d'itinéraire **sur le
   téléphone** avec le moteur Valhalla.
2. Les zones (carte, calcul, altitude) sont préparées sur ton Mac et
   hébergées gratuitement sur GitHub.
3. Trois essais jetables d'abord. Le premier décide si la création hors
   ligne entre en v1.

## La stack (ensemble des technologies)

| Besoin | Choix | ADR |
|---|---|---|
| Framework (cadre de travail) | React Native 0.88 avec **Expo SDK 58** (SDK : kit de développement), TypeScript (JavaScript typé), versions de développement compilées sur ton Mac | [0001](adr/0001-expo-react-native.md) |
| Calcul d'itinéraire hors ligne | **Valhalla** (moteur de calcul libre) via **valhalla-mobile** (sa version pour Android et iOS), dans un petit module natif à nous | [0002](adr/0002-calcul-itineraire-valhalla.md) |
| Données hors ligne | Paquets de zone fabriqués par un script, publiés sur GitHub Releases (fichiers joints au dépôt) | [0003](adr/0003-paquets-de-zone.md) |
| Carte | **MapLibre React Native** 11.5 (affichage de carte libre), fichier PMTiles (toute la carte d'une zone en un fichier) ; OpenFreeMap (serveur de cartes gratuit) en ligne hors zones | [0004](adr/0004-carte-maplibre.md) |
| Altitude, type de voie, difficulté, GPX (format d'échange de traces GPS) | Valhalla + table de difficulté VTT ; dénivelé calculé par nous ; `@tmcw/togeojson` pour lire le GPX | [0005](adr/0005-infos-itineraire.md) |
| Suivi verrouillé | `expo-location/next` ; Android : notification du service ; iOS : Live Activity (bandeau en direct sur l'écran verrouillé) | [0006](adr/0006-suivi-arriere-plan-notification.md) |
| Stockage local | `expo-sqlite` (SQLite : base de données dans le téléphone) + `expo-file-system` (fichiers) | [0007](adr/0007-donnees-locales-et-etat.md) |
| État | TanStack Query (lecture des itinéraires, calculs), Store (session), Pacer (fréquences) | [0007](adr/0007-donnees-locales-et-etat.md) |
| Navigation entre écrans | **Expo Router** | [0008](adr/0008-navigation-expo-router.md) |
| Tests | Jest + Testing Library (unitaires, écrans) ; **Maestro** (de bout en bout) | [0009](adr/0009-tests.md) |
| Distribution | APK (paquet Android) direct ; iOS par Xcode (outil de développement d'Apple), ou TestFlight (distribution de test d'Apple) à 99 USD/an | [0010](adr/0010-distribution-test-interne.md) |

Coût : **0 €**, sauf si tu choisis TestFlight pour iOS (99 USD par an).

## La création d'itinéraire hors ligne en v1 : réaliste ?

**Oui, probablement, mais pas encore prouvé.** Valhalla tourne sur Android
et iOS grâce à valhalla-mobile (licence libre MIT, 9 versions publiées en
2026, la dernière le 6 octobre). Valhalla a un réglage « vélo tout-terrain »
et donne les instructions en français. Ce qui manque : personne n'a documenté son usage
depuis React Native, et sa communauté est petite.

**Repli concret si l'essai 1 échoue** : en v1, création d'itinéraire **en
ligne** avec openrouteservice (service de calcul en ligne, gratuit avec une
clé personnelle gardée hors du dépôt ; quota annoncé de 2 000 calculs par
jour, lu via un moteur de recherche et non relu à la source). Carte, infos et suivi restent hors ligne : un
itinéraire créé est gardé sur le téléphone. La création hors ligne passe en
V2.

## Les 6 risques

| # | Risque | Recommandation | Risque restant |
|---|---|---|---|
| 1 | Calcul VTT sans réseau | Valhalla via valhalla-mobile | **Élevé** jusqu'à l'essai 1 |
| 2 | Cartes hors ligne | Nos propres fichiers PMTiles par zone (fabriqués par l'outil Planetiler), relief et courbes fabriqués à l'avance | Moyen |
| 3 | Altitude | Tuiles d'altitude de Valhalla ; RGE ALTI 5 m (modèle d'altitude de l'IGN, mesuré au laser) si l'écart dépasse 10 % | Faible |
| 4 | Terrain et difficulté | Type de voie : toujours connu. Surface : 16 à 29 % des voies. Difficulté VTT : 1 à 4 % seulement en France | Faible (difficulté souvent « inconnue », admis par le cadrage) |
| 5 | Suivi verrouillé | Modules Expo ; une notification mise à jour (Android), Live Activity (iOS) | Moyen (API, interface de programmation, en bêta ; iOS non éprouvé) |
| 6 | Batterie | GPS profil sport, écran allumé seulement en suivi, mises à jour limitées. Repère publié : 6 %/h écran éteint, 12 %/h écran allumé | Moyen |

## TanStack : mon avis

- **Query** : oui. Calcul d'itinéraire, catalogue des zones,
  téléchargements. « Annuler » retrouve le calcul précédent sans le refaire.
- **Store** : oui. Tracé en cours et suivi. Il marche hors des écrans, donc
  depuis la tâche GPS.
- **DB** : non en v1 (retiré le 19 octobre). Query, qui lit SQLite, suffit
  à mettre la liste à jour. Utile plus tard avec une synchronisation.
- **Pacer** : oui, petit usage. Limiter la fréquence des recalculs et des
  mises à jour. En bêta.
- **Form** : non en v1. Un seul champ (renommer).
- **Router** : non. Il ne marche pas avec React Native.
- **Virtual, Table, Start** : non. Faits pour le web, ou sans besoin ici.

## Essais jetables, dans l'ordre

| Ordre | Essai | Comment | Critères de réussite | Taille |
|---|---|---|---|---|
| 1 | **Calcul VTT hors ligne** (risques 1, 3, 4) | App Expo minimale + module natif Valhalla. Une zone test de 50 × 50 km autour d'un coin VTT que tu connais. 5 itinéraires de référence (trace réelle ou site reconnu). | Tourne en mode avion sur les simulateurs Android et iOS. Calcul de 30 km avec 5 points en moins de 3 s (médiane de 10 essais). 4 itinéraires sur 5 jugés praticables par toi. Distance à ± 5 % et dénivelé positif à ± 10 % de la référence. Instructions en français. Calcul + altitude de la zone ≤ 150 Mo. App grossie de 50 Mo au plus. 50 calculs à la suite sans plantage. | Grande : 3 à 5 sessions |
| 2 | **Suivi verrouillé et batterie** (risques 5, 6) | App minimale qui suit une trace fixe. Fausse indication qui change tous les 200 m. Trace GPS rejouée d'1 h sur chaque simulateur, écran verrouillé puis allumé. | Au moins 1 position toutes les 5 s en moyenne, aucun trou de plus de 30 s. Notification mise à jour en moins de 5 s, sur 20 changements. Jamais plus d'une notification de l'app. Batterie : ≤ 8 %/h verrouillé, ≤ 20 %/h écran allumé (luminosité 50 %). Noter si la Live Activity marche avec le compte Apple gratuit. | Moyenne : 2 à 3 sessions |
| 3 | **Carte hors ligne** (risque 2) | Script : carte PMTiles de la zone test, relief, courbes de niveau. Affichage en mode avion. | Carte visible du zoom 8 au zoom 16 sans tuile vide, sur les deux simulateurs. Sentiers et pistes distincts. Courbes visibles dès le zoom 13. Carte + relief + courbes ≤ 150 Mo. | Petite : 1 à 2 sessions |

Pourquoi cet ordre : l'essai 1 décide du contenu de la v1 et prouve qu'Expo
accepte un module natif lourd. L'essai 2 porte sur le deuxième plus gros
inconnu. L'essai 3 est le moins risqué. Le code des essais est jeté ; seuls
les résultats chiffrés et les scripts de zone sont gardés.

### Sur simulateurs (décision d'Émilien, 19 octobre)

Les essais se font sur le simulateur iOS (iOS 26.5, déjà installé) et
l'émulateur Android (Pixel 6, API 33 ou 34, déjà installé), pour limiter tes
manipulations. Le GPS est simulé en rejouant une trace GPX.

| Critère | Prouvable sur simulateur ? |
|---|---|
| Calcul en mode avion, instructions en français, tailles des fichiers, 50 calculs sans plantage | Oui |
| Distance et dénivelé comparés à la référence | Oui |
| Itinéraires « praticables » | Oui : je t'envoie des captures, tu juges sur image |
| Temps de calcul < 3 s | **Non fiable** : le simulateur iOS utilise le processeur du Mac, plus rapide qu'un téléphone. Mesuré quand même, à titre indicatif |
| Suivi téléphone verrouillé, notification unique mise à jour | Oui, avec une trace GPS rejouée |
| Live Activity (bandeau en direct iOS) avec un compte Apple gratuit | Partiel : le simulateur l'affiche, mais la signature de l'app n'est pas éprouvée |
| Batterie | **Non** : à mesurer plus tard, lors d'une vraie sortie avec l'app |
| Précision du GPS en forêt | **Non** : idem |

Ce qui ne peut pas être prouvé sur simulateur est noté dans `PILOTAGE.md`
comme « à vérifier sur un vrai téléphone ». Ce sera fait en une seule fois,
quand une première version de l'app existera.

## Décisions à valider par toi

1. La stack ci-dessus et les 10 ADR (statut « Proposé »).
2. La création hors ligne en v1, **sous condition** de l'essai 1, avec le
   repli en ligne décrit plus haut.
3. Des zones préparées par toi, sur ton Mac, à la demande de tes proches.
   Pas de zone libre choisie dans l'app en v1.
4. iOS : compte Apple gratuit pour commencer (réinstallation tous les 7
   jours, par câble) ; passage à 99 USD par an plus tard, si besoin.
5. Le tri TanStack : Query, Store et Pacer oui ; DB, Form, Router, Virtual
   non.
6. Lancer les essais dans l'ordre 1, 2, 3, sur simulateurs. Pour l'essai 1,
   la zone test et les 5 itinéraires de référence sont à choisir.
