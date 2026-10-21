# ADR 0003 — Préparer les zones sur l'ordinateur et les héberger sur GitHub Releases

- Statut : Accepté le 2026-10-19
- Date : 2026-10-19
- Complété le 2026-10-21 : section « Format du paquet et du catalogue »,
  proposée, à valider par Émilien
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

## Résultat des essais 1 et 3 (2026-10-20)

- Paquet complet de la zone de Nancy : environ 106 Mo (calcul et altitude
  77 Mo, carte, relief et courbes 29 Mo, circuits 56 Ko). Fabrication :
  environ 2 minutes sur le Mac, avec 2,7 Go de mémoire au plus.
- **Circuits VTT balisés** (relations `route=mtb`) : extraits en GeoJSON
  dans le paquet. Il n'y en a que 2 dans la zone de Nancy, contre 314 dans
  toute la Lorraine : l'intérêt de la fonction 9 dépend de la zone.
- **GitHub Actions** : jugé faisable sur une machine gratuite (mesures très
  en dessous des limites). Workflow écrit mais inactif, dans
  `essais/03-carte-hors-ligne/actions/`. Pas encore prouvé par un vrai
  lancement.
- Planetiler télécharge 1,38 Go d'annexes (eau, Natural Earth) une seule
  fois, même pour une zone sans mer.

## Format du paquet et du catalogue (2026-10-21, phase 1)

- Statut : proposé le 2026-10-21 (tâche T1 de
  [p01-fabrique-zones](../phases/p01-fabrique-zones.md)), à valider par
  Émilien.
- Ce qui change par rapport au 19 octobre :
  - les paquets sont fabriqués par **GitHub Actions** (l'option à étudier
    devient la règle). Le Mac sert à vérifier le script ;
  - la table « identifiant de voie → difficulté VTT » (point 5) n'est pas
    dans le format 1. Elle sera un fichier de plus quand une phase en aura
    besoin (difficulté VTT : phase 5) ;
  - les circuits VTT balisés entrent dans le paquet (essai 3).
- Le code de la fabrique (langage, dossier `zones/`, tests) : ADR 0012.

### 1. Les fichiers d'un paquet

Une zone publiée = une release. Chaque fichier du paquet est **un fichier
séparé de la release**. Il n'y a pas d'archive qui les regroupe.

