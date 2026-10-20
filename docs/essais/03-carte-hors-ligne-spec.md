# Essai 3 — Carte hors ligne et circuits balisés : spec

> Spec de l'essai décrit dans [docs/04-architecture.md](../04-architecture.md)
> (« Essais jetables », ligne 3, et « Sur simulateurs »), étendu aux circuits
> VTT balisés (cadrage, fonction 9). Résultats :
> [03-carte-hors-ligne.md](03-carte-hors-ligne.md).

## Objectif

Prouver qu'un paquet de zone fabriqué par script affiche une carte VTT
lisible sans réseau dans MapLibre React Native, avec relief, courbes de
niveau et circuits VTT balisés, sur les simulateurs Android et iOS.

## Zone test

Celle de l'essai 1 : longitudes 5.84 à 6.52, latitudes 48.47 à 48.92
(Nancy). Données : extrait OpenStreetMap (OSM, carte libre et
collaborative) « Lorraine » de Geofabrik. Il est déjà sur le Mac :
`.claude/worktrees/essai-1-9fd65c/essais/01-calcul-hors-ligne/zone/sortie/travail/lorraine.osm.pbf`
(daté du 18 octobre 2026). Le copier plutôt que le télécharger.

## Critères

| # | Critère | Attendu |
|---|---|---|
| C1 | Fabrication | Un script refait carte, relief, courbes et circuits. Taille de chaque fichier (`stat -f %z`) et durée de chaque étape écrites dans `mesures.txt` |
| C2 | Zooms | Carte visible du zoom 8 au zoom 16 sans tuile vide dans la zone, sur les deux simulateurs |
| C3 | Lisibilité VTT | Sentiers (`path`) et pistes (`track`) distincts à l'œil, avec une légende |
| C4 | Courbes | Courbes de niveau visibles dès le zoom 13 |
| C5 | Poids | Carte + relief + courbes ≤ 150 Mo |
| C6 | Mode avion | Affichage sans réseau. Android : vrai mode avion. iOS : pas de trafic réseau de l'app (le simulateur partage le réseau du Mac) |
| C7 | Circuits | Relations `route=mtb` de la zone dans le paquet et affichées comme une couche. Mesurés : nombre, taille, nombre de circuits continus et discontinus |
| C8 | Attributions | « © OpenStreetMap » et « © OpenMapTiles » visibles sur la carte, plus celle du relief si sa licence l'exige |
| C9 | GitHub Actions | Estimation chiffrée et sourcée : une machine gratuite peut-elle fabriquer un paquet complet ? |

Preuves : captures à plusieurs zooms, couche des circuits visible, dans
`docs/essais/captures/03-*`.

## Organisation des fichiers

