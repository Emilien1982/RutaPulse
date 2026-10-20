# Essai 3 — Carte hors ligne et circuits balisés : résultats

> Terminé le 20 octobre 2026 (verdict en tête). Spec :
> [03-carte-hors-ligne-spec.md](03-carte-hors-ligne-spec.md).
> Scripts réutilisables : `essais/03-carte-hors-ligne/zone/`. Code jetable :
> `essais/03-carte-hors-ligne/app/`.

## Verdict

**La carte hors ligne de l'ADR 0004 marche, sans repli.** MapLibre React
Native 11.5.0 lit directement les fichiers PMTiles (toutes les tuiles d'une
zone dans un seul fichier) rangés sur le téléphone. Cela marche dès le premier
essai, sur Android et sur iOS. Carte, relief et courbes pèsent 28,8 Mo pour la
zone de Nancy, cinq fois moins que la limite. Les circuits VTT balisés entrent
dans le paquet (56 Ko).

**GitHub Actions peut fabriquer un paquet complet** d'après les mesures : la
mémoire, le disque et la durée sont loin des limites d'une machine gratuite.
Ce n'est pas prouvé par un vrai lancement (rien n'a été poussé).

| # | Critère | Attendu | Mesuré | Verdict | Preuve |
|---|---|---|---|---|---|
| C1 | Fabrication | Un script, tailles et durées | `fabriquer-carte.sh` : carte, relief, courbes, circuits en 2 min environ. Tailles exactes (`stat -f %z`) ci-dessous | **oui** | `zone/preuves/mesures.txt` |
| C2 | Zooms 8 à 16 sans tuile vide | Deux simulateurs | Aucune tuile vide dans la zone, du zoom 8 au zoom 16, sur Android et iOS. Hors de la zone : fond uni (voir « Bords de zone ») | **oui** | `captures/03-{android,ios}-z08…z16.png` |
| C3 | Pistes et sentiers distincts | À l'œil, légende | Piste : trait brun foncé plein. Sentier : tirets rouges. Légende à l'écran | **oui**, avec une limite (trottoirs, plus bas) | `captures/03-android-z14.png` |
| C4 | Courbes dès le zoom 13 | Visibles | Visibles au zoom 13, maîtresses (tous les 50 m) plus marquées, cote écrite | **oui** | `captures/03-*-z13.png` |
| C5 | Carte + relief + courbes ≤ 150 Mo | ≤ 150 Mo | 30 185 048 octets (28,8 Mo) | **oui** | `zone/preuves/mesures.txt` |
| C6 | Mode avion | Sans réseau | Android : vrai mode avion, et démarrage à froid en mode avion. iOS : 0 connexion hors de la machine (`nettop`, lancé avant l'app), sans vrai mode avion | Android **oui** ; iOS **partiel** | `captures/03-android-avion.png`, `app/preuves/nettop-ios.txt` |
| C7 | Circuits balisés | Dans le paquet, en couche, mesurés | 2 circuits dans la zone, 2 continus, 0 discontinu. GeoJSON (format de données géographiques) de 55 994 octets. Affichés en couche, masquables | **oui** | `zone/preuves/circuits-rapport.txt`, `captures/03-*-circuits-masques.png` |
| C8 | Attributions | « © OpenStreetMap », « © OpenMapTiles » | Affichées en permanence, plus « © Mapterhorn (relief) » | **oui** | toutes les captures |
| C9 | GitHub Actions | Estimation sourcée | Pic mémoire 2,7 Go (16 Go dispo.), disque 2,8 Go + 0,55 Go d'images (14 Go dispo.), 2,1 min sur le Mac (limite : 6 h) | **faisable (estimé)** | `zone/preuves/mesures-paquet.txt` |

## Étape 1 — Fabrication de la carte (T1)

Commande : `essais/03-carte-hors-ligne/zone/fabriquer-carte.sh`. Zone de
l'essai 1 (longitudes 5.84 à 6.52, latitudes 48.47 à 48.92), extrait
OpenStreetMap (OSM) Lorraine du 18 octobre 2026.

| Fichier | Contenu | Outil | Taille (octets) | Durée |
|---|---|---|---|---|
| `carte.pmtiles` | Carte vectorielle, schéma OpenMapTiles, zooms 0 à 14, 1 405 tuiles | Planetiler 0.10.2 (Docker), `-Xmx4g` | 17 599 345 (16,8 Mo) | 61,6 s |
| `relief.pmtiles` | Altitudes Mapterhorn (encodage « terrarium », WebP 512 px), zooms 0 à 12, 109 tuiles | `pmtiles extract` (go-pmtiles 1.31.2) | 8 775 665 (8,4 Mo) | 3,8 s |
| `courbes.pmtiles` | Courbes tous les 10 m, attribut `major` tous les 50 m, zooms 11 à 14 | GDAL 3.10.3 (Docker) puis tippecanoe 2.79.0 | 3 810 038 (3,6 Mo) | 5,7 s |
| `circuits.geojson` | Relations `route=mtb` | `extraire-circuits.py` + osmium | 55 994 (0,1 Mo) | 14,8 s |
| **Carte + relief + courbes** | | | **30 185 048 (28,8 Mo)** | |

Instrument : `stat -f %z`, vérifié par le testeur (valeurs identiques).
Le testeur a aussi décodé des tuiles : pistes et sentiers présents au
zoom 14, cotes des courbes toutes multiples de 10, `major` cohérent.

Points à retenir :
- **Annexes de Planetiler : 1,38 Go à télécharger**, même pour une zone
  sans mer : polygones d'eau (888 Mo), Natural Earth (414 Mo), lignes
  centrales des lacs (77 Mo). Sans eux, Planetiler s'arrête ; aucune option
  documentée ne permet de s'en passer. Téléchargés une fois, puis réutilisés.
- **Relief plus fin, à décider plus tard** : ajouter le zoom 13 coûte
  +19 Mo (total 48 Mo) ; les zooms 13 et 14, +95 Mo (total 124 Mo, peu de
  marge) ; jusqu'au zoom 15, +387 Mo. Gardé : zoom 12, agrandi au-delà.
- **Courbes** : faites à partir des fichiers HGT (grille d'altitudes) de
  l'essai 1 (SRTM, mesure radar de la NASA, maille de 30 m), sans lissage.
  Elles sont anguleuses de près. Les données de Mapterhorn pour cette zone
  viennent de l'IGN (Institut national de l'information géographique), au
  mètre près : des courbes plus fines sont possibles, non essayées.

## Étape 2 — Circuits VTT balisés

| Mesure | Zone de Nancy | Toute la Lorraine (information) |
|---|---|---|
| Circuits `route=mtb` | 2 | 314 |
| Continus (un seul morceau) | 2 | 282 |
| Discontinus | 0 | 32 |
| Écart max > 100 m entre morceaux | 0 | 14 (dont 1 sans voisin à moins de 50 km) |
| Taille du GeoJSON | 55 994 octets | non mesurée |

- 11656724 (sans nom, c'est R1 de l'essai 1) : 22 455 m, 1 morceau.
- 15712020 « Petite Suisse Lorraine à VTT » : 35 043 m, 1 morceau.
- Un **morceau** est un groupe de voies reliées par des nœuds communs.
- **Les « sauts » de R1 ne sont pas des trous.** R1 est d'un seul morceau
  (100 voies), confirmé par le testeur par un calcul indépendant. Ses
  sauts viennent de **l'ordre des voies** dans la relation : une trace
  construite en suivant cet ordre saute d'un bout à l'autre. Conséquence
  pour la fonction 9 : pour faire un itinéraire d'un circuit, il faudra
  remettre ses voies en ordre (parcours du graphe), pas les lire dans
  l'ordre de la relation.
- La zone de Nancy est **pauvre** : 2 circuits sur les 314 de la Lorraine.
  Un circuit sur dix de la Lorraine est discontinu : l'app devra le gérer.
- 98 circuits de Lorraine sont aussi des sous-parties d'un autre circuit
  (comptés deux fois dans le décompte Lorraine).
- Test du calcul des morceaux sur un cas fabriqué, avec un écart de
  référence calculé à part : 6 tests sur 6 réussis
  (`zone/tests/test_circuits.py`).

## Étape 3 — Affichage dans MapLibre (T2)

- App Expo SDK 58, React Native 0.88, `@maplibre/maplibre-react-native`
  11.5.0, identifiant `fr.vttnav.essai3`. Émulateur Android
  `Pixel_6_API_34_arm64_e3`, simulateur « iPhone 17 Pro » (iOS 26.5),
  Metro sur le port 8082.
- Sources du style : `pmtiles://file://…` pour la carte, le relief et les
  courbes ; GeoJSON local pour les circuits ; polices (glyphes) Noto Sans en
  fichiers locaux (licence OFL, 736 Ko). **Aucune URL réseau** dans le
  style.
- **Lecture d'un PMTiles local : marche du premier coup** sur les deux
  plateformes. Aucun repli (serveur local, MBTiles) n'a servi. C'était le
  risque principal de l'ADR 0004.
- Journal : aucune erreur MapLibre (tuile ou glyphe) sur Android ni iOS.
  Seul avertissement iOS : une fonction iOS dépréciée, sans effet.
- Taille de l'app, pour information : APK (fichier d'installation Android)
  debug arm64 de 64 765 569 octets ; `.app` iOS debug d'environ 112 Mo.
  Builds de développement, non comparables à une version publiée.