| Fichier de la release | Rangé sur le téléphone sous | Contenu | Fabriqué par | Nancy (essais), octets |
|---|---|---|---|---|
| `valhalla_tiles.tar` | `valhalla_tiles.tar` | Tuiles de calcul. Valhalla lit l'archive telle quelle, sans la décompresser | Valhalla | 28 692 480 |
| `N48E005.hgt`, `N48E006.hgt`… (une par carré de 1° touché par la zone) | `elevation/N48/N48E005.hgt`… | Altitude, format HGT non compressé | Valhalla (`valhalla_build_elevation`) | 2 × 25 934 402 |
| `map.pmtiles` | `map.pmtiles` | Carte, schéma OpenMapTiles, zooms 0 à 14 | Planetiler | 17 599 345 |
| `terrain.pmtiles` | `terrain.pmtiles` | Relief Mapterhorn, encodage « terrarium » (altitude codée dans la couleur), images WebP (format d'image compressée) de 512 px, zooms 0 à 12 | pmtiles | 8 775 665 |
| `contours.pmtiles` | `contours.pmtiles` | Courbes tous les 10 m, couche `contour`, attributs `ele` et `major` (1 tous les 50 m), zooms 11 à 14 | GDAL puis tippecanoe | 3 810 038 |
| `trails.geojson` | `trails.geojson` | Circuits VTT balisés (relations `route=mtb`), en GeoJSON (format de données géographiques) | le script, avec osmium | 55 994 |
| `zone.json` | `zone.json` | Description de la zone (§ 2) | le script | environ 1 000 |
| `LICENCES.md` | `LICENCES.md` | Mentions de licence (§ 7) | le script, d'après un modèle fixe | environ 3 000 |
| `SHA256SUMS` | non téléchargé par l'app | Empreintes SHA-256 (sommes de contrôle qui prouvent qu'un fichier n'est pas abîmé) de tous les autres fichiers | le script | moins de 1 000 |

Total pour Nancy : environ 106 Mo.

Règles :
- **Noms en anglais**, car le code de l'app les utilise (ADR 0011). Les noms
  des essais (`carte`, `relief`, `courbes`, `circuits`) sont abandonnés.
  Vocabulaire ajouté : circuit balisé = `trail`. Deux exceptions :
  `LICENCES.md`, lu par des humains, et `SHA256SUMS`, nom habituel de ce
  fichier.
- **Une release n'a pas de dossiers** : les fichiers HGT y sont publiés à
  plat. Valhalla, lui, exige le sous-dossier (`elevation/N48/`). Le
  catalogue donne donc, pour chaque fichier, son chemin de rangement
  (`path`). L'app n'a aucune règle de nommage à connaître.
- Le dossier de sortie du script contient **exactement** les fichiers de la
  release, à plat. On publie ce dossier tel quel.
- **HGT non compressés**, comme dans les essais, où ils sont prouvés sur les
  deux simulateurs. Les `.hgt.gz` pèseraient 15,3 Mo au lieu de 49,5 Mo,
  mais leur lecture par valhalla-mobile n'est pas éprouvée. Plus tard, avec
  un essai.
- **`SHA256SUMS`** : format de la commande `sha256sum`, une ligne
  `<empreinte>  <nom>` par fichier de la release sauf lui-même, noms à plat,
  triés par ordre alphabétique. Dans un dossier où l'on a téléchargé la
  release, `sha256sum -c SHA256SUMS` (sur le Mac :
  `shasum -a 256 -c SHA256SUMS`) contrôle tout (C3, C6).

Pourquoi un fichier par élément plutôt qu'une archive :
- l'app vérifie chaque fichier dès qu'il arrive. Elle ne retélécharge que
  celui qui est abîmé ;
- rien à décompresser sur le téléphone : ni bibliothèque en plus, ni place
  occupée deux fois pendant l'extraction ;
- chaque fichier reste très loin de la limite de 2 Gio : le plus gros pèse
  27,4 Mo pour Nancy, et une zone fait au plus 1° de côté (§ 5) ;
- `valhalla_tiles.tar` est déjà une archive que Valhalla lit sur place.

### 2. La description de la zone : `zone.json`

```json
{
  "formatVersion": 1,
  "id": "nancy",
  "name": "Nancy",
  "version": 1,
  "bbox": { "lonMin": 5.84, "latMin": 48.47, "lonMax": 6.52, "latMax": 48.92 },
  "osmDate": "2026-10-18T20:25:06Z",
  "builtAt": "2026-10-22T09:12:31Z",
  "tools": {
    "valhalla": "3.9.1",
    "planetiler": "0.10.2",
    "gdal": "3.10.3",
    "tippecanoe": "2.49.0",
    "pmtiles": "1.31.2",
    "osmium": "1.16.0"
  }
}
```

- `bbox` (boîte englobante) : les limites de la zone, en degrés.
- `osmDate` : date des données, lue dans l'en-tête de l'extrait OSM
  (`osmosis_replication_timestamp`), en temps universel (UTC). Si l'en-tête
  ne la donne pas, la fabrication s'arrête. Les essais écrivaient
  « unknown » : ce n'est plus permis.
- `builtAt` : date de fabrication. `tools` : versions lues sur les outils
  pendant la fabrication.
- Pas de liste de fichiers ni d'empreintes : elles sont dans le catalogue
  et dans `SHA256SUMS`. Un fichier ne peut pas contenir sa propre empreinte.
- Le téléphone garde ce fichier : il sait ainsi, sans réseau, quelle
  version de quelle zone il a.

### 3. Releases, étiquettes et versions

- **Étiquette** (tag, le nom git d'une release) d'une zone :
  `zone-<id>-v<version>`. Exemple : `zone-nancy-v1`. Titre de la release :
  `Zone Nancy (v1)`.
- **`version`** : un entier, 1 à la première publication. Une nouvelle
  publication prend le plus grand numéro des étiquettes
  `zone-<id>-v<nombre>` déjà présentes sur GitHub, plus 1. La comparaison
  est exacte : `zone-nancy-est-v9` ne compte pas pour la zone `nancy`.
- On compte les étiquettes, pas le catalogue : une publication ratée à
  mi-chemin ne bloque pas la suivante. Un numéro peut donc manquer dans le
  catalogue. C'est sans effet.
- Une release de zone **n'est jamais modifiée** après sa publication.
  Nouvelles données, nouvel outil ou correction : nouvelle version.
- Les anciennes releases restent (coût nul). Le catalogue ne pointe que vers
  la dernière.
- **`formatVersion`** (dans `zone.json` et `catalogue.json`) vaut 1. Il
  augmente seulement si une app déjà installée ne peut plus lire le paquet :
  fichier renommé ou retiré, champ dont le sens change. Ajouter un fichier
  ou un champ facultatif ne le change pas. L'app doit donc ignorer les
  champs qu'elle ne connaît pas.

### 4. Le catalogue

**Où il vit.** Dans une release fixe, d'étiquette `catalogue`, qui contient
un seul fichier : `catalogue.json`. Le workflow (tâche automatique de GitHub
Actions) le remplace à chaque publication
(`gh release upload catalogue catalogue.json --clobber`). Le premier
lancement crée cette release avec un catalogue vide.

**Adresse stable, écrite dans l'app :**
`https://github.com/Emilien1982/RutaPulse/releases/download/catalogue/catalogue.json`.
GitHub peut répondre par une redirection (code 302) vers son serveur de
fichiers : l'app doit la suivre (`fetch` le fait seul). L'adresse de
redirection est temporaire : pour reprendre un téléchargement, l'app repart
toujours de l'adresse `github.com`.

**Ordre de publication**, pour que l'app ne voie qu'une zone complète :
1. créer la release de la zone avec tous ses fichiers ;
2. retélécharger chaque fichier publié et contrôler sa taille et son
   empreinte ;
3. seulement alors, remplacer `catalogue.json`.

Deux lancements du workflow ne modifient jamais le catalogue en même temps
(réglage `concurrency` de GitHub Actions sur un groupe fixe). Sinon, une
mise à jour pourrait en effacer une autre.

**Contenu** (exemple abrégé, empreintes remplacées par `…`) :

```json
{
  "formatVersion": 1,
  "zones": [
    {
      "id": "nancy",
      "name": "Nancy",
      "version": 1,
      "bbox": { "lonMin": 5.84, "latMin": 48.47, "lonMax": 6.52, "latMax": 48.92 },
      "osmDate": "2026-10-18T20:25:06Z",
      "totalBytes": 110806326,
      "files": [
        {
          "path": "LICENCES.md",
          "bytes": 3000,
          "sha256": "…",
          "url": "https://github.com/Emilien1982/RutaPulse/releases/download/zone-nancy-v1/LICENCES.md"
        },
        {
          "path": "elevation/N48/N48E005.hgt",
          "bytes": 25934402,
          "sha256": "…",
          "url": "https://github.com/Emilien1982/RutaPulse/releases/download/zone-nancy-v1/N48E005.hgt"
        }
      ]
    }
  ]
}
```

| Champ | Type | Règle |
|---|---|---|
| `formatVersion` | entier | vaut 1 |
| `zones` | liste | peut être vide |
| `zones[].id` | texte | `^[a-z0-9]+(-[a-z0-9]+)*$`, 2 à 40 caractères |
| `zones[].name` | texte | 1 à 60 caractères |
| `zones[].version` | entier | 1 ou plus |
| `zones[].bbox` | objet | 4 nombres `lonMin`, `latMin`, `lonMax`, `latMax` ; longitudes de −180 à 180, latitudes de −90 à 90 |
| `zones[].osmDate` | texte | `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$` |
| `zones[].totalBytes` | entier | 1 ou plus |
| `zones[].files` | liste | au moins 1 élément |
| `files[].path` | texte | `^[A-Za-z0-9][A-Za-z0-9._-]*(/[A-Za-z0-9][A-Za-z0-9._-]*)*$` : ni `..`, ni `/` au début, car l'app écrit à cet endroit |
| `files[].bytes` | entier | 1 ou plus |
| `files[].sha256` | texte | `^[0-9a-f]{64}$` |
| `files[].url` | texte | commence par `https://` |

- Tous les champs sont obligatoires. Aucun autre champ n'est permis
  (`additionalProperties: false`) : le schéma contrôle ce que **nous**
  produisons, et refuse une faute de frappe. L'app, elle, ignore un champ
  inconnu (§ 3).
- Règles qu'un schéma ne sait pas exprimer, contrôlées par le code et par
  les tests :
  - `id` unique ; zones triées par `id`, fichiers triés par `path` (le
    fichier change peu d'une version à l'autre, les différences se lisent) ;
  - `lonMin < lonMax` et `latMin < latMax` ;
  - `totalBytes` = somme des `bytes` ;
  - les fichiers obligatoires sont tous là : `valhalla_tiles.tar`,
    `map.pmtiles`, `terrain.pmtiles`, `contours.pmtiles`, `trails.geojson`,
    `zone.json`, `LICENCES.md`, et au moins un `elevation/…/….hgt` ;
  - `url` finit par `/releases/download/zone-<id>-v<version>/<nom>`, où
    `<nom>` est le dernier morceau de `path`.
- Le catalogue ne contient pas `SHA256SUMS` : il porte déjà les empreintes.

### 5. La liste des zones : `zones/zones.json`

C'est le seul fichier à modifier pour ajouter une zone (C2).

```json
{
  "zones": [
    {
      "id": "nancy",
      "name": "Nancy",
      "bbox": { "lonMin": 5.84, "latMin": 48.47, "lonMax": 6.52, "latMax": 48.92 },
      "osmExtractUrl": "https://download.geofabrik.de/europe/france/lorraine-latest.osm.pbf"
    }
  ]
}
```

| Champ | Règle |
|---|---|
| `zones` | liste d'au moins une zone |
| `id` | même règle que dans le catalogue ; unique ; **ne change jamais** : c'est la clé de la zone dans le catalogue et le nom de son dossier sur le téléphone |
| `name` | 1 à 60 caractères ; peut changer |
| `bbox` | même règle que dans le catalogue ; en plus, chaque côté mesure **au plus 1°** (contrôlé par le code). Cela protège la machine de GitHub et la limite de 2 Gio d'une faute de frappe |
| `osmExtractUrl` | `^https://.+\.osm\.pbf$` : adresse d'un extrait OSM, en général chez Geofabrik (site qui publie chaque jour des extraits régionaux d'OSM) |

Aucun autre champ n'est permis.

- **Quel extrait ?** Le plus petit extrait Geofabrik qui contient toute la
  zone. Le script lit les limites écrites dans l'en-tête de l'extrait et
  s'arrête si la zone en dépasse. Une zone à cheval sur deux régions prend
  la région parente (par exemple la France entière).
- `…-latest.osm.pbf` donne les données du jour. Une adresse datée
  (`lorraine-261018.osm.pbf`) fige les données, mais Geofabrik ne garde un
  fichier du jour qu'environ une semaine (voir « Risque C7 »).
- **Altitude : rien à écrire.** Les tuiles HGT se déduisent des limites :
  `valhalla_build_elevation --from-bbox` les télécharge. Les courbes sont
  ensuite faites à partir de ces mêmes fichiers : un seul téléchargement, au
  lieu de deux dans l'essai 3. Les noms `N48E005` et `N48E006` des essais
  disparaissent du code.
- Le relief (Mapterhorn) et les annexes de Planetiler sont les mêmes pour
  toutes les zones : leurs adresses sont dans le code, pas dans
  `zones.json`.

### 6. Outils et versions

| Outil | Version | Sur le Mac | Sur GitHub Actions (`ubuntu-24.04`) | Remarque |
|---|---|---|---|---|
| Valhalla | 3.9.1 | image Docker (programme livré prêt à tourner dans un conteneur isolé) `ghcr.io/valhalla/valhalla:3.9.1` | même image | Même moteur que valhalla-mobile 0.6.4 (ADR 0002). Ne change pas sans l'app |
| Planetiler | 0.10.2 | image Docker `ghcr.io/onthegomap/planetiler:0.10.2` | même image | Dernière version publiée (29 mars). Une version de développement est sortie le 17 octobre : le projet est maintenu |
| GDAL (bibliothèque de traitement de données géographiques) | 3.10.3 | image Docker `ghcr.io/osgeo/gdal:alpine-small-3.10.3` | même image | Version de l'essai 3 |
| pmtiles (go-pmtiles, outil qui lit et découpe les fichiers PMTiles) | 1.31.2 | Homebrew (gestionnaire de logiciels du Mac) | binaire publié sur GitHub | Dernière version (22 juillet) |
| tippecanoe (outil qui fabrique des tuiles vectorielles) | 2.79.0 (Mac), 2.49.0 (GitHub) | Homebrew | paquet Ubuntu | Différence acceptée : elle ne touche que les courbes, pas le calcul. La version utilisée est écrite dans `zone.json` |
| osmium-tool (outil qui lit et découpe les fichiers OSM) | 1.19.1 (Mac), 1.16.0 (GitHub) | Homebrew | paquet Ubuntu | Il découpe la zone, donc il peut toucher au calcul : voir « Risque C7 » |
| Python | 3.12 ou plus | déjà installé (3.14) | `actions/setup-python` | ADR 0012 |

- La fabrication de référence, celle qu'on publie, est celle de GitHub
  Actions. Celle du Mac sert à mettre au point le script (C1).
- Les numéros exacts des paquets Ubuntu (`osmium-tool=1.16.0-1build1`,
  `tippecanoe=2.49.0-1build1`) viennent du workflow de l'essai 3, qui n'a
  jamais tourné. À confirmer au premier lancement (T4).

### 7. Paramètres figés et licences

Pour que la zone publiée calcule comme celle des essais (C7), la partie
calcul refait **exactement** les étapes de l'essai 1 :
- découpe : `osmium extract -b <limites> --strategy=smart` ;
- configuration : `valhalla_build_config` par défaut de la version 3.9.1,
  avec seulement `--mjolnir-tile-dir`, `--mjolnir-tile-extract`,
  `--mjolnir-admin` et `--additional-data-elevation` ;
- puis `valhalla_build_admins`, `valhalla_build_elevation --from-bbox
  --decompress`, `valhalla_build_tiles`, `valhalla_build_extract`. Pas de
  fuseaux horaires.

La carte reprend les réglages de l'essai 3 : Planetiler avec `-Xmx4g`, profil
OpenMapTiles par défaut ; relief extrait de
`https://download.mapterhorn.com/planet.pmtiles` ; courbes découpées 0,01°
plus large que la zone, `gdal_contour -i 10`, puis tippecanoe avec
`--drop-densest-as-needed --simplification=4`.

`LICENCES.md` vient d'un modèle fixe. Il nomme : OpenStreetMap (ODbL,
« © les contributeurs d'OpenStreetMap ») ; OpenMapTiles ; les annexes de
Planetiler (polygones d'eau issus d'OSM, Natural Earth) ; Mapterhorn et ses
sources sur la France (IGN, Licence Ouverte 2.0 ; Copernicus GLO-30), avec
le lien vers la liste complète de Mapterhorn ; le SRTM de la NASA pour
l'altitude et les courbes. L'essai 3 cherchait les sources du relief tuile
par tuile, en lisant des fichiers binaires : c'est fragile, on l'abandonne.

### 8. Les schémas

- Deux fichiers JSON Schema (description formelle d'un format JSON, version
  2020-12) : `zones/schemas/zones.schema.json` et
  `zones/schemas/catalogue.schema.json`. Le développeur les écrit en T2
  (zones) et T3 (catalogue), d'après les tableaux des §§ 4 et 5.
- Le code et les tests lisent ces fichiers. Une fois écrits, **ils font
  foi** ; cet ADR en donne le sens.
- Pourquoi pas dans `docs/` : le code ne doit pas lire la documentation, et
  une copie dans `docs/` finirait par différer de celle du code.
- `zone.json` n'a pas de schéma : il est produit et lu par notre code, et
  ses champs sont vérifiés par les tests.

### Risque C7 : la date de l'extrait OSM

**Question à trancher par Émilien** : elle touche à ce que la spec promet.

C7 promet « mêmes calculs d'itinéraire que les essais sur les 5
références ». Ce que je constate :
- L'essai 1 a utilisé l'extrait Lorraine du 18 octobre 2026, 20 h 25 UTC,
  téléchargé sous le nom `lorraine-latest.osm.pbf`. Avec `-latest`, la zone
  publiée aura des données plus récentes. Une seule voie modifiée près
  d'une référence peut changer un itinéraire.
- Geofabrik garde aujourd'hui `lorraine-261018.osm.pbf` (163 Mo, empreinte
  MD5, un type d'empreinte plus ancien, publiée :
  `96a475c7406fba7937077df7914b45aa`). Le 21 octobre, le
  serveur garde les fichiers du 14 au 20 octobre, le 1er de chaque mois
  récent et le 1er janvier de chaque année. Le fichier du 18 risque donc de
  disparaître vers le 25 octobre. Geofabrik ne publie pas de règle de
  conservation : c'est un constat.
