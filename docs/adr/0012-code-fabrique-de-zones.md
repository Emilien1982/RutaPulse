# ADR 0012 — Code de la fabrique de zones : Python et pytest

- Statut : Proposé le 2026-10-21, à valider par Émilien
- Date : 2026-10-21 (phase 1, tâche T1 de [p01-fabrique-zones](../phases/p01-fabrique-zones.md))
- Format des paquets et du catalogue : ADR 0003, section « Format du paquet
  et du catalogue ».

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- La phase 1 demande un script unique qui fabrique un paquet de zone, lit
  `zones/zones.json`, calcule les empreintes et produit `catalogue.json`
  (C1 à C4). Ce script doit être testé par la CI (vérification automatique
  sur GitHub), avec le nombre de tests (C9).
- Les scripts des essais 1 et 3 mélangent bash (langage de commandes du
  terminal) pour enchaîner les outils, et Python pour le JSON et les
  circuits. Ils doublent leur code pour le Mac et pour Linux (`stat -f` ou
  `stat -c`), et seul le calcul des circuits est testé (6 tests, `unittest`).
- L'ADR 0011 range la fabrique dans `zones/`. Elle ne partage aucun code
  avec l'app. Il n'y a qu'un `package.json`, dans `mobile/`.
- Le schéma qui valide `zones.json` et `catalogue.json` doit être un fichier
  lu par le code (ADR 0003, § 8).

## Décision

### 1. Langage

- **Python 3.12 ou plus, seul.** Plus de bash. Les outils externes
  (`docker`, `osmium`, `pmtiles`, `tippecanoe`) sont appelés par
  `subprocess.run` avec une liste d'arguments, sans passer par un shell.
- Bibliothèque standard, plus une seule dépendance : **jsonschema 4.26.0**
  (publiée le 7 janvier 2026 ; Python 3.10 à 3.14 ; gère JSON Schema
  2020-12). Elle lit les fichiers de schéma.
- Tailles exactes : `os.path.getsize`, identique sur Mac et Linux.

### 2. Tests

- **pytest 9.1.1** (outil de test de Python, publié le 19 juin 2026 ;
  Python 3.10 ou plus).
- Les tests ne demandent **ni réseau ni Docker**. Ils testent les fonctions
  pures. La fabrication complète est prouvée à la main sur le Mac (C1) et
  par le workflow sur GitHub (C5).
- Ce qui doit être testé, au minimum :