### Mode avion

- Android : `airplane_mode_on` = 1, icône visible. Le testeur a aussi
  relancé l'app à froid en mode avion, puis s'est déplacé vers le nord de la
  zone jamais affiché avant : carte complète, courbes visibles
  (`app/preuves/testeur/01` et `03`).
- iOS : le simulateur partage le réseau du Mac, pas de vrai mode avion.
  `nettop` (mesure du trafic par processus), lancé 3 s avant l'app :
  0 connexion hors de la machine. Seul Metro (local) est vu.

### Défaut trouvé et corrigé : une requête réseau au démarrage sur iOS

À la création de la vue, MapLibre iOS charge d'abord son style par défaut
`https://demotiles.maplibre.org/style.json`, avant notre style. Aucune
option JavaScript ne l'évite dans la version 11.5.0. Corrigé pour l'essai
par un patch du code natif (`app/patches/`) : la vue démarre sur un style
vide local. **Pour l'app réelle** : il faudra garder ce correctif proprement
(patch-package ou correction proposée à MapLibre). Android n'a pas ce
défaut.

### Bords de zone

Aux petits zooms (8, 10), la carte montre un peu plus que la zone : les
tuiles débordent du rectangle. Au zoom 14, au-delà du bord, il ne reste que
le relief. C'est vérifié dans le fichier : au zoom 14, la colonne de tuiles
8488 (bord est, 6,52°) existe, les colonnes 8489 et 8491 sont vides. Ce n'est
pas un trou dans la zone. **Pour l'app réelle** : limiter le déplacement de
la carte aux bords de la zone, ou montrer ces bords.

