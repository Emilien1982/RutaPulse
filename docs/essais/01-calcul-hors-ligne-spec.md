# Essai 1 — Calcul VTT hors ligne : spec

> Spec de l'essai décrit dans [docs/04-architecture.md](../04-architecture.md)
> (« Essais jetables » et « Sur simulateurs »). Résultats :
> [01-calcul-hors-ligne.md](01-calcul-hors-ligne.md).

## Objectif

Savoir si la création d'itinéraire VTT **hors ligne** entre en v1 : Valhalla
(moteur de calcul d'itinéraire) tourne-t-il dans une app Expo, sur les
simulateurs iOS et Android, avec des résultats praticables ?

## Zone test

- Rectangle autour de Nancy (Lorraine) : longitudes 5.84 à 6.52, latitudes
  48.47 à 48.92. Environ 50 × 50 km.
- Il couvre la forêt de Haye, le plateau de Malzéville, le plateau de
  Ludres, Pompey et la « Petite Suisse lorraine » au sud de Pont-à-Mousson.
- Source des données : extrait OpenStreetMap (OSM, carte libre et
  collaborative) « Lorraine » de Geofabrik (site qui publie des extraits OSM).

## Les 5 itinéraires de référence

| # | Nom | Source | Type |
|---|---|---|---|
| R1 | Circuit VTT balisé de la forêt de Haye (ouest, Velaine-en-Haye) | Relation OSM [11656724](https://www.openstreetmap.org/relation/11656724) | Balisé (`trailblazed=yes`) |
| R2 | Petite Suisse Lorraine à VTT (35 km, D+ 260 m annoncés) | Relation OSM [15712020](https://www.openstreetmap.org/relation/15712020), office du Bassin de Pont-à-Mousson | Publié par l'office de tourisme |
| R3 | Forêt de Haye (25 km, D+ 270 m) | VisuGPX [A7jnmrvO13](https://www.visugpx.com/A7jnmrvO13) | Trace dessinée et publiée |
| R4 | Rando VTT Ludres, 13 avril 2014 (Decathlon) | VisuGPX [1397404889](https://www.visugpx.com/1397404889) | Randonnée organisée, trace enregistrée |
| R5 | La Pompéenne (44 km, D+ 860 m) | VisuGPX [DaKN8WtCIZ](https://www.visugpx.com/DaKN8WtCIZ) | Randonnée de club, trace enregistrée |

Seules 2 relations VTT existent dans OSM sur la zone (vérifié le
19 octobre 2026 sur l'extrait du 18 octobre). Les 3 autres sont des traces
publiées sur VisuGPX (site de partage de traces GPS, téléchargement libre).
Les fichiers ne sont pas mis dans le dépôt : un script les télécharge.

## Critères (repris de docs/04)

| # | Critère | Attendu |
|---|---|---|
| C1 | Mode avion | Calcul réussi sans réseau, sur les simulateurs Android et iOS |
| C2 | Temps de calcul (indicatif sur simulateur) | 30 km, 5 points : médiane de 10 essais < 3 s |
| C3 | Praticable | 4 itinéraires sur 5 jugés praticables par Émilien, sur captures |
| C4 | Distance | ± 5 % de la référence |
| C5 | Dénivelé positif | ± 10 % de la référence |
| C6 | Langue | Instructions en français |
| C7 | Taille du paquet | Calcul + altitude ≤ 150 Mo |
| C8 | Poids ajouté à l'app | ≤ 50 Mo |
| C9 | Robustesse | 50 calculs à la suite sans plantage |

Points de passage d'un itinéraire calculé : 5 points pris sur la référence
à 0, 25, 50, 75 et 100 % de sa longueur (une boucle revient au départ).

## Tâches

### T1 — Paquet de zone (calcul + altitude) et références

Dossier : `essais/01-calcul-hors-ligne/zone/`.

1. Script `fabriquer-zone.sh` (bash), relançable :
   - télécharge l'extrait Lorraine de Geofabrik s'il manque ;
   - découpe la zone avec `osmium` (installé par Homebrew) ;
   - avec l'image Docker `ghcr.io/valhalla/valhalla:3.9.1` (même version que
     celle embarquée par valhalla-mobile 0.6.4) : fabrique la config,
     télécharge les tuiles d'altitude de la zone (`valhalla_build_elevation`),
     fabrique les tuiles de calcul **avec l'altitude**, puis l'archive
     `valhalla_tiles.tar` (`valhalla_build_extract`) ;
   - range le paquet dans `zone/sortie/nancy/` : `valhalla_tiles.tar`,
     dossier `elevation/`, fichier `zone.json` (nom, limites, date des
     données OSM, tailles) ;
   - écrit dans `zone/sortie/mesures.txt` le temps de chaque étape et les
     tailles (tar, altitude, total).
2. Vérification sur le Mac : lancer `valhalla_service` (Docker) sur le
   paquet et demander un itinéraire `bicycle`, `bicycle_type: mountain`,
   `language: fr-FR`, `elevation_interval: 30`, entre deux points de la
   forêt de Haye. Attendu : réponse sans erreur, instructions en français,
   altitudes non nulles. Script : `verifier-zone.sh`.
3. Script `references/preparer-references.py` (Python 3, sans dépendance
   externe si possible) :
   - R1 et R2 : reconstruit une trace ordonnée à partir des voies de la
     relation OSM (extrait local, via `osmium`) et l'écrit en GPX ;
   - R3 à R5 : télécharge le GPX depuis VisuGPX (lien `/dl/...` de la page) ;
   - pour chaque référence, écrit dans `references/references.json` : nom,
     source (URL), distance (km), dénivelé positif annoncé par la source
     s'il existe, dénivelé calculé, et les 5 points de passage (0, 25, 50,
     75, 100 %).
4. Fichiers produits (`sortie/`, GPX téléchargés) ignorés par git.

Hors périmètre de T1 : la carte PMTiles (essai 3), l'app mobile.

### T2 — App Expo minimale + module natif Valhalla, sur un premier simulateur

Dossier : `essais/01-calcul-hors-ligne/app/`. Premier simulateur :
l'émulateur Android `Pixel_6_API_33` (dépendance Maven, la plus simple).

1. App Expo SDK 58 en TypeScript (gabarit `blank-typescript`), compilée en
   version de développement (`npx expo run:android`), sans Expo Go.
2. Module local Expo (`npx create-expo-module --local`), nommé
   `valhalla-route`, écrit avec l'Expo Modules API :
   - Android : `io.github.rallista:valhalla-mobile:0.6.4` (Maven Central) ;
   - iOS : Swift Package `https://github.com/Rallista/valhalla-mobile`
     0.6.4, produit `Valhalla` (préparé en T2, éprouvé en T3).
   - Fonctions exposées à JavaScript, toutes asynchrones, hors du fil
     principal : `open(tarPath, elevationDir)`, `route(json)`,
     `height(json)`, `traceAttributes(json)`, `close()`. Elles reçoivent et
     renvoient le JSON de Valhalla tel quel (méthodes « raw » de
     valhalla-mobile). Une seule instance Valhalla, réutilisée.
3. Le paquet de zone n'est **pas** dans l'app : il est copié dans le
   dossier de documents de l'app (`adb push` / `xcrun simctl
   get_app_container`) par un script `installer-zone.sh`. L'app le lit dans
   `<documents>/zones/nancy/`.
4. Écran unique : un bouton par référence R1 à R5. Le calcul utilise les
   5 points de passage de `references.json`, vélo `mountain`, `fr-FR`,
   `elevation_interval: 30`. Affichage : distance, durée, durée du calcul,
   5 premières instructions.
5. Preuve attendue : capture de l'émulateur qui montre un itinéraire
   calculé (distance et instructions en français), plus le journal.

### T3 — Mesures sur les deux simulateurs, captures, 50 calculs

Décisions du pilotage (19 octobre) :
- **Comparaison** (C3, C4, C5) : points de passage le long de la
  référence, environ **tous les 2 km**, départ et arrivée compris. Le
  critère de temps (C2) garde 5 points sur 30 km, médiane de 10 essais.
- **Dénivelé** : D+ de l'itinéraire et D+ de la référence calculés de la
  même façon (rééchantillonnage 30 m, seuil 5 m), avec les altitudes du
  paquet.
- **Captures** : une image par référence, itinéraire calculé et référence
  superposés sur un fond de carte, deux couleurs, une légende. Générées
  sur le Mac. Rangées dans `docs/essais/captures/`.
- **Ouverture du moteur** (7 s en debug sur Android) : mesurée aussi sur
  iOS et en « release », avec une parade proposée.

#### T3a — Module iOS sur le simulateur iOS 26.5

- Compiler l'app sur le simulateur iPhone 17 (iOS 26.5) avec le module
  Swift et valhalla-mobile 0.6.4 (Swift Package).
- Installer le paquet (`installer-zone.sh ios`), calculer R1 à R5 (5 points),
  capture et journal comme sur Android.
- Garde-fou : deux approches sérieuses au plus, puis compte rendu.

#### T3b — Points tous les 2 km, analyse et captures (sur le Mac)

Dossier : `essais/01-calcul-hors-ligne/analyse/`, plus
`zone/references/`.
1. `preparer-references.py` ajoute, pour chaque référence, la liste
   `points_2km` (un point tous les 2 km le long de la trace, départ et
   arrivée compris) et le D+ de la référence avec les altitudes du paquet
   (déjà présent).
2. Requête type commune (fichier JSON) : vélo `mountain`, `fr-FR`,
   `elevation_interval: 30`, points intermédiaires de type `through`. Vérifier
   la limite de points de Valhalla 3.9.1 pour le vélo.
3. `analyser.py` : lit les réponses de route enregistrées (format de
   Valhalla, une par référence et par plateforme), calcule distance, D+
   (même méthode, altitudes du paquet via `height` du `valhalla_service`
   Docker), écarts à la référence, et écrit un tableau Markdown.
4. `captures.py` : pour chaque référence, page HTML Leaflet (référence et
   itinéraire calculé, deux couleurs, légende, nom, distances), capturée en
   PNG par Chrome sans interface (`--headless --screenshot`), dans
   `docs/essais/captures/`. Fond de carte : OpenTopoMap ou OSM, avec
   l'attribution.
5. Épreuve de la chaîne avant les simulateurs : réponses produites par le
   `valhalla_service` Docker avec la même requête.

#### T3c — Banc de mesure dans l'app, sur les deux simulateurs

1. Mode « banc » dans l'app : calcule R1 à R5 (points 2 km) et enregistre
   les réponses brutes ; temps C2 (10 essais, 30 km, 5 points) ; 50 calculs à
   la suite (C9) ; durée d'ouverture du moteur. Résultats écrits dans un
   fichier JSON des documents de l'app, récupéré sur le Mac.
2. Builds « release » sur les deux plateformes. C8 : poids ajouté par
   Valhalla, mesuré entre l'app avec et sans le module.
3. Mode avion : Android avec `cmd connectivity airplane-mode enable`, capture
   de l'icône. iOS : le simulateur partage le réseau du Mac ; noter ce qui
   est prouvé et ce qui ne l'est pas.

## Garde-fou de coût

Si l'intégration de valhalla-mobile dans Expo bloque encore après deux
tentatives sérieuses : arrêt, compte rendu du blocage (cause, pistes,
effort estimé). Émilien choisit entre persévérer et le repli en ligne.

## Essai 1-bis — Qualité du choix des chemins VTT (validé le 20 octobre 2026)

Jugement d'Émilien sur les cartes de l'essai 1 : itinéraires praticables
(C3 atteint), mais peu intéressants. Trop de ville, trop de laies (larges
allées forestières droites), de petites boucles autour des points, et
les pistes (`highway=track`) prises par la référence sont évitées (R4,
près de Clairlieu).

Tout se fait sur le Mac (Docker). Les tracés y sont identiques à ceux des
simulateurs (prouvé à l'étape 3).

Constat de départ : les points intermédiaires sont **déjà** en `through`
depuis T3b (`analyse/commun.py`). Les demi-tours mesurés (R3 2, R4 4,
R5 1) existent donc malgré `through`. Il faut un autre levier.

### Mesures, sur R1 à R5 (R1 à part), dans deux cas

- Cas « 2 km » : points tous les 2 km le long de la référence.
- Cas « 5 points » : 0, 25, 50, 75 et 100 % de la référence (usage réel).

Pour chaque combinaison :
1. part de la longueur sur route ou en ville, et part sur piste ou
   sentier, via `trace_attributes` ;
2. nombre de demi-tours (manœuvres de demi-tour) et longueur
   d'allers-retours (tracé qui repasse sur lui-même) ;
3. part de l'itinéraire à moins de 25 m de la référence ;
4. distance et D+ (même méthode qu'à l'essai 1).

### Règle de choix (fixée avant les mesures)

Maximiser la part sur piste ou sentier (moyenne R2 à R5) dans le cas
« 5 points », sous deux contraintes dans le cas « 2 km » : 0 demi-tour et
distance à ± 10 % de la référence pour R2 à R5. Si la règle donne un
résultat absurde, le dire au lieu de l'appliquer.

### Leviers (6 combinaisons au plus, en plus du réglage de l'essai 1)

- Points : contre les demi-tours (cap de la référence en chaque point,
  rayon d'accrochage, type `via`/`through`/`break_through`), d'après la
  documentation de Valhalla 3.9.1.
- Profil vélo : `use_roads`, `avoid_bad_surfaces`, `use_living_streets`,
  `use_hills`, autres réglages documentés.
- Fabrication des tuiles : lecture des tags OSM par Valhalla (script de
  transformation des tags) pour favoriser `highway=track`, `path` ouverts
  au vélo et les relations `route=mtb`.

### Livrables

- Cartes avant/après pour R1 à R5, dans les deux cas : réglage de l'essai 1
  et meilleur réglage côte à côte, dans `docs/essais/captures/`.
- Section « Essai 1-bis » dans le document de résultats.

Garde-fou : si aucune combinaison n'apporte de gain net, garder le
meilleur réglage, noter l'amélioration pour plus tard et s'arrêter.
