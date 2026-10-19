# ADR 0004 — Afficher la carte avec MapLibre React Native

- Statut : Proposé (à confirmer par l'essai 3)
- Date : 2026-10-19
- Détail des recherches : [docs/04-architecture-annexe-recherches.md](../04-architecture-annexe-recherches.md), risque 2

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- Il faut une carte adaptée au VTT : sentiers, pistes, courbes de niveau,
  position GPS (cadrage, fonction 1).
- Elle doit marcher sans réseau, à partir du paquet de zone (ADR 0003).
- Pas de compte payant ni de clé d'accès.

## Décision

- Bibliothèque : **@maplibre/maplibre-react-native** 11.5.0 (licence MIT,
  publiée le 4 octobre 2026). Elle affiche des tuiles vectorielles (tuiles
  qui contiennent des données et non des images) sur Android et iOS.
- Hors ligne : la carte lit le fichier PMTiles (toutes les tuiles d'une zone
  dans un seul fichier) du paquet de zone.
- En ligne, hors des zones téléchargées : la carte vient d'**OpenFreeMap**
  (serveur de tuiles gratuit, sans clé). Il utilise le même schéma
  OpenMapTiles, donc le même style de carte.
- Style : un style VTT à nous, dérivé d'un style libre compatible
  OpenMapTiles. Il met en avant les pistes et sentiers, la surface et la
  difficulté quand elles sont connues.
- Relief : un ombrage calculé par MapLibre à partir de tuiles d'altitude
  (source prévue : Mapterhorn, format PMTiles). Courbes de niveau :
  fabriquées à l'avance par le script de zone, car MapLibre ne sait pas les
  calculer sur le téléphone.

## Alternatives rejetées

- **react-native-maps** (cartes Google et Apple) : conçu autour des fonds
  de Google et d'Apple, qui ne sont pas des cartes VTT. Son support de nos
  propres tuiles vectorielles hors ligne n'a pas été vérifié. MapLibre, lui,
  est fait pour les tuiles vectorielles et les styles à soi.
- **Mapbox** (@rnmapbox/maps) : service commercial avec compte et clé
  d'accès. Ses conditions n'ont pas été étudiées en détail ; écarté car
  MapLibre répond au besoin sans compte.
- **Serveurs de cartes tiers** (MapTiler, IGN) : MapTiler limite son offre
  gratuite à l'usage non commercial, et sa clause sur le hors ligne n'a pas
  pu être lue. Pour l'IGN, les limites de téléchargement en masse n'ont pas
  été trouvées. Les cartes de l'IGN sont tentantes pour la France ; à
  réétudier plus tard.
- **Téléchargement par OpenFreeMap seul** (avec `OfflineManager`, la
  fonction de téléchargement de MapLibre) : permis jusqu'à
  3 000 tuiles ou 50 Mo, mais sans courbes de niveau. Gardé comme repli si
  la lecture d'un PMTiles local échoue.

## Conséquences

- Positif : gratuit, libre, même style en ligne et hors ligne.
- Négatif : MapLibre React Native v11 demande la « New Architecture »
  (nouvelle architecture interne de React Native) et React Native ≥ 0.80.
- À éprouver (essai 3) : la lecture d'un fichier PMTiles local par
  MapLibre React Native v11. Le moteur sous-jacent le permet depuis 2025,
  mais je ne l'ai pas vu documenté pour React Native.
- À éprouver (essai 3) : la fabrication des courbes de niveau et leur poids.

## Sources

- MapLibre React Native : https://github.com/maplibre/maplibre-react-native/releases
- Installation avec Expo : https://maplibre.org/maplibre-react-native/docs/setup/expo
- PMTiles dans MapLibre Native : https://maplibre.org/news/2025-02-03-maplibre-newsletter-january-2025/
- Pas de courbes calculées par MapLibre Native : https://maplibre.org/news/2026-06-03-maplibre-newsletter-may-2026/
- OpenFreeMap : https://openfreemap.org/tos/
- Schéma OpenMapTiles : https://openmaptiles.org/schema/
- Mapterhorn : https://mapterhorn.com/