| Sujet | Cas |
|---|---|
| Lecture de `zones.json` | un fichier valide ; refus d'un champ manquant, d'un champ inconnu, d'un `id` invalide, d'un `id` en double, de `lonMin ≥ lonMax`, d'un côté de plus de 1°, d'une adresse qui ne finit pas par `.osm.pbf` ; refus d'un `id` demandé absent du fichier |
| Empreintes | SHA-256 de `abc` = `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` (valeur de référence externe, norme FIPS 180-2) ; format et tri de `SHA256SUMS` |
| Chemin de rangement | `N48E005.hgt` → `elevation/N48/N48E005.hgt` ; `S01W070.hgt` → `elevation/S01/S01W070.hgt` ; `map.pmtiles` → `map.pmtiles` |
| Version suivante | aucune étiquette → 1 ; `zone-nancy-v1` et `zone-nancy-v3` → 4 ; `zone-nancy-est-v9` ne compte pas pour `nancy` |
| Catalogue | ajout d'une zone ; remplacement d'une version ; tri ; `totalBytes` ; fichiers obligatoires ; forme des adresses ; validation par le schéma ; refus d'une empreinte trop courte et d'un `path` avec `..` |
| Circuits balisés | les 6 cas de `essais/03-carte-hors-ligne/zone/tests/test_circuits.py`, repris sur un texte au format OPL (format texte d'osmium) écrit dans le test, sans lancer osmium |

- Le test est à côté du sujet : un fichier `tests/test_<sujet>.py` par
  module.

### 3. Dossier `zones/`

```
zones/
├── LISEZMOI.md              lancer le script, ajouter une zone (en français)
├── zones.json               la liste des zones : seul fichier à modifier pour ajouter une zone
├── schemas/
│   ├── zones.schema.json
│   └── catalogue.schema.json
├── templates/
│   └── LICENCES.md          modèle copié dans chaque paquet
├── zonefactory/             le script (un paquet Python)
│   ├── __init__.py
│   ├── __main__.py          les commandes (ci-dessous)
│   └── <un module par sujet> config, build, trails, checksums, catalogue… (au choix du développeur)
├── tests/
│   ├── fixtures/            petits fichiers d'essai (zones.json valides et invalides…)
│   └── test_*.py
├── requirements.txt         jsonschema==4.26.0
└── requirements-dev.txt     -r requirements.txt, pytest==9.1.1
```

Ignorés par git : `zones/work/` (fichiers de travail), `zones/out/`
(paquets fabriqués), `zones/.venv/` (environnement Python local).

### 4. Commandes

Toutes se lancent depuis `zones/`, avec `python3 -m zonefactory <commande>` :

| Commande | Rôle | Utilisée par |
|---|---|---|
| `build <id> --version <n> --out <dossier>` | Fabrique le paquet de la zone `<id>`. Le dossier de sortie contient exactement les fichiers de la release, `SHA256SUMS` compris. Option `--cache-dir` : dossier des annexes de Planetiler, gardé d'une fois sur l'autre | Mac (C1), workflow |
| `next-version <id>` | Lit les étiquettes existantes (une par ligne, sur l'entrée standard) et écrit le numéro suivant | workflow |
| `catalogue --current <fichier> --package <dossier> --repo <propriétaire/dépôt> --out <fichier>` | Ajoute ou remplace la zone du paquet dans le catalogue, puis le valide. S'arrête si le résultat est invalide | workflow |
| `verify --catalogue <adresse ou fichier> --zone <id> --dest <dossier>` | Télécharge chaque fichier de la zone, contrôle taille et SHA-256, le range sous son `path`. Code de sortie non nul au premier fichier faux | workflow (étape 2 de la publication), testeur (C6, C7), T6 |

- `verify` range la zone comme le fera l'app. Le testeur s'en sert pour C7 :
  il pointe ensuite le script de comparaison de l'essai 1 sur ce dossier.
- Les messages affichés pour Émilien (erreurs, résumé des tailles) sont en
  français. Les noms de code et les commentaires sont en anglais (ADR 0011).
  Nommage Python habituel (PEP 8, le guide de style de Python) : fichiers,
  fonctions et variables en `snake_case`.

### 5. CI

Un second travail (job) `zones` dans `.github/workflows/verify.yml`, à côté
de celui de l'app :
- `actions/setup-python@v7` (dernière version majeure, juillet 2026),
  Python 3.12, cache de pip (l'installateur de paquets Python) ;
- `pip install -r zones/requirements-dev.txt` ;
- `python -m pytest`, lancé dans `zones/`. Sa dernière ligne donne le
  nombre de tests (C9).

Le workflow de fabrication (`fabriquer-zone.yml`, T4) est un fichier à
part : il ne se lance qu'à la main.

### 6. Pas d'outil de contrôle du style Python en phase 1

Le crochet de qualité (`.claude/hooks/qualite.py`) ne contrôle que
`mobile/`. Pour quelques centaines de lignes de Python, la relecture
suffit. Si `zones/` grossit, on ajoutera un outil de contrôle et de
formatage (par exemple Ruff), dans la CI et dans le crochet.

## Essais jetables, avant T4

Deux essais de quelques minutes sur le Mac, pour savoir tôt si C7
(« mêmes calculs que les essais ») est tenable sur GitHub :
1. **Processeur** : fabriquer les tuiles Valhalla du même extrait deux fois,
   avec l'image normale (ARM) et avec `docker run --platform linux/amd64`
   (x86-64 émulé, comme GitHub). Comparer les itinéraires R1 à R5.
2. **osmium** : découper le même extrait avec osmium 1.19.1 (Mac) et 1.16.0
   (dans une image `ubuntu:24.04`). Comparer les deux fichiers découpés
   (nombre d'objets, puis `osmium diff`).

Si l'un des deux montre un écart, l'identité stricte de C7 est impossible
sur GitHub, même avec l'extrait du 18 octobre. Il faudra alors une
tolérance (question posée dans l'ADR 0003, « Risque C7 »).

## Alternatives rejetées

- **Bash plus Python, comme les essais** : deux langages, du bash difficile
  à tester, et des commandes qui diffèrent entre Mac et Linux (défaut déjà
  rencontré dans l'essai 1).
- **TypeScript avec Node, comme l'app** : il faudrait un second
  `package.json` et un autre outil de test, alors que rien n'est partagé
  avec l'app (ADR 0011). Le calcul des circuits, déjà écrit et testé, est en
  Python.
- **`unittest`, l'outil de test fourni avec Python** : évite une
  dépendance, mais il en faut déjà une (jsonschema), donc une installation.
  pytest donne des tests plus courts et des erreurs plus lisibles.
- **Une image Docker unique avec tous les outils** : mêmes versions sur le
  Mac et sur GitHub, mais un fichier de plus à maintenir, une image à
  construire à chaque lancement, et une émulation lente sur le Mac.
- **Schémas dans `docs/`** : le code ne doit pas lire la documentation
  (ADR 0003, § 8).

## Conséquences

- Positif : un seul langage, des tests sans réseau, rapides, lancés par la
  CI. Le même code sert au Mac, au workflow et au testeur (`verify`).
- Négatif : un environnement Python à installer sur le Mac (`python3 -m
  venv zones/.venv`, puis `pip install -r zones/requirements-dev.txt`).
- Négatif : la CI a deux travaux à garder verts.
- `CLAUDE.md` (stack, commandes) devra citer l'ADR 0012 et les commandes de
  `zones/` après validation.

## Sources

Relevées le 2026-10-21.
- jsonschema : https://pypi.org/project/jsonschema/
- pytest : https://pypi.org/project/pytest/
- actions/setup-python : https://github.com/actions/setup-python/releases
- Valeur de référence SHA-256 de « abc » : FIPS 180-2, annexe B.1,
  https://csrc.nist.gov/publications/detail/fips/180/2/archive/2002-08-01