- `essais/03-carte-hors-ligne/zone/` : scripts de fabrication
  **réutilisables** (ils seront repris par l'app). Bien séparés du code
  jetable.
- `essais/03-carte-hors-ligne/app/` : app Expo jetable.
- `essais/03-carte-hors-ligne/actions/` : fichier de workflow (description
  d'une tâche automatique de GitHub Actions), **non activé** : il n'est pas
  dans `.github/workflows/`.
- Fichiers produits (`sortie/`, `.pbf`, `.pmtiles`, `.geojson` fabriqués,
  `node_modules`, builds) ignorés par git.

## Appareils réservés (l'essai 2 tourne en même temps)

- Android : AVD (appareil Android virtuel) `Pixel_6_API_34_arm64_e3`, à
  créer depuis l'image `system-images;android-34;google_apis;arm64-v8a`.
- iOS : simulateur « iPhone 17 Pro » (iOS 26.5),
  UDID 2AB23BB6-A5E3-44A2-825D-280287F1E16D.
- Metro (serveur JavaScript d'Expo) : port **8082**.
- Identifiant d'app : `fr.vttnav.essai3`.
- **Interdit** : toucher à l'AVD `Pixel_6_API_34_arm64`, au simulateur
  « iPhone 17 », au port 8081. Dans un shell non interactif :
  `export ANDROID_HOME=$HOME/Library/Android/sdk LANG=fr_FR.UTF-8`.
  Avec deux émulateurs lancés, toujours viser le bon avec `adb -s`.

## Tâches

### T1 — Fabrication de la carte, du relief, des courbes et des circuits

Dossier : `essais/03-carte-hors-ligne/zone/`. Script principal
`fabriquer-carte.sh` (bash, relançable, même style que
`essais/01-calcul-hors-ligne/zone/fabriquer-zone.sh` : fonction `step`,
`mesures.txt`, tailles exactes en octets avec `stat -f %z`).

1. **Carte** : Planetiler 0.10.2 (dernière version publiée, épinglée), par
   son image Docker (le Java du Mac est en version 17, trop vieux).
   Profil OpenMapTiles par défaut, zone limitée au rectangle (`--bounds`),
   sortie `.pmtiles`, zoom max 14 (la carte est agrandie au-delà).
   Noter les fichiers annexes téléchargés par Planetiler (polygones d'eau,
   Natural Earth…) : nom, taille, et s'ils sont vraiment nécessaires pour
   une zone sans mer. Limiter la mémoire Java (`-Xmx`) et la noter.
2. **Relief** : extrait de la zone du fichier Mapterhorn
   `https://download.mapterhorn.com/planet.pmtiles` (zoom 0 à 12, encodage
   « terrarium », tuiles WebP de 512 px) avec l'outil `pmtiles` de
   go-pmtiles (`pmtiles extract --bbox=…`). Essayer `--dry-run` d'abord.
   Mesurer aussi, sans le garder si c'est trop lourd, la taille d'un
   extrait zoom 13 et plus (fichiers régionaux listés dans
   `https://download.mapterhorn.com/download_urls.json`).
   Relever l'attribution exigée pour cette zone
   (`https://download.mapterhorn.com/attribution.json`).
3. **Courbes de niveau** : équidistance 10 m, courbes maîtresses tous les
   50 m (attribut). Source au choix, à justifier : les fichiers HGT de
   l'essai 1 (dans le même dossier `travail/` de l'essai 1) ou le relief
   Mapterhorn. Outils : GDAL (`gdal_contour`, image Docker
   `ghcr.io/osgeo/gdal`, version épinglée) puis `tippecanoe` (Homebrew)
   vers un `.pmtiles` vectoriel, zoom 11 à 14 au moins, couche `contour`,
   attribut `ele`. Un lissage léger est permis s'il est noté.
4. **Circuits** : script `extraire-circuits.py` (Python 3, sans
   dépendance externe, `osmium` en ligne de commande permis, lancé avec
   `python3 -I`).
   - Prendre dans l'extrait **Lorraine** (pour avoir les circuits en
     entier) les relations `route=mtb` qui touchent la zone. Les
     sous-relations (relation dans une relation) sont suivies.
   - Écrire `circuits.geojson` : un objet par relation, géométrie
     `MultiLineString`, propriétés `osm_id`, `name`, `ref`, `network`,
     `colour` si présents, `length_m`, `parts` (nombre de morceaux),
     `max_gap_m` (plus grand écart entre deux morceaux).
   - Un **morceau** est un groupe de voies reliées par des nœuds communs.
     Un circuit est **continu** s'il a un seul morceau, **discontinu**
     sinon. Pour un circuit discontinu, `max_gap_m` est la plus courte
     distance entre ce morceau et le plus proche, prise au pire morceau.
   - Écrire dans `mesures.txt` : nombre de circuits, nombre de continus et
     de discontinus, taille du GeoJSON, et une ligne par circuit (id, nom,
     longueur, morceaux, plus grand écart).
   - À titre d'information : le même décompte sur toute la Lorraine (il
     dit si Nancy est un cas pauvre ou typique). Vérifier le résultat sur
     la relation 11656724 (R1 de l'essai 1), qui a des sauts connus.
5. **Paquet carte** : `sortie/nancy-carte/` avec `carte.pmtiles`,
   `relief.pmtiles`, `courbes.pmtiles`, `circuits.geojson`, `carte.json`
   (limites, date OSM, tailles, attributions, versions des outils).
6. Outils à installer par Homebrew si absents : `pmtiles`, `tippecanoe`.
   Noter chaque outil installé et sa version dans le LISEZMOI.

Preuves : `mesures.txt` complet, sortie de `pmtiles show` pour chaque
`.pmtiles` (zooms, limites, couches), le compte des circuits.

### T2 — App Expo jetable avec MapLibre, sur les deux simulateurs

Dossier : `essais/03-carte-hors-ligne/app/`.

1. Expo SDK 58, React Native 0.88, TypeScript, version de développement
   (pas Expo Go), `@maplibre/maplibre-react-native` 11.5.0, identifiant
   `fr.vttnav.essai3`. On peut repartir de l'app de l'essai 1
   (`git show claude/essai-1-9fd65c:…`) pour la config.
2. Le paquet carte n'est **pas** dans l'app : un script
   `installer-carte.sh android|ios` le copie dans les documents de l'app
   (`<documents>/zones/nancy/`).
3. Style de carte écrit pour l'essai (fichier JSON ou objet TypeScript),
   **sans aucune URL réseau** : sources `pmtiles://file://…` pour la carte,
   le relief (`raster-dem`, couche `hillshade`) et les courbes ; source
   GeoJSON locale pour les circuits. Polices des étiquettes (glyphes) en
   local aussi, pas d'icônes (sprite) nécessaires. Une police libre, licence
   notée.
   - Pistes (`class=track`) et sentiers (`class=path`) bien distincts
     (couleur et trait), routes en dessous, forêts visibles.
   - Courbes affichées dès le zoom 13, maîtresses plus marquées, cote
     (`ele`) sur les maîtresses.
   - Circuits : trait coloré épais et semi-transparent, au-dessus des
     voies, nom du circuit le long du trait.
4. Écran : la carte plein écran, l'attribution visible en permanence
   (« © OpenStreetMap © OpenMapTiles », plus celle du relief), le niveau de
   zoom affiché, une petite légende (piste, sentier, circuit, courbe).
   Des boutons pour aller aux vues de capture : zooms 8, 10, 12, 13, 14, 16,
   centrés sur un circuit de la zone (forêt de Haye). Un bouton pour
   masquer ou montrer les circuits.
5. Android d'abord (AVD `Pixel_6_API_34_arm64_e3`), puis iOS
   (« iPhone 17 Pro »). Metro sur le port 8082.
6. Mode avion : Android avec `adb -s <émulateur> shell cmd connectivity
   airplane-mode enable`, capture avec l'icône. iOS : mesurer le trafic
   réseau de l'app pendant les captures (`nettop`, comme à l'essai 1).
   Vérifier aussi que le style ne contient aucune URL `http`.