### Limites de style, pour la phase de design

- Le schéma OpenMapTiles range les trottoirs (`footway`) dans la classe
  `path`, avec les sentiers. Les villages sont donc pleins de tirets rouges.
  Il faudra filtrer par sous-classe (`subclass`).
- Au zoom 16, les courbes sont très fines. Le relief, agrandi depuis le
  zoom 12, montre une légère couture entre tuiles sur iOS.

## Étape 4 — GitHub Actions (T3)

Fabrication complète d'un paquet (calcul Valhalla, altitude, carte, relief,
courbes, circuits) par `zone/fabriquer-paquet.sh`, mesurée sur le Mac
(arm64, 10 cœurs) :

| Ressource | Mesuré sur le Mac | Limite d'une machine gratuite | Marge |
|---|---|---|---|
| Mémoire, pic | 2 391 Mo (Planetiler, `-Xmx4g`) ; 2 704 Mo (osmium, découpe) ; 1 588 Mo (Python, circuits) | 16 Go [1] | × 6 |
| Disque, pic | 2 767 Mo (dossier de travail) + 548 Mo (images Docker) | 14 Go de SSD [1] | × 4 |
| Durée | 126 s (2,1 min), un peu surestimée (+13 % selon le relecteur) | 6 h par tâche [2] | très large |
| Téléchargement | 1 582 Mo de données (dont 1 380 Mo d'annexes Planetiler) + images Docker | non limité | — |
| Processeurs | Planetiler et Valhalla prennent tous les cœurs (10 ici) | 4 [1] | durée plus longue |
| Coût | — | gratuit pour un dépôt public, machines standard [3] | 0 € |
| Paquet à publier | 28,8 Mo (carte) + 76,8 Mo (calcul et altitude) | 2 Gio par fichier de release (ADR 0003) ; « artifacts » 500 Mo [2] | large |

Estimation : sur 4 cœurs et avec un réseau plus lent, la durée serait
peut-être de 5 à 15 minutes. C'est une supposition, non mesurée. Le
workflow prévoit une limite de 60 minutes. Les annexes de Planetiler (1,4 Go)
pourraient être gardées en cache d'une fois sur l'autre (10 Go de cache par
dépôt [2]).

**Conclusion** : une machine gratuite d'Actions suffit largement pour une
zone de 50 × 50 km. Ce qui reste à prouver : un vrai lancement sur GitHub.

Fichiers :
- `essais/03-carte-hors-ligne/actions/fabriquer-zone.yml` : workflow
  (description d'une tâche automatique) à lancement manuel seulement,
  `ubuntu-24.04` (et non `ubuntu-latest`, pour garder les versions
  d'outils épinglées d'Ubuntu 24.04), publication par `gh release`.
  **Inactif** : rangé hors de `.github/workflows/`, jamais poussé ni lancé.
- `essais/03-carte-hors-ligne/actions/LISEZMOI.md` : comment l'activer.

Limites connues :
- Les scripts ne savent fabriquer que la zone de Nancy. Les tuiles
  d'altitude et l'extrait Lorraine y sont écrits en dur. Une autre zone
  demande d'abord de les rendre variables.
- La partie Linux des scripts (`stat -c`, `time -v`) n'a jamais tourné.
  Les versions Ubuntu d'osmium (1.16.0) et de tippecanoe (2.49.0) sont plus
  anciennes que celles du Mac.
- Mesures imparfaites, notées par le relecteur : mémoire des conteneurs très
  courts non captée, journaux bruts de `time` non gardés, altitude
  téléchargée deux fois (+15 Mo).

Sources (relevées le 20 octobre 2026) :
1. https://docs.github.com/en/actions/reference/runners/github-hosted-runners
2. https://docs.github.com/en/actions/reference/limits
3. https://docs.github.com/en/billing/concepts/product-billing/github-actions

## Attributions

- Affiché sur la carte : « © OpenStreetMap © OpenMapTiles © Mapterhorn
  (relief) ».
- Les données de relief de Mapterhorn sur la zone viennent de l'IGN (MNT
  LiDAR HD, RGE ALTI, Licence Ouverte 2.0) et de Copernicus GLO-30.
  Cette liste est déduite des tuiles de couverture de Mapterhorn : ce n'est
  pas une source officielle. Faut-il nommer l'IGN sur la carte ? **À
  trancher** avant l'app réelle (lire les licences).
- Polices Noto Sans : licence OFL 1.1. Son texte devra accompagner l'app.

## Ce qui n'est pas vérifié

- iOS en vrai mode avion (impossible sur le simulateur).
- Un vrai lancement du workflow sur GitHub, et donc la partie Linux des
  scripts.
- Les builds « release » de l'app (seules les builds de développement ont
  été faites).
- Le rendu sur un vrai téléphone (lisibilité au soleil, fluidité).
- Le relief au-delà du zoom 13 et des courbes plus fines (IGN), non
  essayés.

## Outils installés pendant l'essai

- Homebrew : `pmtiles` 1.31.2, `tippecanoe` 2.79.0.
- Images Docker : `ghcr.io/onthegomap/planetiler:0.10.2`,
  `ghcr.io/osgeo/gdal:alpine-small-3.10.3`.
- Android : AVD `Pixel_6_API_34_arm64_e3` (à supprimer quand l'essai est
  clos).
- Déjà présents : osmium 1.19.1, Docker 29.4.1, image Valhalla 3.9.1.
