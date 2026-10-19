# ADR 0003 — Préparer les zones sur l'ordinateur et les héberger sur GitHub Releases

- Statut : Accepté le 2026-10-19
- Date : 2026-10-19
- Détail des recherches : [docs/04-architecture-annexe-recherches.md](../04-architecture-annexe-recherches.md), risques 1 à 4

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- Sans réseau, le téléphone a besoin de la carte, des données de calcul et
  des altitudes d'une zone (cadrage, fonction 6).
- Les serveurs de tuiles (carrés de carte) d'OpenStreetMap interdisent le
  téléchargement pour un usage hors ligne.
- Aucun coût récurrent n'est permis.

## Décision

- Une **zone** est un rectangle d'environ 50 × 50 km. La taille exacte sera
  fixée par l'essai 1 selon le poids des fichiers.
- Un **paquet de zone** contient :
  1. les tuiles de calcul de Valhalla ;
  2. les tuiles d'altitude au format HGT (grille d'altitudes lue par
     Valhalla) ;
  3. la carte au format PMTiles (toutes les tuiles dans un seul fichier),
     schéma OpenMapTiles (organisation standard des données de carte) ;
  4. le relief (ombrage) et les courbes de niveau ;
  5. une petite table « identifiant de voie → difficulté VTT » ;
  6. un fichier de description : nom, limites, date des données, taille.
- Les paquets sont fabriqués **sur le Mac d'Émilien** par un script, à
  partir d'un extrait régional d'OpenStreetMap (OSM, la carte libre et
  collaborative). Outils prévus : les outils de Valhalla (moteur de calcul
  d'itinéraire, voir ADR 0002) pour le calcul, Planetiler (outil qui
  fabrique les tuiles, licence Apache 2.0) pour la carte.
- Les paquets sont publiés comme fichiers d'une release (version publiée)
  GitHub du dépôt public. Limite : 2 Gio par fichier, pas de limite de
  bande passante. Coût : 0.
- Un fichier `catalogue.json` (au format JSON, format texte de données),
  publié de la même façon, liste les zones.
  L'app lit ce catalogue, télécharge un paquet et le range sur le téléphone.
- En v1, la liste des zones est fixée par Émilien : il lance le script pour
  les zones demandées par ses proches. Mise à jour des données : à la main,
  quand il le décide.
- L'app affiche « © OpenStreetMap » et « © OpenMapTiles », comme l'exigent
  les licences.

## Option à étudier (essai 3)

- Faire tourner le script dans **GitHub Actions** (machines de GitHub qui
  exécutent des tâches, gratuites pour un dépôt public). Émilien n'aurait
  plus besoin de son Mac pour fabriquer une zone. À vérifier : mémoire,
  disque et durée suffisants sur les machines gratuites.

## Alternatives rejetées

- **Zone libre dessinée au doigt dans l'app** : demande un serveur qui
  fabrique les paquets à la demande, donc un coût et une maintenance.
- **Télécharger les tuiles d'un serveur public** : interdit par OpenStreetMap.
  OpenFreeMap (serveur de cartes gratuit) l'autorise, mais seulement jusqu'à 3 000 tuiles ou 50 Mo par
  téléchargement, et ne fournit ni données de calcul ni courbes de niveau.
- **Cloudflare R2** (stockage en ligne) : gratuit jusqu'à 10 Go par mois.
  Bon plan B, mais un compte de plus à gérer. GitHub suffit.
- **Fabriquer les données sur le téléphone** : trop lourd en calcul et en
  mémoire pour un téléphone.

## Conséquences

- Positif : coût nul, données identiques en ligne et hors ligne, tout est
  reproductible par un script versionné dans le dépôt.
- Négatif : un utilisateur ne peut pas créer d'itinéraire hors des zones
  préparées.
- Négatif : Émilien doit faire tourner le script. Le temps de fabrication
  et l'espace disque nécessaires ne sont pas encore mesurés.
- Les données OSM publiées restent sous licence ODbL (Open Database
  License, licence de base de données ouverte) : attribution obligatoire.

## Sources

- GitHub Releases : https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- Politique des tuiles OSM : https://operations.osmfoundation.org/policies/tiles/
- OpenFreeMap, conditions : https://openfreemap.org/tos/
- Planetiler : https://github.com/onthegomap/planetiler
- Cloudflare R2, tarifs : https://developers.cloudflare.com/r2/pricing
