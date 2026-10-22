# Phase 1 — Fabrique de zones : résultats

> 22 octobre 2026. Spec : [p01-fabrique-zones.md](p01-fabrique-zones.md).
> Branche `claude/phase-1-zones-73115d`, poussée, non fusionnée.

## En bref

- La zone Nancy est fabriquée et publiée par GitHub Actions, sans le Mac,
  sur une machine ARM. La release à jour est `zone-nancy-v2`, et le
  catalogue est à une adresse stable.
- Les 10 critères sont tenus. C7 l'est depuis le passage sur ARM : la v1,
  fabriquée sur x86-64, changeait l'itinéraire R1 (voir C7).
- Deux pannes de serveurs tiers ont été contournées par décision du
  pilotage, et notées dans l'ADR 0003.

## Liens

| Quoi | Adresse |
|---|---|
| Release de la zone, fabriquée sur ARM | https://github.com/Emilien1982/RutaPulse/releases/tag/zone-nancy-v2 |
| Release v1, fabriquée sur x86-64 (gardée, plus dans le catalogue) | https://github.com/Emilien1982/RutaPulse/releases/tag/zone-nancy-v1 |
| Catalogue (adresse stable pour l'app) | https://github.com/Emilien1982/RutaPulse/releases/download/catalogue/catalogue.json |
| Run réussi sur ARM « Fabriquer une zone » (commit e61cde5) | https://github.com/Emilien1982/RutaPulse/actions/runs/39830845075 |
| Run réussi sur x86-64 (commit 4d86a6c, v1) | https://github.com/Emilien1982/RutaPulse/actions/runs/39809980778 |
| Run `verify` du même push (CI de l'app et de `zones/`) | https://github.com/Emilien1982/RutaPulse/actions/runs/39809980815 |
| Premier run, en échec (panne d'osmdata) | https://github.com/Emilien1982/RutaPulse/actions/runs/39644202448 |

## Critères

| # | Attendu | Mesuré | Preuve | Verdict |
|---|---|---|---|---|
| C1 | Un script fabrique un paquet complet | `python -m zonefactory build nancy --version 1` sur le Mac : 10 fichiers, 110 805 698 octets, environ 90 s (tableau plus bas) | `zones/out/nancy-2` à `nancy-5`, `shasum -a 256 -c SHA256SUMS` : 9 OK | Oui |
| C2 | Ajouter une zone sans code | Une 2e zone ajoutée au seul `zones.json` est lue et validée ; l'exemple « metz » du LISEZMOI passe la validation | Tests `test_second_zone_is_read_and_can_be_requested`, contrôle du LISEZMOI | Oui, pour la lecture. Une 2e zone n'a pas été fabriquée |
| C3 | Une empreinte SHA-256 par fichier | `SHA256SUMS` dans le paquet ; empreintes recalculées après téléchargement identiques | C6 ; T6 : un octet changé est détecté | Oui |
| C4 | Catalogue validé par un schéma et des tests | Le catalogue publié passe `zones/schemas/catalogue.schema.json` et les règles du code | Testeur, T5 ; tests de `test_catalogue*.py` | Oui |
| C5 | Le workflow publie Nancy en release | Run ARM 39830845075 réussi en 3 min 54 s : release `zone-nancy-v2` (10 fichiers, pas en brouillon), catalogue mis à jour en v2. Avant, run x86-64 39809980778 : `zone-nancy-v1` | Annotation publique « machine aarch64 ; valhalla, planetiler, gdal linux/arm64 » ; API, page web et téléchargement | Oui, déclenché par un push. Le lancement à la main reste à vérifier après la fusion |
| C6 | Un fichier publié correspond à son empreinte | v1 et v2 : `verify` depuis l'adresse publique du catalogue, 9 fichiers OK, code 0 ; fichiers à plat : `shasum -a 256 -c SHA256SUMS`, 9 OK | Testeur, T5 | Oui |
| C7 | (1) Refaite sur le Mac depuis l'adresse datée : mêmes tracés. (2) Distance ± 2 %, D+ ± 5 % de l'essai 1 | v2 (ARM) : (1) 5 tracés sur 5 identiques octet pour octet à ceux du Mac ; (2) écarts de 0,01 % au plus en distance, 0 % en D+. v1 (x86-64) : (1) 0 sur 5, (2) R1 hors tolérance | Testeur, T5, script `zones/tests/c7/comparer.py` | Oui, avec la fabrication sur ARM (décision d'Émilien, 22 oct.) |
| C8 | Mentions de licence dans le paquet | `LICENCES.md` : OpenStreetMap (ODbL), OpenMapTiles, Natural Earth, Mapterhorn, IGN, Copernicus, SRTM | Fichier publié | Oui |
| C9 | Script testé, tests lancés par la CI | La CI lance 182 tests, tous réussis : annotation publique du job `zones`, « 182 passed in 1.89s » | Run https://github.com/Emilien1982/RutaPulse/actions/runs/39813383173 (commit 5c960c5) | Oui |
| C10 | Aucun secret | Seul le jeton automatique `github.token`, donné aux 3 étapes `gh` ; `permissions: contents: write` ; aucun motif de secret dans le diff ; 28 commits en e-mail noreply | Audit avant chaque push | Oui |

### Tailles du paquet

| Fichier | Mac, extrait du 18 oct. (`nancy-2`) | Publié, extrait du 20 oct. (v1 et v2) |
|---|---|---|
| `valhalla_tiles.tar` | 28 692 480 | 28 835 840 |
| `N48E005.hgt` | 25 934 402 | 25 934 402 |
| `N48E006.hgt` | 25 934 402 | 25 934 402 |
| `map.pmtiles` | 17 599 345 | 17 603 258 |
| `terrain.pmtiles` | 8 775 665 | 8 775 665 |
| `contours.pmtiles` | 3 810 015 | 3 809 985 |
| `trails.geojson` | 55 994 | 55 994 |
| `LICENCES.md` | 2 107 | 2 107 |
| `zone.json` | 569 | 569 |
| `SHA256SUMS` | 719 | 719 |
| Total | 110 805 698 | 110 952 222 (v1) et 110 952 225 (v2), d'après le catalogue, sans `SHA256SUMS` |

Durées sur GitHub : run x86-64 4 min 53 s (dont fabrication 223 s) ; run
ARM 3 min 54 s. La mémoire et le disque sont
écrits dans le résumé du run, lisible seulement avec un compte : non relevés.

### C7 : ce qui est prouvé

**Sur ARM (v2, run 39830845075).** Même extrait daté que la v1. Les 5
tracés sont identiques octet pour octet à ceux de la zone refaite sur le
Mac. Distance et D+ sont ceux de l'essai 1, à 0,01 % près. Fichiers
identiques entre la v2 et le Mac : HGT, `map.pmtiles`, `terrain.pmtiles`,
`trails.geojson`, `LICENCES.md`. Fichiers différents : `valhalla_tiles.tar`
(jamais identique d'une fabrication à l'autre, voir plus bas) et
`contours.pmtiles` (tippecanoe 2.49.0 sur GitHub, 2.79.0 sur le Mac,
différence acceptée par l'ADR 0003 § 6).

**Sur x86-64 (v1), avant la décision.** Zone publiée : extrait `lorraine-261020.osm.pbf`, dont le MD5 est
identique à celui publié par Geofabrik. Elle a été refaite sur le Mac à
partir de la même adresse.

| Réf. | Essai 1 (km / D+) | Publié, GitHub (km / D+) | Refait, Mac (km / D+) |
|---|---|---|---|
| R1 | 20,53 / 242 | 19,59 / 224 | 20,53 / 242 |
| R2 | 35,17 / 454 | 35,17 / 461 | 35,17 / 454 |
| R3 | 26,98 / 480 | 26,98 / 480 | 26,98 / 480 |
| R4 | 42,12 / 665 | 42,12 / 679 | 42,12 / 665 |
| R5 | 40,35 / 706 | 40,35 / 706 | 40,35 / 706 |

- **La découpe n'y est pour rien.** osmium 1.16.0 (GitHub) et 1.19.1 (Mac)
  donnent exactement les mêmes objets.
- **Les données non plus.** Sur le Mac, l'extrait du 20 octobre redonne
  l'essai 1 à l'identique.
- **C'est le processeur qui fabrique les tuiles Valhalla.** Mêmes données,
  même image Valhalla 3.9.1 :
  - avec le processeur de GitHub (x86-64, émulé sur le Mac), les 5 tracés
    sont identiques octet pour octet à ceux de la zone publiée ;
  - avec le processeur du Mac (ARM), ils sont identiques à ceux du Mac.
- R1 change de chemin dans la forêt de Haye, entre (48,751 ; 5,967) et
  (48,755 ; 5,981). Pour R2 à R5, les points ne diffèrent que d'un ou deux
  millionièmes de degré, soit environ 0,1 m. Mais le D+ de R2 et de R4
  bouge de 7 à 14 m.
- Donc : la zone **se refait à l'identique sur le même type de processeur**,
  mais pas d'un type à l'autre. C'est le risque « processeur » prévu par
  l'ADR 0003.
- L'archive `valhalla_tiles.tar` n'est jamais identique d'une fabrication à
  l'autre, même sur la même machine (dates et ordre des calculs). Il faut
  comparer les itinéraires, pas les fichiers.

## T6 : casser exprès

Fait sur le Mac le 21 octobre, sur une copie du paquet. Le vrai
`zones.json` est restauré par git après chaque cas.

| Défaut introduit | Contrôle | Résultat |
|---|---|---|
| Un octet changé dans `trails.geojson` | `shasum -a 256 -c SHA256SUMS` | `trails.geojson: FAILED`, code 1 |
| Le même | `zonefactory catalogue` | « empreinte fausse pour trails.geojson », code 1, aucun catalogue écrit |
| Le même, catalogue juste | `zonefactory verify` | 6 fichiers OK puis « empreinte fausse », code 1, arrêt au fichier faux |
| `zones.json` : un côté de plus de 1° | `zonefactory build` | « un côté dépasse 1° », code 1 |
| `zones.json` : id `Nancy Ville` | `build` | refus par le schéma, motif de l'id |
| `zones.json` : champ inconnu | `build` | « Additional properties are not allowed » |
| `zones.json` : adresse en `.zip` | `build` | refus par le schéma, motif `.osm.pbf` |
| `zones.json` : JSON cassé | `build` | « zones.json illisible », code 1 |
| `zones.json` : lonMin ≥ lonMax | `build` | « il faut lonMin < lonMax », code 1 |

Dans tous les cas de `zones.json`, aucun paquet n'est fabriqué. Les
messages sont en français, mais ceux du schéma reprennent le texte anglais
de jsonschema.

## Écarts et incidents

- **Panne d'osmdata.openstreetmap.de** (polygones d'eau de Planetiler,
  931 Mo), muet du 21 octobre à 17 h 30 UTC jusqu'au 22 octobre après 16 h
  UTC au moins. Il a fait échouer le premier run. Parades, décidées par le
  pilotage :
  - avec le cache plein, la carte se construit sans réseau ;
  - une zone intérieure (`"coastal": false`, nouveau champ obligatoire de
    `zones.json`) reçoit un fichier d'eau vide, fait avec GDAL.
  Preuve : `map.pmtiles` de Nancy est identique octet pour octet avec le
  vrai fichier et avec le fichier vide. Les SHA-256 sont égaux
  (`1eb3af69…`), `cmp` ne trouve aucune différence, sur 1 405 tuiles.
  Une zone côtière échoue avec un message clair si le serveur est muet.
- **Critère C7 réécrit le 21 octobre** par le pilotage : extrait récent au
  lieu d'un extrait figé. Voir l'ADR 0003, « Risque C7 ».
- **Plantage de `valhalla_build_tiles`** (code 139), 1 fois sur 8
  fabrications sur le Mac. Un nouveau lancement, sans rien changer, a
  réussi. Cause inconnue. Pas vu sur GitHub.
- **C7 non tenu par la v1** (x86-64). Décision d'Émilien le 22 octobre :
  fabriquer sur la machine ARM de GitHub, `ubuntu-24.04-arm`, gratuite pour
  un dépôt public. Le workflow échoue si une image Docker n'est pas
  `linux/arm64` : aucune émulation ne peut passer en silence.
- **Incident GitHub Actions le 22 octobre** : de 16 h 26 à 18 h 22 UTC
  environ, aucun push du dépôt n'a déclenché de workflow. Cela a touché
  a1184bd, e61cde5, et aussi le push du pilotage sur `main`, d2e92e2. Les
  runs de e61cde5 ont démarré avec 37 minutes de retard ; a1184bd n'a jamais
  eu de run. Ma surveillance de cette période avait une erreur de script et
  a consommé 6 requêtes d'API pour rien.
- **Lecture de GitHub sans compte** : les journaux des runs exigent une
  connexion. Le workflow publie donc ses erreurs en annotations, lisibles
  par l'API publique. L'API garde ses réponses en cache 60 s, et le filtre
  `?branch=` a parfois répondu par une liste vide.

## Outils installés pendant la phase

| Outil | Version | Où |
|---|---|---|
| jsonschema | 4.26.0 | `zones/.venv` (ignoré par git) |
| pytest | 9.1.1 | `zones/.venv` |
| actionlint (contrôle des workflows) | 1.7.12 | image Docker `rhysd/actionlint:1.7.12` |
| Ubuntu 24.04 | image Docker `ubuntu:24.04` | essai d'osmium 1.16.0, comme sur GitHub |

Déjà présents : Docker, images Valhalla 3.9.1, Planetiler 0.10.2,
GDAL 3.10.3 (en ARM), osmium 1.19.1, pmtiles 1.31.2, tippecanoe 2.79.0,
Python 3.14. Sur GitHub, le workflow installe osmium 1.16.0 et
tippecanoe 2.49.0 (apt), ainsi que pmtiles 1.31.2, contrôlé par son SHA-256.

## Ce qui n'est pas vérifié

- Le lancement à la main du workflow (onglet Actions) : il n'est possible
  qu'après la fusion dans `main` (risque 1 de la spec).
- La fabrication d'une 2e zone, et d'une zone côtière.
- La mémoire et le disque au plus haut sur la machine de GitHub. Ils sont
  dans le résumé du run, qu'il faut un compte pour lire.
- Ce que calcule le téléphone avec les tuiles de la v2. Elles sont
  fabriquées sur ARM, comme celles de l'essai 1, mais l'essai n'est pas
  refait avec elles. À éprouver en phase 2 ou 3.
- Une 2e fabrication sur la machine ARM de GitHub : une seule a été mesurée.
- La cause exacte du plantage occasionnel de `valhalla_build_tiles`.

## Ce qui a été appris sur les agents

- Le relecteur a trouvé de vrais défauts à chaque tâche : tuiles d'altitude
  d'une autre zone dans le paquet, droits root sous Linux, extrait
  « latest » figé dans le cache, catalogue absent pris pour un catalogue
  vide, Planetiler qui contactait encore le serveur avec un cache plein.
  Les tests seuls n'auraient trouvé que le premier.
- Le développeur a deux fois contourné sa règle sur les tests. Il a ajouté
  des tests dans des fichiers existants, puis modifié un test déjà commité
  en le croyant nouveau. Le garde-fou ne voit pas les écritures faites par
  le shell. Les deux fois, le relecteur l'a vu et jugé sans dommage.
- Un commit (caaa31b) a été fait avec 3 tests en échec. Il faut commiter
  le code et l'adaptation des tests ensemble.
- Un relecteur peut juger sur un vieux fichier (l'ancien paquet, sans le
  nouveau champ). Il faut lui donner le chemin exact de la preuve.

## À reporter dans PILOTAGE.md

- Phase 1 : faite, les 10 critères tenus. Branche
  `claude/phase-1-zones-73115d`, prête à fusionner. Release `zone-nancy-v2`
  (ARM) et catalogue publiés ; la v1 (x86-64) reste en release, hors du
  catalogue.
- Décisions prises pendant la phase :
  - C7 avec un extrait récent (pilotage, 21 oct.) ;
  - attendre le retour d'osmdata (pilotage, 21 oct.) ;
  - eau vide pour une zone intérieure, avec le champ `coastal`
    (pilotage, 22 oct.) ;
  - fabrication sur la machine ARM de GitHub (Émilien, 22 oct.) ;
  - `ubuntu-24.04` fixé dans `verify.yml` (pilotage, 22 oct.) ;
  - fichiers de test à part autorisés pour le testeur, écrit dans
    l'ADR 0012 (pilotage, 22 oct.).
- Fait sur la branche : déclencheur `push` temporaire retiré de
  `fabriquer-zone.yml`. Il ne reste que le lancement à la main.
- Après la fusion :
  - Émilien vérifie un lancement à la main (onglet Actions, « Fabriquer une
    zone », zone `nancy`). Il publiera une v3 ;
  - accepter les ADR 0003 (sections du 21 et du 22 octobre) et 0012,
    toujours « proposés » ;
  - citer `zones/` et ses commandes dans `CLAUDE.md`.
- À décider plus tard avec Émilien : une copie des annexes de Planetiler
  dans une release, si osmdata retombe en panne pour une zone côtière.
- Pour les phases 2 et 3 : éprouver le calcul sur le téléphone avec les
  tuiles publiées.
