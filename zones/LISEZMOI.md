# Fabrique de zones

Ce dossier fabrique les paquets de zone de l'app (carte, calcul d'itinéraire,
altitude hors ligne). Formats : ADR 0003. Choix du code : ADR 0012.

## Préparer

Il faut Python 3.12 ou plus, Docker (lancé), et `osmium`, `pmtiles` et
`tippecanoe` (sur le Mac : Homebrew). Depuis `zones/` :

```
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
```

## Fabriquer une zone

L'environnement `.venv` (ou `pip install -r requirements.txt`) doit exister
avant toute commande `python3 -m zonefactory`, sinon `jsonschema` manque.

```
.venv/bin/python -m zonefactory build nancy --version 1 --out out/nancy
```

- `nancy` est un `id` de `zones.json`.
- `--version` : numéro du paquet (1 à la première fois).
- `--out` : dossier de sortie, vide ou inexistant. Il reçoit exactement les
  fichiers de la release, `SHA256SUMS` compris.
- `--cache-dir` (facultatif, par défaut `work/cache/`) : voir ci-dessous.

Pour contrôler le résultat : `cd out/nancy && shasum -a 256 -c SHA256SUMS`.

### Fichiers réutilisés

Règles :

- Le **cache** (`--cache-dir`, par défaut `work/cache/`) garde les annexes de
  Planetiler (`planetiler/sources/`, 1,4 Go) et les tuiles d'altitude
  (`elevation/N48/N48E005.hgt`…). Un fichier déjà là n'est jamais
  retéléchargé. Une tuile d'altitude qui n'a pas la bonne taille
  (25 934 402 octets) est supprimée et refaite. Une zone ne prend que ses
  propres tuiles.
- L'**extrait OSM** est rangé dans `work/osm/`, hors du cache. Il n'est
  réutilisé que si son adresse est datée (`lorraine-261018.osm.pbf`). Une
  adresse `…-latest.osm.pbf` est retéléchargée à chaque fois, car son contenu
  change chaque jour.
- Le reste est refait à chaque fois, dans `work/<id>/`.
- Les conteneurs Docker tournent avec l'identifiant de l'utilisateur courant
  (`--user`), pour que les fichiers produits restent à lui sous Linux.

## Ajouter une zone

Ajouter un bloc dans `zones.json`, sans écrire de code :

```json
{
  "id": "metz",
  "name": "Metz",
  "bbox": { "lonMin": 6.0, "latMin": 48.9, "lonMax": 6.4, "latMax": 49.3 },
  "osmExtractUrl": "https://download.geofabrik.de/europe/france/lorraine-latest.osm.pbf",
  "coastal": false
}
```

- `id` : minuscules, chiffres et tirets, 2 à 40 caractères. Il ne change
  jamais.
- `bbox` : limites en degrés. Chaque côté mesure 1° au plus.
- `osmExtractUrl` : le plus petit extrait Geofabrik qui contient toute la
  zone. Le script s'arrête si la zone dépasse l'extrait.
- `coastal` : `true` si la zone touche la mer, `false` sinon. Une zone
  intérieure n'a pas besoin du fichier des mers (931 Mo) : un fichier vide le
  remplace. Une erreur sur ce champ donne une carte fausse, sans aucun
  message.
- Le fichier est contrôlé par `schemas/zones.schema.json` et par le code.

Une adresse `…-latest.osm.pbf` donne les données du jour. Une adresse datée
(`lorraine-261018.osm.pbf`) fige les données. Voir l'ADR 0003, « Risque C7 ».

## Tests

```
.venv/bin/python -m pytest
```

Ils ne demandent ni réseau ni Docker.

## Catalogue, version suivante, contrôle

Toutes ces commandes se lancent depuis `zones/`, comme `build`.

- `next-version <id>` : lit les étiquettes git (une par ligne) sur l'entrée
  standard et écrit le numéro suivant.
  `git tag --list | .venv/bin/python -m zonefactory next-version nancy`
- `catalogue --current <fichier> --package <dossier> --repo <propriétaire/dépôt> --out <fichier>` :
  ajoute ou remplace la zone du paquet dans le catalogue, puis le contrôle
  (schéma `schemas/catalogue.schema.json` et règles du code). Le fichier
  `--current` doit exister et contenir un catalogue valide : un fichier
  absent ou vide est refusé, pour qu'une faute de frappe ou un
  téléchargement raté n'efface pas les autres zones. Au premier lancement,
  créer un catalogue vide explicite :
  `echo '{"formatVersion":1,"zones":[]}' > out/vide.json`. Une version
  inférieure ou égale à celle déjà publiée est refusée. Tailles et
  empreintes sont recalculées et comparées à `SHA256SUMS` : un écart arrête
  tout, et rien n'est écrit si le résultat est invalide.
- `verify --catalogue <adresse ou fichier> --zone <id> --dest <dossier>` :
  télécharge chaque fichier de la zone, contrôle sa taille et son SHA-256,
  le range sous son `path`. Code de sortie non nul au premier fichier faux.
  Accepte aussi des adresses `file://` et un catalogue local (essais sans
  réseau).

## Publier une zone avec GitHub Actions

Le workflow `.github/workflows/fabriquer-zone.yml` (« Fabriquer une zone »)
fabrique la zone sur une machine de GitHub et la publie, sans ton Mac.

Lancer : onglet « Actions » du dépôt, « Fabriquer une zone », « Run
workflow », puis écrire l'`id` de la zone (par défaut `nancy`). Seul un
workflow déjà présent sur la branche `main` peut être lancé ainsi. C'est le
seul déclencheur : un `push` ne lance rien.

Ce que fait le workflow, dans l'ordre :

1. calcule la version (étiquettes `zone-<id>-v<n>` déjà présentes, plus 1) ;
2. fabrique le paquet (commande `build`) ;
3. crée la release `zone-<id>-v<n>` avec tous les fichiers, `SHA256SUMS`
   compris ;
4. récupère le catalogue de la release `catalogue` (la crée avec un
   catalogue vide si elle n'existe pas) et y ajoute la zone ;
5. retélécharge la release publiée et contrôle chaque fichier (`verify`) ;
6. seulement alors, remplace `catalogue.json` dans la release `catalogue`.

Le résumé du lancement donne la version, la date des données, l'adresse
datée de l'extrait OSM (à réutiliser avec `--osm-url` pour refaire la même
zone sur le Mac), son MD5, les tailles, les durées, la mémoire et le disque.
Le workflow n'utilise que le jeton automatique de GitHub : aucun secret.
Les annexes de Planetiler et les tuiles d'altitude sont gardées en cache
d'un lancement à l'autre ; l'extrait OSM ne l'est pas.

Pour ajouter une zone : ajouter son bloc dans `zones.json` (voir plus haut),
pousser sur `main`, puis lancer le workflow avec son `id`.