- Les réponses brutes de Valhalla des essais ne sont pas dans git (fichiers
  ignorés), et je ne les ai pas trouvées. La référence de comparaison est
  donc `essais/01-calcul-hors-ligne/analyse/resultats/ios/tableau.md` :
  distance au 10 m près et D+ au mètre près, réglage A (`use_roads: 0`).
- Même avec le même extrait, deux différences restent : osmium 1.16.0 sur
  GitHub contre 1.19.1 sur le Mac (découpe), et un processeur x86-64 (famille
  Intel et AMD) sur GitHub contre ARM (famille des puces Apple) pour tous
  les essais (fabrication des tuiles).

Choix possibles :
- **A (recommandé) : figer l'extrait du 18 octobre pour la version 1 de
  Nancy.** `zones.json` donne l'adresse datée. C7 garde sa promesse. Pour ne
  pas dépendre de la date de disparition, copier ce fichier tout de suite
  dans une release du dépôt (`osm-lorraine-261018`), après contrôle de son
  MD5. L'ODbL permet de le redistribuer, avec l'attribution. Ensuite, passer
  Nancy à `-latest` pour les versions suivantes : une ligne à changer.
- **B : prendre `-latest` et changer C7.** On prouverait (1) que deux
  fabrications du même extrait donnent les mêmes itinéraires, et (2) que
  l'écart avec l'essai reste sous une tolérance, par exemple ± 2 % sur la
  distance et ± 5 % sur le D+. Ces seuils seraient arbitraires.

