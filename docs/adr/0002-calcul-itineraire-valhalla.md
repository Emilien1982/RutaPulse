# ADR 0002 — Calculer les itinéraires sur le téléphone avec Valhalla

- Statut : Accepté le 2026-10-19 (dépend du résultat de l'essai 1)
- Date : 2026-10-19
- Détail des recherches : [docs/04-architecture-annexe-recherches.md](../04-architecture-annexe-recherches.md), risque 1

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- La v1 doit calculer un itinéraire VTT par les sentiers, même sans réseau,
  sur Android et iOS (cadrage, fonction 2 et risque 1).
- Il faut donc un moteur de calcul qui tourne **dans** le téléphone, sur les
  deux plateformes, avec un profil VTT.
- Il faut aussi des instructions écrites en français pour le suivi
  (fonction 7).

## Décision

- Moteur : **Valhalla** (moteur de calcul d'itinéraire libre, en C++,
  licence MIT, version 3.9.1 du 6 octobre 2026).
- Version mobile : **valhalla-mobile** (Valhalla compilé pour Android et
  iOS, licence MIT, version 0.6.4 du 6 octobre 2026).
- Pont vers JavaScript : un petit module natif à nous, écrit avec l'Expo
  Modules API (voir ADR 0001). Il expose trois fonctions : `route`
  (calculer), `traceAttributes` (détails des voies traversées) et `height`
  (altitudes). Il reçoit et renvoie le JSON (format texte de données) de
  Valhalla, sans le transformer.
- Profil : vélo `bicycle_type: mountain`, réglages `use_roads`, `use_hills`,
  `avoid_bad_surfaces` à calibrer pendant l'essai 1.
- Langue des instructions : `fr-FR`.
- Le calcul se fait **toujours** sur le téléphone, même avec du réseau. Un
  seul chemin de code, testé tous les jours.
- Les données de calcul viennent d'un paquet de zone téléchargé (voir
  ADR 0003). Sans zone, pas de création d'itinéraire en v1.

## Alternatives rejetées

- **BRouter** (moteur réputé pour le vélo, licence MIT) : en Java, Android
  seulement. Aucun portage iOS trouvé.
- **GraphHopper** : son portage iOS date de 2014 et était expérimental. Rien
  de maintenu trouvé.
- **Ferrostar** (kit de navigation qui s'appuie sur Valhalla) : pas de paquet
  React Native publié trouvé. Ajoute une couche pour un besoin simple.
- **Routeur maison en TypeScript** : il faudrait écrire le moteur, le profil
  VTT, les instructions et le format des données. Gardé comme plan C si
  valhalla-mobile échoue et qu'Émilien tient au hors ligne en v1.
- **Calcul en ligne seulement** (par exemple openrouteservice, gratuit avec
  quota) : ne répond pas au besoin « sans réseau ». C'est le **plan de
  repli** si l'essai 1 échoue : création en ligne en v1, hors ligne en V2.

## Conséquences

- Positif : un seul moteur pour les deux plateformes, avec instructions en
  français, profil d'altitude, surface et type de voie.
- Négatif : valhalla-mobile a une petite communauté (80 étoiles sur GitHub).
  Si le projet s'arrête, il faudra compiler Valhalla nous-mêmes (licence
  MIT, c'est permis, mais c'est lourd).
- Négatif : Valhalla ne garde pas la difficulté VTT (`mtb:scale`). Voir
  ADR 0005.
- Inconnu jusqu'à l'essai 1 : taille ajoutée à l'app, mémoire, temps de
  calcul, qualité des itinéraires VTT en France.

## Licences (note, 2026-10-20)

Valhalla, valhalla-mobile et leurs bibliothèques embarquées sont sous
licences permissives (MIT, BSD, Boost, Apache 2.0). Stores, vente et
modification sont permis, à condition de garder les mentions de copyright
dans un écran « Licences ». Données : © OpenStreetMap (ODbL) et
© OpenMapTiles (CC-BY) à afficher. Ce n'est pas un avis juridique. La liste
complète est à dresser seulement si une commercialisation est envisagée.

## Sources

- Valhalla, API de calcul : https://valhalla.github.io/valhalla/api/route/api-reference/
- Valhalla, release : https://api.github.com/repos/valhalla/valhalla/releases/latest
- valhalla-mobile : https://github.com/Rallista/valhalla-mobile
- valhalla-mobile, versions : https://repo1.maven.org/maven2/io/github/rallista/valhalla-mobile/
- BRouter : https://brouter.de/brouter/index.html
