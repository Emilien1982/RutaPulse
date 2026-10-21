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

Règle : un gros fichier déjà présent dans le dossier de cache n'est jamais
retéléchargé. Le cache contient :

- l'extrait OSM, nommé comme son adresse (`lorraine-261018.osm.pbf`) ;
- les annexes de Planetiler (`planetiler/sources/`, 1,4 Go) ;
- les tuiles d'altitude (`elevation/N48/N48E005.hgt`…), rangées après le
  premier calcul.

Le reste est refait à chaque fois, dans `work/<id>/`. Pour forcer un
nouveau téléchargement, supprimer le fichier du cache.

## Ajouter une zone

Ajouter un bloc dans `zones.json`, sans écrire de code :

```json
{
  "id": "metz",
  "name": "Metz",
  "bbox": { "lonMin": 6.0, "latMin": 48.9, "lonMax": 6.4, "latMax": 49.3 },
  "osmExtractUrl": "https://download.geofabrik.de/europe/france/lorraine-latest.osm.pbf"
}
```

- `id` : minuscules, chiffres et tirets, 2 à 40 caractères. Il ne change
  jamais.
- `bbox` : limites en degrés. Chaque côté mesure 1° au plus.
- `osmExtractUrl` : le plus petit extrait Geofabrik qui contient toute la
  zone. Le script s'arrête si la zone dépasse l'extrait.
- Le fichier est contrôlé par `schemas/zones.schema.json` et par le code.

Une adresse `…-latest.osm.pbf` donne les données du jour. Une adresse datée
(`lorraine-261018.osm.pbf`) fige les données. Voir l'ADR 0003, « Risque C7 ».

## Tests

```
.venv/bin/python -m pytest
```

Ils ne demandent ni réseau ni Docker.