Dans les deux cas, un essai jetable de quelques minutes sur le Mac, avant
T4, dira si l'identité est possible (voir ADR 0012, « Essais jetables »).
S'il montre des écarts dus au processeur ou à osmium, A ne suffira pas :
il faudra aussi une tolérance.

### Alternatives rejetées (format)

- **Une archive par zone (zip ou tar)** : un seul téléchargement, mais il
  faut une bibliothèque de décompression sur le téléphone, deux fois la
  place pendant l'extraction, et tout retélécharger si un octet est abîmé.
- **Deux archives (calcul et carte)** : mêmes défauts. Les fichiers séparés
  permettent déjà de ne télécharger qu'une partie.
- **Catalogue rangé dans le dépôt git**, lu par
  `raw.githubusercontent.com` : le workflow devrait pousser des commits sur
  `main`, et ce serveur garde ses fichiers en cache (copie temporaire)
  quelques minutes.
- **Catalogue reconstruit par l'app avec l'API de GitHub** (liste des
  releases) : 60 requêtes par heure sans compte, et l'app devrait assembler
  elle-même les informations de chaque zone.
- **GitHub Pages** (pages web servies par GitHub) : un service de plus à
  régler, pour un seul fichier.
- **Version = date** (`zone-nancy-20261022`, comme dans l'essai 3) : deux
  publications le même jour auraient la même étiquette. Un entier se compare
  plus simplement dans l'app.
- **Liste fermée des zones dans le workflow** (menu de choix) : elle
  doublerait `zones.json`, et ajouter une zone obligerait à modifier le
  workflow. Le workflow demande l'`id` en texte, et le script le refuse
  s'il n'est pas dans `zones.json`.

### Conséquences (format)

- Positif : l'app suit une règle simple : lire le catalogue, télécharger
  chaque fichier, contrôler taille et empreinte, le ranger sous `path`.
- Positif : `sha256sum -c SHA256SUMS` contrôle une release sans notre code.
- Négatif : une zone demande une dizaine de téléchargements. La phase 2
  doit gérer une file de téléchargements et leur reprise.
- Négatif : il y a une très courte fenêtre où l'ancien `catalogue.json` est
  retiré et le nouveau pas encore en place. L'app doit réessayer après un
  échec.
- À ne pas faire : activer « release immutability » (releases non
  modifiables, réglage du dépôt). D'après la documentation de GitHub, ce
  réglage protège les releases publiées contre les changements. Le
  catalogue ne pourrait sans doute plus être remplacé. Non éprouvé.
- À éprouver en phase 2 : le téléchargement de 106 Mo en une dizaine de
  fichiers depuis GitHub sur le téléphone, avec reprise après coupure.

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

Ajoutées le 2026-10-21 (section « Format du paquet et du catalogue »,
relevées ce jour) :
- Limites des releases (1 000 fichiers, 2 Gio par fichier, pas de limite de
  bande passante) : https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- Téléchargement d'un fichier de release (réponse 200 ou redirection 302) :
  https://docs.github.com/en/rest/releases/assets
- Releases non modifiables : https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes
- Extraits datés de Geofabrik (liste du 21 octobre 2026) : https://download.geofabrik.de/europe/france/
- Empreinte MD5 de l'extrait du 18 octobre : https://download.geofabrik.de/europe/france/lorraine-261018.osm.pbf.md5
- Conservation des fichiers Geofabrik (réponse d'un administrateur, 2025,
  pas une règle publiée) : https://community.openstreetmap.org/t/geofabrik-downloads-monthly-file-missing/136648
- Planetiler, versions : https://github.com/onthegomap/planetiler/releases
- go-pmtiles, versions : https://github.com/protomaps/go-pmtiles/releases
- tippecanoe, versions : https://github.com/felt/tippecanoe/releases
- osmium-tool, versions : https://github.com/osmcode/osmium-tool/releases