7. Captures dans `docs/essais/captures/` :
   `03-android-z08.png` … `03-android-z16.png`, `03-ios-z08.png` …,
   `03-android-avion.png`, une capture circuits masqués / montrés.
   Regarder chaque capture : pas de tuile vide (carré blanc ou gris) dans
   la zone, et le dire.
8. Journal : les erreurs ou avertissements de MapLibre (tuiles
   manquantes, glyphes manquants), recopiés dans `app/preuves/`.

Garde-fou : si la lecture d'un PMTiles local par MapLibre React Native
bloque après deux approches sérieuses, arrêt et compte rendu (cause,
pistes, effort). Repli à noter : servir le PMTiles par un petit serveur
local dans l'app, ou convertir en MBTiles.

### T3 — Mesures pour GitHub Actions

1. Script `essais/03-carte-hors-ligne/zone/fabriquer-paquet.sh` : enchaîne
   la fabrication complète d'un paquet (calcul Valhalla et altitude avec
   le script de l'essai 1, puis `fabriquer-carte.sh`), en partant de
   l'extrait Lorraine. Il mesure pour chaque étape : durée, pic de mémoire
   (conteneurs Docker : échantillonnage de `docker stats` ; processus du
   Mac : `/usr/bin/time -l`), et le disque utilisé au pic (dossier de
   travail, téléchargements, images Docker).
2. Fichier `essais/03-carte-hors-ligne/actions/fabriquer-zone.yml` :
   workflow déclenché à la main seulement (`workflow_dispatch`), machine
   `ubuntu-latest`, qui installerait les outils, fabriquerait le paquet et
   le publierait en release. **Non activé, non poussé, non lancé.**
   Écrire les commandes Linux équivalentes (le Mac utilise `stat -f`,
   Linux `stat -c`).

Limites documentées des machines gratuites (relevées le 20 octobre 2026) :
- machine `ubuntu-latest` d'un dépôt public : 4 processeurs, 16 Go de
  mémoire, 14 Go de disque SSD (source :
  https://docs.github.com/en/actions/reference/runners/github-hosted-runners) ;
- une tâche dure au plus 6 heures (source :
  https://docs.github.com/en/actions/reference/limits) ;
- gratuit pour un dépôt public sur les machines standard (source :
  https://docs.github.com/en/billing/concepts/product-billing/github-actions) ;
- fichiers « artifacts » (fichiers gardés après une tâche) : 500 Mo pour un
  compte gratuit (même source que la durée). Un fichier de release, lui,
  peut faire 2 Gio (ADR 0003).

## Hors périmètre

- Le style définitif de la carte (phase de design).
- Transformer un circuit en itinéraire (seulement l'afficher).
- La carte en ligne OpenFreeMap, hors des zones.
- Le téléchargement du paquet depuis GitHub Releases dans l'app.

## Coût estimé et risques

Petit à moyen : 1 à 2 sessions. Risques : lecture d'un PMTiles local par
MapLibre React Native (non documentée), polices hors ligne, poids du
relief, fichiers annexes de Planetiler (taille du téléchargement).
