# ADR 0020 — Circuits balisés et trace modifiable

- Statut : accepté le 9 novembre 2026 par Émilien (proposé le même jour)
- Date : 2026-11-09 (phase 7, tâche T1 de [p07-circuits-balises](../phases/p07-circuits-balises.md))
- Complète l'[ADR 0003](0003-paquets-de-zone.md) (format de
  `trails.geojson`, voir son complément du 2026-11-09). Précise
  l'[ADR 0016](0016-itineraire-en-creation.md) (création),
  l'[ADR 0017](0017-infos-itineraire-calcul.md) (infos par tronçon) et
  l'[ADR 0019](0019-itineraires-gardes-et-gpx.md) (base, tronçons gardés,
  GPX). Suit les règles d'import des ADR 0011 et 0014 sans les changer.

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture). GPX veut dire « GPS Exchange Format » (format standard
d'échange de traces GPS). OSM veut dire OpenStreetMap (la carte libre et
collaborative).

## Contexte

- La spec validée fait foi : critères C1 à C16, les 6 choix du pilotage,
  et la décision d'Émilien sur la question 1 : **un GPX modifié remplace
  l'original**, son origine devient « GPX modifié le … ».
- Une **trace** est ici une ligne déjà ordonnée : la ligne d'un circuit
  balisé, ou le tracé d'un GPX importé. Le **geste** est « trace →
  itinéraire modifiable ».
- Ce que fait le code aujourd'hui (lu le 9 novembre 2026, commit `9edfa8b`) :
  - la fabrique (`zones/zonefactory/trails.py`) écrit, par circuit, ses
    voies **brutes** en `MultiLineString` (plusieurs lignes), dans l'ordre
    de la relation, chacune dans son sens OSM. Elle ne lit pas les rôles
    des membres : `parse_opl` coupe le texte au `@` qui les précède ;
  - un tronçon gardé (`KeptLeg`, `core/routes/reopen.ts`) a déjà une
    forme, une distance, une durée et une version de zone. `useLegResults`
    prend la forme gardée d'un tronçon dont les deux bouts ont exactement
    les mêmes coordonnées (`legKey`), sans calcul ;
  - la base est en version 1. La contrainte `CHECK` de la colonne `origin`
    n'accepte que `created` et `gpx` (`core/routes/migrations.ts`) ;
  - `draftTarget.ts` ne transmet qu'un numéro d'itinéraire à la création.
- **Essai jetable de T1**, en version finale (release), iPhone 17 (iOS 26.5)
  et émulateur Android 14, zone Nancy v5 (preuves hors dépôt :
  `vtt-nav-preuves/p07/t1-essai/LISEZMOI.md`) :
  - **A. Ordre strict : les deux circuits de Nancy sont refusés.**
    - Circuit 11656724 (sans nom, 100 voies) : une variante de 1 090 m à
      côté de 5 121 m entre les deux mêmes nœuds, une jonction en T (le
      bout d'une voie posé au milieu d'une autre), une impasse de 63 m.
    - Circuit 15712020 « Petite Suisse Lorraine à VTT » (144 voies) : une
      impasse de 152 m, et une boucle fermée de 144 m sur laquelle arrive
      une autre voie (jonction en T). Coupée à la jonction, elle donne
      deux côtés : 117 m gardés dans le tour, 27 m retirés.
    - **Règle tolérante** (couper aux jonctions en T, retirer impasses et
      petites boucles de moins de 500 m, garder la première branche d'une
      variante dans l'ordre de la relation) : deux boucles propres, de
      21 302 m et 34 865 m. C'est 1 153 m et 178 m de moins que
      `length_m` (somme des voies brutes). Les longueurs de l'essai sont
      mesurées sur une Terre de rayon 6 371 009 m.
  - **B. Toucher une ligne de 4 px** : `GeoJSONSource` de
    `@maplibre/maplibre-react-native` 11.5.0 a `onPress` et une `hitbox`
    (zone de toucher autour du doigt), 44 × 44 dp par défaut. Avec ce
    défaut, sur les deux plateformes : pile, 10 dp et 25 dp sélectionnent ;
    40 dp et plus ne sélectionnent pas. Un glisser qui part de la ligne
    déplace la carte sans sélectionner. La valeur 0 se comporte
    différemment sur iOS (comme le défaut) et sur Android.
  - **C. Brouillon venu d'une trace, rouvert par les tronçons gardés** :
    0 calcul d'itinéraire à l'ouverture, écart 0,000 m avec la ligne,
    longueur identique ; déplacer un point : 2 calculs ; « Annuler » :
    aucun calcul, écart 0,000 m. Découpage dans Jest : 1 à 2 ms pour 35 km
    (1 292 points), 10 à 11 ms pour 10 000 points. L'essai a compté la
    durée à 12 km/h, provisoirement. 35 marqueurs numérotés se chevauchent
    au zoom d'ouverture.
  - **D+ (montée)** : le LISEZMOI dit « 475 m sur iOS et 436 m sur Android
    pour le même tracé ». **Les captures disent autre chose** (§ 6) :
    ouverture depuis le départ du circuit, 478 m sur les deux plateformes ;
    après le déplacement du point 3, 475 m sur les deux ; après
    « Annuler », 478 m sur les deux. 436 m est la valeur d'Android avec
    l'autre départ (« le plus proche »). La capture iOS de ce départ montre
    « — » (calcul pas fini). **Le vrai constat : le même circuit, découpé
    depuis deux départs, donne 478 m et 436 m.**
  - Le code de l'essai (branche jetable `claude/p07-essai`, commit
    `384d458`) n'a pas été relu pour cet ADR : seulement ses sorties, ses
    scripts Python et ses captures.

## Décision

### 1. Le format de la ligne ordonnée dans `trails.geojson`

Le fichier garde sa forme : un `FeatureCollection` (collection d'objets
GeoJSON), un objet par circuit, sa géométrie `MultiLineString` des voies
brutes. La carte dessine toujours ces voies brutes : ce qui est balisé sur
le terrain. **Cinq propriétés s'ajoutent** à chaque circuit :

| Propriété | Type | Sens |
|---|---|---|
| `ordered` | liste de `[lon, lat]`, ou `null` | La ligne ordonnée, dans le sens du circuit, à 6 décimales, sans deux points de suite identiques. Boucle : le dernier point est égal au premier. `null` si le circuit est refusé (§ 2) |
| `loop` | booléen, ou `null` | Vrai si la ligne ordonnée est une boucle. `null` si refusé |
| `ordered_m` | entier, ou `null` | Longueur de la ligne ordonnée, en mètres, **sur la sphère de Valhalla** (rayon 6 378 160 m, la formule de `trackLengthM` de l'app). `null` si refusé |
| `removed_m` | entier, ou `null` | Longueur retirée des voies brutes (impasses, petites boucles, variantes, rôles écartés). 0 si rien. `null` si refusé |
| `refusal` | texte, ou `null` | Raison d'un refus : `parts`, `branches` ou `removedTooMuch` (§ 2). `null` si la ligne existe |

- Les propriétés actuelles ne changent pas : `osm_id`, `name`, `ref`,
  `network`, `colour`, `length_m`, `parts`, `max_gap_m`.
- **Un tableau de coordonnées**, pas une polyligne encodée (suite de points
  écrite en texte compact) : rien à coder en Python, ni à garder identique
  entre Python et TypeScript. Le fichier de Nancy passe d'environ 56 Ko à
  environ 110 Ko (2 317 points de plus). C'est peu.
- **La sphère de Valhalla** : la feuille du circuit et la création doivent
  montrer la même longueur (C7, à 10 m). Avec le rayon de l'essai, l'écart
  serait de 0,11 %, soit 39 m sur 35 km. Sur la sphère de Valhalla, les
  deux boucles de Nancy font environ 21 326 m et 34 904 m.
- **Zone ancienne** (v5 et avant) : la clé `ordered` est **absente**. L'app
  le reconnaît ainsi : clé absente = zone à mettre à jour ; clé à `null` =
  circuit refusé. Aucun numéro de format de plus.
- `formatVersion` reste 1 (ADR 0003, § 3) : on ajoute des champs, une app
  plus ancienne les ignore.
- Le catalogue et `zone.json` ne changent pas.

**Dans l'app**, `parseTrails(text)` (`core/trails/`) lit le fichier et ne
lève jamais d'erreur. Un circuit dont la ligne ordonnée est fausse
(coordonnées hors bornes, moins de 2 points) est traité comme refusé. Un
fichier illisible donne une liste vide : la carte s'affiche sans circuits.
La carte reçoit une **copie légère** du fichier, sans `ordered` : MapLibre
n'a pas à porter 2 300 points de propriétés.

### 2. La règle d'ordonnancement, dans la fabrique

**Pourquoi la règle stricte ne suffit pas.** La spec (C2) dit : « fourche,
variante → pas de ligne ordonnée ». Avec elle, aucun des deux circuits de
Nancy ne devient un itinéraire. La phase n'aurait rien à montrer. La
règle retenue est tolérante : elle garde le **tronc principal** et retire
les annexes courtes. Elle change C2 : Émilien l'a accepté (réponse 1).

**Étapes**, pour chaque relation `route=mtb` :

1. **Membres, dans l'ordre de la relation.** Les sous-relations sont
   suivies dans l'ordre, chacune une seule fois (comme aujourd'hui).
   `parse_opl` garde désormais le **rôle** de chaque membre.
2. **Rôles écartés** : un membre de rôle `alternative` (variante balisée),
   `excursion` (aller-retour vers un point de vue), `approach` (accès
   depuis une gare ou un parking) ou `connection` (liaison vers un autre
   circuit) est retiré. Ce sont les rôles des itinéraires de loisir du
   wiki OSM. Un rôle posé sur une sous-relation vaut pour toutes ses
   voies. Rôle vide ou `main` : gardé. `forward` et `backward` (voie
   parcourue dans un seul sens) : gardés comme les autres.
3. **Coupe aux nœuds partagés** : une voie est coupée à chaque nœud OSM de
   son milieu qu'utilise aussi une autre voie du circuit (jonction en T,
   croisement). On compare des **numéros de nœuds**, pas des coordonnées.
4. **Graphe** : les morceaux de voies sont des arêtes, les nœuds de
   jonction des sommets. Les suites de nœuds de degré 2 forment des
   **chaînes**.
5. **Retraits**, répétés jusqu'à ce que plus rien ne change :
   - **impasse courte** : chaîne de moins de 500 m dont un bout est libre
     (degré 1) et l'autre une jonction (degré 3 ou plus) ;
   - **petite boucle** : chaîne de moins de 500 m qui part d'une jonction
     et y revient ;
   - **variante** : plusieurs chaînes entre les deux mêmes jonctions. On
     garde celle dont la première voie vient en premier dans l'ordre de la
     relation. Les autres sont retirées, quelle que soit leur longueur.
6. **Contrôles, sinon refus** :

   | Refus (`refusal`) | Quand |
   |---|---|
   | `parts` | le circuit est en plusieurs morceaux (`parts` > 1), avant ou après les retraits |
   | `branches` | après les retraits, le graphe n'est ni un chemin simple (deux bouts libres) ni une boucle simple : fourche à branches longues, impasse de 500 m ou plus (aller-retour sur la même voie, en « sucette »), croisement en 8 (nœud de degré 4) |
   | `removedTooMuch` | les retraits dépassent **15 %** de `length_m`. Garde-fou : au-delà, la ligne ne serait plus « le circuit » |

7. **Parcours et sens** : on suit le chemin ou la boucle d'un bout à
   l'autre. Le sens est celui de la relation : la première voie gardée
   (dans l'ordre de la relation) est parcourue avant la deuxième. Une
   boucle commence au début de la première voie gardée, tournée vers la
   deuxième. Une seule voie : son sens OSM.
8. **Contrôle des rôles de sens** : si la ligne parcourt une voie
   `forward` à l'envers (ou `backward` à l'endroit), le rapport de la
   fabrique l'écrit. Pas de refus : le sens de la relation reste la règle.
9. **Rapport** : chaque retrait est écrit (raison, nombre de voies,
   longueur), comme dans `sortie-A-tolerant.txt`. On le relit à chaque
   nouvelle zone.

**Résultat attendu sur Nancy** (essai A) : deux boucles. 5,1 % retirés
pour le circuit 11656724 (dont la branche de 1 090 m : la relation liste
d'abord celle de 5 121 m), 0,5 % pour la Petite Suisse Lorraine. Les rôles
n'ont pas été lus par l'essai : s'ils marquent déjà la variante comme
`alternative`, l'étape 2 la retire avant l'étape 5. Le résultat est le
même.

**Seuils** (constantes de `trails.py`) : `MAX_ANNEX_M = 500`,
`MAX_REMOVED_SHARE = 0.15`. 500 m vient de l'essai : c'est bien plus que
les annexes de Nancy (27 à 152 m), et bien moins qu'une vraie branche
(1 km et plus).

**Cas de test `pytest`** (données fabriquées en texte OPL, le format texte
d'osmium, sauf le dernier) :

| # | Cas | Attendu |
|---|---|---|
| 1 | Chemin simple, voies dans l'ordre | ligne, `loop` faux |
| 2 | Une voie à l'envers | ligne continue, même sens |
| 3 | Membres dans le désordre | ligne continue ; sens selon la règle 7 |
| 4 | Boucle simple | `loop` vrai, premier point = dernier |
| 5 | Sous-relation (et sous-relation qui se contient elle-même) | voies suivies dans l'ordre, sans boucle infinie |
| 6 | Jonction en T | coupée, ordonnée |
| 7 | Impasse de 499 m / de 500 m | retirée, `removed_m` / refus `branches` |
| 8 | Petite boucle de 144 m sur une jonction | retirée |
| 9 | Variante entre deux jonctions | première de la relation gardée |
| 10 | Rôle `alternative` (sur une voie, puis sur une sous-relation) | retiré avant la topologie |
| 11 | Rôle `forward` parcouru à l'envers | ligne gardée, ligne d'alerte dans le rapport |
| 12 | Fourche en Y, trois branches de 2 km | refus `branches` |
| 13 | Croisement en 8 | refus `branches` |
| 14 | Aller-retour en « sucette » (tige de 1 km) | refus `branches` |
| 15 | Morceaux séparés | refus `parts` |
| 16 | Retraits de 16 % | refus `removedTooMuch` |
| 17 | Voie listée deux fois ; voie absente de l'extrait | dédoublonnée ; `parts` si un trou se crée |
| 18 | Format : clés toujours présentes, 6 décimales, pas de doublon consécutif, `ordered_m` sur la sphère de Valhalla (comparé à une valeur calculée à la main) | conforme |
| 19 | **Non-régression Nancy** : les voies brutes des deux circuits, tirées de `trails.geojson` v5 (fichier de test) | deux boucles ; longueurs à 1 m de la valeur de l'essai convertie sur la sphère de Valhalla |

### 3. La règle du découpage (logique pure, `core/routes/traceDraft.ts`)

**Espacement : partage égal.** Pour une trace de longueur `L` (mètres,
`trackLengthM`) :

- nombre de tronçons `n = round(L / 1000)`, **au moins 1, au plus 50** ;
- les points de passage sont aux distances `k × L / n` le long de la
  trace, pour `k` de 0 à `n` ;
- tous les tronçons ont la même longueur, entre 667 m et 2 km jusqu'à
  50 km. Au-delà de 50 km, l'écart grandit (100 km : un point tous les
  2 km) ;
- **aucun point intermédiaire hors de la zone** (§ 5) : un point (`k` de
  1 à `n − 1`) qui tombe hors du rectangle de la zone tenue n'est pas
  posé. Ses deux morceaux voisins n'en font qu'un. Le départ (`k = 0`) et
  l'arrivée (`k = n`) sont toujours posés, même hors de la zone : ce sont
  les bouts de la trace.

Pourquoi le partage égal : un dernier tronçon de 30 m (avec « un point
tous les 1 000 m pile ») serait inutile et gênant à toucher. Pourquoi 50
au plus : 51 marqueurs (vues natives) à l'écran, et 150 requêtes à
l'ouverture (§ 10). Le glisser reste à mesurer avec 51 points (contrôle 4).

**Points posés sur la trace.** Un point tombe en général au milieu d'un
segment. On l'interpole en ligne droite entre les deux points voisins
(segments courts : l'erreur est négligeable), puis on l'**arrondit à 6
décimales**. Ce même point arrondi est à la fois le point de passage, la
fin du morceau `k − 1` et le début du morceau `k`. Ainsi :

- le brouillon et les formes gardées ont exactement les mêmes bouts
  (`legKey` les retrouve) ;
- l'encodage en polyligne à 6 décimales (base, ADR 0019) ne change aucun
  point ;
- le point est à 0,11 m au plus de la trace (C7 demande 1 m).

Un morceau = le point de début, les points de la trace strictement entre
les deux distances, le point de fin. Deux points de suite identiques n'en
font qu'un.

**Aller simple** : départ au début de la ligne ordonnée. Toujours (choix 4
du pilotage).

**Boucle** (circuit avec `loop` vrai) :

- départ = le point de la ligne **le plus proche de la position** de
  l'utilisateur : projection sur chaque segment, distance calculée dans un
  plan local (longitudes multipliées par le cosinus de la latitude). Pas
  de limite de distance : à 30 km du circuit, c'est encore le point le
  plus proche de chez soi ;
- position inconnue (refusée, pas encore reçue) : départ au début de la
  ligne. On n'attend pas le GPS : on prend la dernière position connue
  de l'onglet Carte (`useMapPosition`), au moment du toucher ;
- **rotation** : le départ `S` (arrondi à 6 décimales) coupe la ligne. La
  nouvelle ligne est `S`, la fin de la ligne, puis son début, jusqu'à `S`.
  Le point de jonction (premier = dernier) n'apparaît qu'une fois. La
  longueur ne change pas. Le contrôle 1 a prouvé cette rotation juste,
  avec un seul défaut à éviter : quand `S` tombe pile sur un sommet de la
  ligne, l'essai répétait ce sommet (un segment de longueur nulle). T3
  ne le répète pas ;
- le brouillon d'une boucle finit sur un point aux coordonnées du départ,
  avec un autre `id`, comme « Boucler » (ADR 0016).

**GPX** : départ au début du fichier, toujours, même si le tracé revient
au départ. C'est le tracé de l'utilisateur ; on ne le fait pas tourner.

**Cas limites** :

| Cas | Règle |
|---|---|
| Trace de moins de 1 500 m | `n = 1` : départ et arrivée seulement |
| Trace de 2 points | un tronçon, la ligne droite du fichier |
| Trace de plus de 50 km | 50 tronçons |
| GPX de 10 000 points | même règle ; chaque morceau garde tous ses points |
| GPX de 150 000 points (20 Mo) | 50 morceaux de 3 000 points : sous la limite de 16 000 points de `trace_attributes` (ADR 0019, § 5) |
| Aller-retour sur le même chemin | `legKey` a un sens (départ puis arrivée) : l'aller et le retour ont des clés différentes |

`traceToDraft(line, { loop, position, zoneVersion, bbox })` rend
`{ state, kept }`, sur le modèle de `reopenDraft` : l'état de départ du
Store (historique vide) et les tronçons gardés. `bbox` est le rectangle
de la zone tenue.

**Tests attendus de T3** (Jest, logique pure) :

| Test | Attendu |
|---|---|
| Partage égal : 1 400 m, 1 500 m, 35 km, 50 km, 100 km | `n` = 1, 2, 35, 50, 50 ; tronçons de même longueur |
| Points posés | à 6 décimales, à 0,11 m au plus de la trace ; fin du morceau `k − 1` = début du morceau `k` |
| Fidélité (C7) sur les deux circuits de Nancy | morceaux mis bout à bout = la trace ; somme des distances = `trackLengthM` à 10 m |
| Rotation d'une boucle, départ au milieu d'un segment, puis **pile sur un sommet** | même longueur, même suite de sommets ; **aucun point en double**, aucun segment de longueur nulle |
| Position inconnue ; aller simple ; GPX qui revient au départ | départ au début de la ligne |
| **Trace qui sort de la zone puis y revient** | aucun point posé hors du rectangle ; un seul tronçon gardé entre le dernier point dans la zone et le suivant dans la zone |
| **Départ, ou arrivée, hors de la zone** | le bout est posé ; un seul tronçon gardé jusqu'au premier (ou depuis le dernier) point dans la zone |
| Trace entièrement hors de la zone | départ et arrivée seulement, un tronçon gardé |
| Cas limites du tableau ci-dessus | règle du tableau |
| `findProblem` à l'ouverture d'un brouillon qui sort de la zone (§ 5) | aucun problème |
| Groupes d'altitudes (`heightGroups`, § 6) | une suite de tronçons `trace` non touchés = un groupe ; un tronçon touché coupe la suite en deux |

### 4. Les tronçons gardés venus d'une trace

Le type `KeptLeg` a déjà tout ce qu'il faut : forme, distance, durée,
version de zone. Pour un morceau de trace :

| Champ | Valeur | Pourquoi |
|---|---|---|
| `shape` | le morceau (§ 3) | le tracé ne change pas (C7) |
| `distanceKm` | `trackLengthM(morceau) / 1000` | même formule que la feuille et qu'un GPX : la somme des morceaux égale la longueur de la trace (C7, C11) |
| `durationS` | distance à **10 km/h** (`HAND_SPEED_KMH`) | voir plus bas |
| `zoneVersion` | version de la zone tenue (prise de la création) | le tronçon a été posé avec cette version |
| `trace` (**nouveau**) | `true` | dit que la forme ne vient pas du moteur |

**La durée : 10 km/h.** C'est la règle d'un tracé sans calcul : tronçon à
la main sans tronçon calculé (ADR 0016, § 1) et GPX importé (ADR 0019,
réponse 6 d'Émilien du 3 novembre). Raisons :

- un GPX garde la même durée avant et après le geste. Avec une autre
  vitesse, un GPX non touché changerait de durée en devenant itinéraire ;
- une seule règle pour « tracé que le moteur n'a pas calculé » ;
- demander la durée au moteur ferait 35 calculs à l'ouverture, contraire
  à C7.

Conséquence connue : un circuit de 35 km affiche 3 h 30, alors que le même
tracé calculé par le moteur donnerait environ 2 h 15. Un tronçon déplacé
est recalculé par le moteur, avec sa propre durée, plus courte. La durée
totale baisse un peu à chaque retouche. C'est la limite déjà acceptée pour
les GPX (ADR 0019, question ouverte 2).

**Le marqueur `trace`.**

- Dans la base : `legs` gagne le champ facultatif `"trace": true` pour un
  tronçon calculé venu d'une trace :
  `{"mode":"path","zoneVersion":6,"distanceKm":0.996,"durationS":359,"shape":"…","trace":true}`.
  Absent = forme du moteur. `rowToRoute` refuse une autre valeur que
  `true`.
- **Dans la clé des infos** (ADR 0019, § 5) : `shapeVersion` vaut
  `"trace:6"` au lieu de `6`. Raison : l'ADR 0019 justifie la clé par « le
  moteur donne toujours la même forme pour la même version et les mêmes
  points ». C'est faux pour un morceau de trace : sa forme n'est pas celle
  du moteur. Sans le marqueur, un calcul du moteur entre les deux mêmes
  points, sur la même version, partagerait la clé et donnerait au morceau
  le D+ d'une autre forme. Le cas est très rare (points interpolés), mais
  la règle de la clé redevient vraie pour un prix minime.
- `reopenDraft` recopie `trace` dans le tronçon gardé. Le marqueur ne
  change rien d'autre : un tronçon `trace` se comporte comme un tronçon
  gardé (ADR 0019, § 4).

### 5. Un circuit ou un GPX qui sort de la zone (C8, risque 4)

Un tronçon est **hors zone** si un de ses points sort du rectangle de la
zone tenue.

**Choix du designer, retenu (maquette 12, écran 8) : aucun point de
passage hors de la zone.** Un point qu'on ne peut pas déplacer serait un
piège. Au découpage (§ 3), un point intermédiaire qui tomberait hors du
rectangle n'est pas posé. La partie hors zone devient donc **un seul
tronçon gardé `trace`**, entre le dernier point dans la zone et le
suivant dans la zone.

**Départ ou arrivée hors de la zone.** Ce sont les bouts de la trace : ils
sont toujours posés, même hors de la zone. Sinon le tracé ne serait plus
entier (C7). Le tronçon hors zone va alors du bout jusqu'au premier point
dans la zone (ou du dernier point dans la zone jusqu'au bout).

- Un GPX n'a ce cas qu'à l'arrivée : un GPX dont le départ est hors zone
  n'a pas de zone, donc pas de « Modifier » (§ 8).
- Un circuit peut commencer hors de la zone : aller simple qui y entre,
  ou boucle dont le départ choisi (le plus proche de la position, ou le
  début de la ligne) est hors de la zone. Même règle, rien de plus : le
  départ est posé là. On ne cherche pas un autre départ dans la zone.

| Moment | Ce qui se passe |
|---|---|
| Ouverture | Les tronçons hors zone gardent leur forme. Ils sont dessinés sous le voile, et leur distance et leur durée comptent. Une bulle, 6 s, à l'ouverture seulement : `trails.outsideBubble`, « Une partie du tracé sort de la zone. Elle reste telle quelle : on ne peut pas la modifier. » Pour un circuit, à la place de la bulle d'ouverture ; pour un GPX, après sa bulle (maquette 12, textes) |
| Infos | `infoShape` contrôle aussi le rectangle pour un tronçon `trace`, comme pour un tronçon à la main (ADR 0017, § 5). Un seul tronçon hors zone : « Altitudes indisponibles » et « Terrain indisponible » pour tout l'itinéraire (tout ou rien, réponse 1 d'Émilien du 28 octobre ; cas `leaves` de l'ADR 0019). La feuille de création montre « — » pour le D+ |
| Déplacer un point voisin du tronçon hors zone, quand l'autre bout de ce tronçon est **le départ ou l'arrivée hors zone** | Le nouveau tronçon a un bout hors zone : le moteur le refuse avant tout calcul (`outOfZone`). La feuille existante « Point hors de votre zone » (v1/52) s'ouvre : « Relier ce point à la main » ou « Retirer ce point » (ADR 0016, § 5). « Annuler » rend le tronçon gardé |
| Déplacer un point voisin du tronçon hors zone, quand ce tronçon **sort puis revient** dans la zone | Les deux bouts du nouveau tronçon sont dans la zone : le moteur le calcule, **dans la zone**. La partie hors zone disparaît du tracé. C'est visible sur la carte, et « Annuler » rend le tronçon gardé |
| Glisser ou poser un point hors de la zone | Même refus `outOfZone`, même feuille (v1/52) |
| Tronçons dans la zone | Se modifient normalement |

- Pas de feuille d'erreur à l'ouverture : `findProblem` vise le point de
  la dernière action, et il n'y en a pas encore. Un test le prouve.
- Raison de ne rien inventer : la création sait déjà refuser un point hors
  zone. Les seuls ajouts sont l'exclusion au découpage, la bulle et le
  contrôle du rectangle dans `infoShape`.

### 6. Le D+ (C11) : une requête par suite de tronçons non touchés

**Ce que C11 compare.** Sur la **même plateforme**, avant et après le
geste, sans aucune retouche :

- **GPX** : le D+ de son écran Infos (le tracé entier en une requête
  `height`, éclairci à 14 000 points, ADR 0019, § 5) et le D+ de la
  création ouverte par « Modifier » (une requête par tronçon, profils
  joints, ADR 0017, § 4). Écart permis : 5 m. La distance : 10 m ;
- **circuit** : la feuille ne montre pas de D+ (maquette 12). On compare
  le D+ de la création au D+ de la ligne ordonnée entière en une requête,
  la méthode d'un GPX. Pour une boucle : la ligne tournée depuis le même
  départ. La distance : `trackLengthM(ordered)` de la feuille et la somme
  des tronçons de la création.

C11 ne compare pas iOS et Android. La phase 5 a prouvé le même D+ sur les
deux plateformes et sur le Mac pour la même requête (ADR 0017).

**L'écart de l'essai.** Les captures montrent :

| Brouillon | iOS | Android |
|---|---|---|
| Départ du circuit, ouverture | 478 m | 478 m |
| Après déplacement du point 3 | 475 m | 475 m |
| Après « Annuler » | 478 m | 478 m |
| Départ « le plus proche » (rotation) | « — » (pas fini sur la capture) | 436 m |

Rien ne montre donc un écart entre plateformes. Le constat est autre :
**le même circuit, coupé à d'autres endroits, perd 42 m de D+ (−9 %).**
Le tracé est pourtant le même (écart 0,000 m, même longueur).

**Ce que le contrôle 1 a prouvé** (9 novembre, banc jetable sur le Mac,
Valhalla 3.9.1, Nancy v5, avec les fonctions de l'app ; preuves hors
dépôt : `vtt-nav-preuves/p07/controle1/LISEZMOI.md`) :

- **La cause est le calcul, pas la rotation.** `height` prend une
  altitude tous les 30 m depuis le début de chaque requête. Le seuil de
  5 m est sensible à ces échantillons. Couper ailleurs, ou commencer
  ailleurs, change le D+.
- Même la ligne entière, en une requête, varie avec son départ : 433 à
  494 m sur 12 départs, 437 à 488 m sur 40. Pour un même départ,
  « tronçons moins ligne entière » va de −42 à +31 m, et dépasse 5 m dans
  28 cas sur 36. Le constat de l'essai (478 et 436 m) est rejoué à
  l'identique.
- Un GPX réel de 10 000 points : 0 à 10 m d'écart entre une requête et
  le découpé. C11 était donc aussi en danger pour un GPX.
- La rotation de la boucle est juste : même suite de sommets, même
  longueur au millimètre, aucun demi-tour. Un seul défaut, sans effet sur
  le D+ : un point en double, de longueur nulle, à la jonction. T3 doit
  l'éviter, et un test le prouve (§ 3).

**Décision : parade (b), une seule requête d'altitudes par suite de
tronçons `trace` jamais touchés.**

- Un **groupe d'altitudes** est une suite, la plus longue possible, de
  tronçons consécutifs `trace` dont la forme gardée est prise telle
  quelle. Tout autre tronçon (calculé, à la main, ou `trace` recalculé)
  est un groupe à lui seul, comme aujourd'hui.
- Une requête `height` par groupe, sur la forme jointe de ses tronçons
  (point de jonction une seule fois). Au-delà de 14 000 points, elle est
  éclaircie par `thinTrack` (`core/routes/track.ts`), comme le tracé d'un
  GPX (ADR 0019, § 5).
- **Sans retouche, le D+ est exactement celui de la trace d'origine** :
  écart 0 m dans 18 cas sur 18 (6 départs × 3 espacements). C'est la même
  requête. C11 tient donc avec son seuil de 5 m.
- **Après une retouche, le D+ est un ordre de grandeur.** Les suites
  avant et après le tronçon touché repartent chacune de zéro. Écart
  mesuré : −40 à +21 m, environ ±6 %. **Accepté pour la v1.** Pas de
  lissage des altitudes, pas de nouvelle mesure : « plus tard, peut-être
  jamais » (spec, hors périmètre).
- Le même circuit, ouvert depuis deux départs, peut montrer deux D+
  différents (437 à 488 m). C'est le même bruit, accepté de même.

**Où (b) se branche** (code lu le 9 novembre) :

| Fichier | Changement |
|---|---|
| `core/route-info/heightGroups.ts` (nouveau, T3) | `heightGroups(legs)` : les groupes, en indices de tronçons. Logique pure, testée dans Jest |
| `features/map/useLegResults.ts` | l'état d'un tronçon pris de sa forme gardée porte déjà `shapeVersion` ; il porte aussi `trace` |
| `features/map/useLegInfos.ts` | une requête `height` par groupe, au lieu d'une par tronçon. Sa clé : la zone, les points de passage du groupe dans l'ordre, et `trace:N`. Les requêtes de terrain restent par tronçon |
| `core/routing/infoRequest.ts`, `core/routing/infoResponse.ts` | **rien** : `buildHeightRequest` et `parseHeightResponse`, appelées par `computeHeights`, reçoivent simplement une forme plus longue |
| `core/route-info/routeInfo.ts` | `summarizeInfo` reçoit un profil par groupe. `joinProfiles` (`core/route-info/profile.ts`) les joint sans changement, puis `heightsOf` et `ascentDescent` donnent le D+. La bande de terrain se place le long du profil avec la longueur de la forme de chaque tronçon, et non plus celle de son profil |

L'écran Infos d'un itinéraire gardé passe par les mêmes fonctions : un
circuit enregistré sans retouche y garde le même D+.

**Si (b) devient coûteuse à coder** (plus que ces fichiers, ou un
changement visible de l'écran Infos), le développeur s'arrête et le
pilotage décide.

### 7. La base passe en version 2

**Deux origines de plus**, de la même forme qu'un itinéraire créé
(`draft`, `legs`, zone obligatoire) :

| `origin` | Quand | Texte de la liste (maquette 40, écran 9a) |
|---|---|---|
| `created` | itinéraire créé point par point | « créé le … » ou « modifié le … » (inchangé) |
| `gpx` | GPX importé, jamais modifié | « GPX importé le … » (inchangé) |
| `trail` | « Enregistrer » d'un circuit balisé | jamais réenregistré : « circuit balisé, le {date de `created_at`} » (`routes.originTrail`) ; réenregistré : « circuit modifié le {date de `saved_at`} » (`routes.originTrailModified`) |
| `editedGpx` | « Enregistrer » d'un GPX ouvert par « Modifier » | « GPX modifié le {date de `saved_at`} » (`routes.originGpxModified`) |

- **« Jamais réenregistré »** se décide comme pour `created` (ADR 0019,
  § 1) : `saved_at` égale `created_at`. Le premier « Enregistrer » écrit
  les deux dates du même instant. Un circuit retouché avant ce premier
  « Enregistrer » reste donc « circuit balisé, le … » (règle du designer).
- Dans le code : `originText` (`core/routes/routeText.ts`) et `originOf`
  (`core/routes/routeList.ts`, la date qui décide d'afficher l'année)
  reçoivent les deux origines, avec la même comparaison.

- **GPX modifié (question 1 tranchée)** : la même ligne est remplacée, en
  un seul `UPDATE` : `origin = 'editedGpx'`, `draft`, `legs`, zone (celle
  tenue), `preview`, chiffres, `saved_at`. **`track` et `elevations`
  passent à `NULL`** : le tracé est désormais dans `legs` (les tronçons
  non touchés gardent tous les points du fichier). Les altitudes du
  fichier sont perdues ; l'export d'un itinéraire de cette forme demande
  les altitudes au moteur (ADR 0019, § 8). Le nom et `created_at` (date
  d'import) ne changent pas.
- Une ligne `trail` ou `editedGpx` rouverte par « Modifier » garde son
  origine à chaque « Enregistrer ». « modifié le » vient de `saved_at`,
  comme aujourd'hui. « Modifier » écrase toujours la ligne rouverte ; pour
  garder l'original, on le duplique d'abord (§ 7 bis).
- Pas de colonne pour le numéro OSM du circuit : aucune fonction de la v1
  ne s'en sert.
- Dans le code : `RouteOrigin = 'created' | 'gpx' | 'trail' | 'editedGpx'`.
  `CreatedRoute` porte `origin: 'created' | 'trail' | 'editedGpx'`.
  Attention au mot : `trail` désigne aussi la part « Sentier » du terrain
  (`core/route-info/terrain.ts`). Les deux types ne se croisent pas.

**La migration `MIGRATIONS[1]`.** SQLite ne sait pas changer une
contrainte `CHECK` : il faut reconstruire la table. Méthode de la doc de
SQLite (« autres changements de schéma »), dans la transaction exclusive
de `migrate` (ADR 0019, § 2) :

1. `CREATE TABLE routes_new (…)` : la table de l'ADR 0019, § 1, avec
   `origin IN ('created', 'gpx', 'trail', 'editedGpx')` et
   `CHECK ((origin IN ('created', 'trail', 'editedGpx') AND draft IS NOT NULL AND legs IS NOT NULL AND track IS NULL AND elevations IS NULL AND zone_id IS NOT NULL) OR (origin = 'gpx' AND track IS NOT NULL AND draft IS NULL AND legs IS NULL))`.
   Le reste est identique, `STRICT` et `AUTOINCREMENT` compris ;
2. `INSERT INTO routes_new (<les 18 colonnes>) SELECT <les 18 colonnes> FROM routes` ;
3. recopier le compteur d'`AUTOINCREMENT` : la ligne de `routes` dans
   `sqlite_sequence` donne sa valeur à celle de `routes_new`. Sinon, après
   une suppression des derniers itinéraires, un numéro pourrait resservir
   (règle de l'ADR 0019, § 1) ;
4. `DROP TABLE routes`, puis `ALTER TABLE routes_new RENAME TO routes` ;
5. `PRAGMA user_version = 2` (fait par `migrate`).

Pas de clé étrangère, pas d'index, pas de vue, pas de déclencheur : rien
d'autre à recréer. `MIGRATIONS[0]` ne change pas.

**Tests (C9)**, sur `node:sqlite` comme en phase 6 :

| Test | Attendu |
|---|---|
| Base version 1 avec un itinéraire créé, un GPX avec altitudes, un GPX sans zone, et un itinéraire supprimé (le plus grand numéro) | version 2 ; chaque ligne relue identique, colonne par colonne ; `rowToRoute` rend les mêmes objets |
| Après la montée, insérer une ligne | son numéro dépasse le plus grand jamais donné |
| Nouvelles contraintes | acceptent `trail` et `editedGpx` avec `draft` et `legs` ; refusent `trail` sans `draft`, `trail` avec `track`, `editedGpx` sans zone, une origine inconnue |
| Base neuve | passe de 0 à 1 puis à 2 ; même schéma qu'une base montée (comparaison de `sqlite_master`) |
| Échec au milieu de la migration 2 (ordre faux injecté) | version 1, table et lignes intactes |
| Ouvrir deux fois | rien ne change |
| Base version 99 | « trop récente », rien n'est écrit |
| GPX remplacé (`UPDATE`) | même `id`, même nom, même `created_at` ; `origin` `editedGpx`, `track` et `elevations` à `NULL` |

### 7 bis. « Dupliquer » (C16, tâche T6)

**Où.** Une entrée « Dupliquer » dans le menu d'un itinéraire, **juste
après « Renommer »** : le « ⋮ » de la ligne, l'appui long sur la ligne,
et le « ⋮ » de l'écran Infos. Pour toutes les origines : `created`,
`gpx`, `trail`, `editedGpx`. Le menu devient : Renommer, Dupliquer,
Exporter en GPX, Supprimer (maquette 40, écran 3).

**Le menu sur Android.** `Alert.alert` n'accepte que 3 boutons sur
Android (doc de React Native). Le menu de l'ADR 0019 (§ 13, point 4) les
utilise déjà tous. Avec 4 actions, sur Android, le menu devient une
feuille du bas écrite en React Native (`Modal`, sur le modèle de
`RenameSheet`) : aucun module nouveau. iOS garde
`ActionSheetIOS`, avec une option de plus. Voir le contrôle 6.

**Le nom de la copie** : « <nom> (copie) », sinon « <nom> (copie 2) »,
« <nom> (copie 3) »… Le premier nom libre parmi ceux de la liste
(comparaison exacte, comme `uniqueDefaultName`).

- **60 caractères au plus** (règle de l'ADR 0019, § 11, comptés en
  points de code) : le suffixe tient toujours entier. Si besoin, on
  raccourcit le nom de base à `60 − longueur du suffixe`, puis on retire
  l'espace de fin.
- **Un original qui s'appelle déjà « X (copie) »** : on ne lit pas le
  nom. Sa copie s'appelle « X (copie) (copie) ». C'est la règle la plus
  simple : une seule règle, sans analyse du texte.
- `copyName(name, existing)` dans `core/routes/routeName.ts`. Les deux
  formes du suffixe sont des textes de `fr.ts`.

**L'écriture** : `duplicateRoute(db, id, now)` dans
`core/routes/routeRepo.ts`. Une seule transaction exclusive : lire les
noms, choisir le nom, puis

```sql
INSERT INTO routes (name, origin, created_at, saved_at, zone_id, zone_version, zone_name,
                    draft, legs, track, elevations, preview, distance_km, duration_s,
                    ascent_m, descent_m, figures_at)
SELECT ?, origin, ?, ?, zone_id, zone_version, zone_name,
       draft, legs, track, elevations, preview, distance_km, duration_s,
       ascent_m, descent_m, figures_at
FROM routes WHERE id = ?
```

- Nouvel `id` (`AUTOINCREMENT`). Toutes les colonnes de l'original sont
  reprises : origine, tracé, `track`, `elevations`, `draft`, `legs`,
  chiffres, `figures_at`, `preview`. Sauf `name`, et `created_at` =
  `saved_at` = l'instant de la copie.
- Rend le nouvel `id`, ou `null` si l'original n'existe plus (rien
  d'écrit).
- La transaction évite que deux copies rapides prennent le même nom.
- Une ligne illisible se copie telle quelle : la copie est illisible
  aussi, et se renomme ou se supprime comme elle.

**Conséquences, acceptées** :

- Ses deux dates étant égales, une copie dit toujours la date de la
  copie : « créé le … », « GPX importé le … », « circuit balisé, le … ».
  **Une copie d'un circuit modifié s'affiche « circuit balisé, le … »** ;
  une copie d'un GPX modifié reste « GPX modifié le … ».
- Elle arrive **en haut de la liste** (tri par `saved_at`).
- Depuis la liste, on reste sur la liste. **Depuis l'écran Infos, on
  revient à la liste**, la copie en haut (écran 9c de la maquette 40,
  choix du pilotage du 9 novembre) : rester sur l'Infos de l'original ne
  montrerait aucune trace de la copie. Pas de bulle ; une annonce vocale
  pour le lecteur d'écran (`routes.duplicatedAnnounce`). Si la liste était
  défilée, elle remonte en haut.
- **« Modifier » écrase toujours la ligne rouverte** (règle confirmée).
  Dupliquer puis modifier la copie laisse l'original intact : c'est C16.

**Place du code** : `core/routes/` (`copyName`, `duplicateRoute`) ;
`shared-data/routes/useRoutes.ts` (action `duplicate`, qui invalide
`['routes']` : liste et comptes par zone) ; `ui/openActionMenu.ts` et
`ui/useRouteMenu.tsx` (l'entrée, et la feuille d'Android) : c'est là
qu'est le menu commun à la liste et à l'écran Infos (ADR 0019, § 3) ;
`features/routes/RoutesScreen.tsx` et
`features/map/SavedRouteInfoScreen.tsx` passent l'action ;
`core/i18n/fr.ts`.

**Tests (C16)**, sur `node:sqlite` :

| Test | Attendu |
|---|---|
| Dupliquer un itinéraire de chaque origine (dont un GPX avec altitudes et un GPX sans zone) | nouvel `id`, plus grand que tous ; chaque colonne égale à l'original, sauf `name`, `created_at` et `saved_at` (= l'instant donné) |
| Noms | « (copie) », puis « (copie 2) » ; premier numéro libre ; « X (copie) » donne « X (copie) (copie) » ; nom de 60 caractères (avec un emoji) : base raccourcie, suffixe entier, 60 au total |
| Ordre | `listRoutes` rend la copie en premier |
| Original absent | `null`, rien d'écrit |
| **Modifier la copie** (`UPDATE` d'un itinéraire, puis d'un GPX vers `editedGpx`) | l'original est identique, colonne par colonne |
| Copie d'un circuit modifié | « circuit balisé, le … » |

Plus un **parcours Maestro** : dupliquer depuis la liste, ouvrir la
copie, « Modifier », déplacer un point, « Enregistrer » ; l'original
garde sa distance dans la liste.

### 8. « Modifier » d'un GPX importé (C10)

**Où** : l'écran Infos d'un GPX (`SavedRouteInfoScreen`).

**Quand le bouton apparaît** : selon `routeZoneStatus` (ADR 0019, § 6).

| Cas | « Modifier » |
|---|---|
| `usable` (dans la zone en service) | oui |
| `leaves` (départ dans la zone, sort ensuite) | oui ; les tronçons hors zone gardent leur tracé (§ 5) |
| `outside` (pas de zone) | non ; la carte « hors zone » de l'écran dit déjà pourquoi et propose « Voir les zones » |
| `deleted`, `notInService` | non, comme pour un itinéraire créé |

Un GPX qui part hors zone puis y entre n'a pas de zone (règle du départ,
ADR 0019, § 6) : il n'a pas le bouton. C'est cohérent avec ce qu'affiche
déjà son écran Infos.

**Le geste** : `setDraftTarget({ kind: 'gpx', id })`, puis
`router.push('/draft')`. `DraftSession` lit le GPX, prend sa prise de
zone, contrôle que la zone tenue est celle du GPX, puis
`traceToDraft(route.track, { loop: false, position: null, zoneVersion, bbox })`.
Même découpage, même fidélité (C7).

**À l'ouverture** : une bulle de 6 s dit que l'enregistrement remplace
l'original (`gpx.placedBubble`, maquette 40, écran 9b). Pas de boîte de
confirmation (réponse 8).

**« Enregistrer »** :

- avec des changements : l'`UPDATE` du § 7, puis l'écran `/route/[id]`
  du même itinéraire, relu ;
- **sans aucun changement** : rien n'est écrit, l'écran Infos du GPX
  revient. Raison : sinon un GPX deviendrait « modifié » sans l'être, et
  perdrait ses altitudes de fichier ;
- fermer avec des changements : « Abandonner les changements ? »
  (ADR 0019, § 4). Le GPX reste intact.

### 9. La couche des circuits, le toucher et la feuille (C4, C5)

**Lecture** : `useTrails(zone)` (`features/map/`), sur le modèle de
`useDifficultyTable` : une lecture de `trails.geojson` par version de
zone, gardée en mémoire (`staleTime` et `gcTime` infinis), puis
`parseTrails`. Le fichier est obligatoire dans toute zone (ADR 0003, § 4).

**Le dessin** : `TrailsLayer.tsx` (`features/map/`), une source GeoJSON
avec la copie légère (§ 1) :

- un trait coloré épais et le nom le long du trait (couleur, épaisseur et
  police : designer) ;
- **ordre** : au-dessus des voies et sous les noms de lieux du fond de
  carte (`beforeId` : la première couche de noms de `mapStyle.ts`) ; sous
  le tracé de l'itinéraire, la liaison et les marqueurs, qui sont déclarés
  après ;
- la même couche sur l'onglet Carte et dans la création.

**Le toucher, seulement sur l'onglet Carte** :

- `onPress` sur la source dans `ZoneMap` ; **aucun** `onPress` dans la
  création, où toucher pose un point (choix 3 du pilotage) ;
- `hitbox` de 44 × 44 dp, écrite dans le code : c'est la valeur mesurée
  dans l'essai (identique au défaut sur les deux plateformes). On ne
  dépend pas d'un défaut de la bibliothèque. Jamais 0 (comportements
  différents) ;
- `event.stopPropagation()` : un appui sur un circuit n'est pas aussi un
  appui sur la carte ;
- plusieurs circuits sous le doigt : une courte liste pour choisir
  (« {n} circuits passent ici », maquette 12, variante G ; réponse 5).
  Ordre : le trait le plus proche du point touché d'abord, puis le plus
  petit `osm_id` (`sortByDistance`, `core/trails/`) ;
- toucher ailleurs ferme la feuille.

**La feuille du circuit** (maquette 12, textes du designer) :

| Cas | Contenu |
|---|---|
| Ligne ordonnée | nom, sinon `ref`, sinon « Circuit » ; longueur (`trackLengthM(ordered)`) ; « Boucle » ou « Aller simple » ; si `removed_m` > 0, « Les petites variantes du circuit ne sont pas reprises. » (réponse 6) ; « Tracé du circuit : OpenStreetMap » ; bouton « En faire un itinéraire » |
| Refus `parts` | nom, longueur (`length_m`), « Ce circuit est en plusieurs morceaux… » ; pas de bouton |
| Refus `branches` ou `removedTooMuch` | nom, longueur (`length_m`), un message (« … ne se suit pas d'un bout à l'autre ») ; pas de bouton |
| Zone ancienne (`ordered` absent) | nom, longueur (`length_m`), « Zone à mettre à jour. » ; le bouton « Mettre à jour » lance la mise à jour puis ouvre l'onglet Zones, même geste que « Télécharger » d'un GPX hors zone (réponse 7). Sans réseau, mise à jour en cours, ou pas de version plus récente : variantes de la maquette 12, écran 5 |

**« En faire un itinéraire »** : `setDraftTarget({ kind: 'trail', osmId, position })`
(dernière position connue, ou `null`), puis `router.push('/draft')`.
`DraftSession` lit `useTrails(zone tenue)`, retrouve le circuit par son
`osm_id` et appelle `traceToDraft`. Circuit absent ou sans ligne (zone
changée entre-temps) : la création se ferme avec un message. La zone
tenue fait foi : `zoneVersion` est sûre.

### 10. La session de création et « Enregistrer »

`draftTarget.ts` transmet une cible typée :

```ts
type DraftTarget =
  | { kind: 'route'; id: number }        // « Modifier » d'un itinéraire gardé
  | { kind: 'gpx'; id: number }          // « Modifier » d'un GPX
  | { kind: 'trail'; osmId: number; position: { lon: number; lat: number } | null };
```

| Cible | `routeId` | Brouillon enregistré (`savedDraft`) | « Enregistrer » | Fermer sans changement |
|---|---|---|---|---|
| aucune | — | — | `INSERT` `created` | sans question sous 2 points (inchangé) |
| `route` | l'itinéraire | celui de la base | `UPDATE` (inchangé) | sans question (inchangé) |
| `trail` | — | le brouillon de départ | `INSERT` `trail`, nom du circuit, sinon `ref`, sinon « Circuit du 9 nov. », « (2) » s'il existe déjà | **sans question** : rien n'est perdu, le circuit reste sur la carte |
| `gpx` | le GPX | le brouillon de départ | `UPDATE` vers `editedGpx` (§ 7) ; sans changement, rien | sans question |

- « Il y a des changements » garde la règle de l'ADR 0019, § 4 :
  `state.draft !== savedDraft`.
- Le cadrage d'ouverture est celui d'un itinéraire rouvert (tout le tracé
  à l'écran).
- **Marqueurs serrés** : 35 marqueurs se chevauchent au zoom
  d'ouverture. Au zoom d'ouverture, les points intermédiaires sont de
  petits ronds sans numéro ; au zoom proche, ils ont leur numéro
  (réponse 3). Règle « tout ou rien » de la maquette 12 : distance
  médiane à l'écran entre points voisins, mesurée à chaque fin de zoom.
  L'espacement reste 1 km : il sert à retoucher un passage une fois zoomé.
- Le titre de la création est le nom par défaut, donc le nom du circuit
  (réponse 4).

### 11. Rapidité (C12) et place du calcul

- **Le découpage tourne sur le fil JavaScript**, une fois, dans
  l'initialisation de la session (`useState(() => traceToDraft(…))`),
  comme `reopenDraft`. Pas de fil séparé : 1 à 11 ms dans Jest. Hermes
  (moteur JavaScript de React Native, sans compilation à la volée) peut
  être 5 à 10 fois plus lent : environ 100 ms pour 10 000 points, très en
  dessous de 1 s.
- **Ce que mesure C12** : du toucher sur « En faire un itinéraire » (ou
  « Modifier ») jusqu'au tracé et aux marqueurs dessinés. Les infos (D+,
  terrain) arrivent ensuite : 2 requêtes par tronçon dans la file du
  moteur, un appel natif à la fois. Leur durée est notée à part.
- Le glisser : 51 marqueurs au plus. La méthode de la phase 4 (arrêt du
  fil JavaScript, 100 ms au plus) est rejouée avec le circuit de 35 km
  (36 points de passage) et un GPX de plus de 50 km (51 points de
  passage) (contrôle 4).
- `trails.geojson` (environ 110 Ko) est lu et analysé une fois par
  version de zone.

### 12. Place du code (ADR 0011 et 0014)

| Dossier | Contenu |
|---|---|
| `zones/zonefactory/trails.py` | rôles dans `parse_opl` ; coupe, graphe, retraits, refus, parcours (§ 2) ; les 5 propriétés ; le rapport. Tests dans `zones/tests/` |
| `core/trails/` (nouveau) | `trails.ts` : type `Trail`, `parseTrails`, copie légère pour la carte, `sortByDistance`. Tests Jest |
| `core/routes/` | `traceDraft.ts` : `cutTrace`, `rotateLoop`, `nearestOnLine`, `traceToDraft` (§ 3, § 4, § 5). `savedRoute.ts` : origines, `trace`. `migrations.ts` : `MIGRATIONS[1]`. `routeRepo.ts` : remplacer un GPX, `duplicateRoute` (§ 7 bis). `routeName.ts` : nom d'un circuit, `copyName`. `routeText.ts` et `routeList.ts` : les nouvelles origines (§ 7) |
| `core/route-info/` | `legShape.ts` : `infoShape`, contrôle du rectangle pour un tronçon `trace` (§ 5). `heightGroups.ts` (nouveau) et `routeInfo.ts` : un profil par groupe d'altitudes (§ 6) |
| `features/map/` | `useTrails.ts`, `TrailsLayer.tsx`, `TrailSheet.tsx` ; `ZoneMap` (couche, toucher, feuille) ; la création (couche sans toucher, bulles) ; `draftTarget.ts`, `DraftRoot.tsx`, `DraftSession.tsx` (§ 10) ; `useLegResults` et `useLegInfos` (clé `trace:N`, groupes d'altitudes) ; `SavedRouteInfoScreen` (« Modifier » d'un GPX, « Dupliquer ») |
| `features/routes/` | `RoutesScreen.tsx` : l'action « Dupliquer » passée au menu |
| `shared-data/routes/` | `useRoutes.ts` : action `duplicate` |
| `ui/` | `openActionMenu.ts`, `useRouteMenu.tsx` : l'entrée « Dupliquer », la feuille du menu sur Android (§ 7 bis) |
| `core/i18n/fr.ts` | tous les textes nouveaux |

- `useTrails` reste dans `features/map/` : seuls les écrans de ce dossier
  le lisent (règle de l'ADR 0014).
- Aucune dépendance nouvelle, ni npm ni Python.

## Alternatives rejetées

**Ordonner**
- **Ordre strict (spec actuelle)** : zéro circuit transformable à Nancy.
- **Ordonner dans l'app** : la donnée serait contrôlée sur chaque téléphone
  au lieu d'une fois dans la fabrique (choix 5 du pilotage).
- **Suivre la variante la plus courte, ou la plus longue** : sans lien avec
  ce que le baliseur a voulu. L'ordre de la relation est la seule
  intention écrite.
- **Parcourir une tige d'aller-retour deux fois (circuit en « sucette »)** :
  possible, mais aucun circuit de Nancy n'en a besoin. Refusé en v1.
- **Demander aux contributeurs OSM de corriger les relations** : lent, hors
  de notre main.

**Format**
- **Remplacer la géométrie par la ligne ordonnée** : la carte ne
  montrerait plus les variantes et impasses balisées sur le terrain.
- **Polyligne encodée** : plus petite, mais un encodeur Python à garder
  identique au décodeur de l'app.
- **Fichier à part (`trails-ordered.json`)** : un fichier de plus dans le
  catalogue, pour 55 Ko.
- **Numéro de format dans le fichier** : la présence de la clé `ordered`
  suffit.

**Découpage**
- **Un point tous les 1 000 m pile** : un dernier tronçon minuscule.
- **Points sur les sommets existants de la trace** : écarts irréguliers
  (sommets jusqu'à 303 m l'un de l'autre sur les circuits).
- **Pas de plafond** : 200 marqueurs pour un GPX de 200 km.

**Hors zone**
- **Des « attaches » invisibles au bord de la zone** (proposition du
  designer) : une complexité de plus ; la feuille « Point hors de votre
  zone » existante suffit.
- **Des points de passage hors de la zone** : des points qu'on ne peut
  pas déplacer, donc un piège (designer).

**D+** (mesures du contrôle 1)
- **(a) Rééchantillonner à 10 m** : n'aide pas. La ligne entière varie
  encore de 439 à 480 m (41 m, contre 61 m à 30 m). Pour un même départ,
  « tronçons moins ligne entière » va de −36 à +25 m, et dépasse encore
  5 m dans 27 cas sur 36. Le bruit vient des altitudes (grille d'environ
  30 m) et du seuil, pas du pas. En plus, tous les D+ changeraient, et la
  comparaison au Mac de la phase 5 serait à refaire.
- **(c) Une tolérance dans C11** : l'écart d'une trace non touchée va de
  −42 à +31 m (jusqu'à 9 % du D+). Il faudrait environ 45 m au lieu de
  5 m : la comparaison ne prouverait presque plus rien. (b) donne 0 m.
- **Couper aux multiples de 30 m** : essayé, la grille dérive quand même
  (471, 475 et 458 m contre 482 m), car le moteur ne compte pas les
  distances comme l'app.
- **Lisser les altitudes avant le seuil** : non mesuré. Plus tard,
  peut-être jamais.

**Dupliquer**
- **Lire le nom pour numéroter « X (copie) » en « X (copie 2) »** : une
  analyse du texte pour un cas rare.
- **Ouvrir la copie après « Dupliquer »** : une navigation de plus ; la
  copie est en haut de la liste.
- **Le menu Android en `Alert` à 3 boutons, avec un sous-menu « Plus… »** :
  deux appuis pour une action courante.
- **`@expo/ui` pour un menu natif** : un module et un essai jetable pour
  une liste de 4 actions.

**Durée**
- **12 km/h (essai)** ou **16 km/h (vitesse VTT de Valhalla)** : une règle
  de plus, et un GPX changerait de durée en devenant itinéraire.
- **Durée du moteur à l'ouverture** : 35 calculs, contraire à C7.

**Base**
- **Une colonne `source` à côté de `origin`** : deux colonnes pour une
  seule information, et la contrainte `CHECK` à reconstruire quand même.
- **Garder `track` et `elevations` dans un GPX modifié** : une copie qui
  divergerait de `legs`, et une contrainte plus compliquée.
- **Créer une nouvelle ligne au lieu de remplacer le GPX** : rejeté par
  Émilien (question 1).

**Toucher**
- **`hitbox` de 64 dp (± 32)** : sélectionne à 40 dp, donc gêne le
  déplacement de la carte près d'un circuit. 44 dp suffit au doigt.
- **Toucher les circuits dans la création** : conflit avec « toucher pose
  un point » (choix 3).
- **Prendre seul le circuit le plus proche sous le doigt** : on ouvrirait
  l'un des deux au hasard, sans savoir qu'il y en a un autre (réponse 5).

## Conséquences

- Positif : les deux circuits de Nancy deviennent des itinéraires. Le
  geste réutilise les tronçons gardés de la phase 6 : 0 calcul à
  l'ouverture, tracé exact.
- Positif : un seul code de découpage pour les circuits et les GPX, en
  logique pure, testé sans téléphone.
- Positif : la fabrique écrit ce qu'elle retire ; la décision reste
  vérifiable à chaque zone.
- Négatif : une zone Nancy v6 à fabriquer et publier ; `trails.geojson`
  double de taille (environ 110 Ko).
- Négatif : la ligne ordonnée n'est pas tout le balisage. Les annexes
  retirées (impasses, variante) ne sont pas dans l'itinéraire.
- Négatif : la durée d'un circuit devenu itinéraire est comptée à 10 km/h :
  plus longue que celle du moteur.
- Négatif : la base passe en version 2 par une reconstruction de table.
  Une app de la phase 6 réinstallée verra une base « trop récente »
  (ADR 0019, § 2).
- Négatif : un GPX modifié perd les altitudes de son fichier.
- Négatif : la clé des infos d'un tronçon change encore (`trace:N`) : les
  tests qui l'écrivent sont à adapter.
- Négatif : après une retouche, le D+ est un ordre de grandeur (environ
  ±6 %). Le même circuit, ouvert depuis deux départs, peut montrer deux
  D+ différents.
- Négatif : une partie hors zone qui revient dans la zone disparaît si
  l'on déplace un de ses points voisins (§ 5). « Annuler » la rend.
- Négatif : sur Android, le menu d'un itinéraire n'est plus une boîte
  native mais une feuille de l'app.
- L'ADR 0003 a reçu son complément (« la ligne ordonnée des circuits »),
  accepté avec cet ADR. Restent à écrire : dans l'ADR 0019, « origines
  `trail` et `editedGpx`, base version 2, marqueur `trace`, Dupliquer,
  menu Android : ADR 0020 » ; dans l'ADR 0017, « rectangle contrôlé pour
  un tronçon `trace`, groupes d'altitudes : ADR 0020 ».

## Contrôles avant de bâtir dessus

1. **Fait le 9 novembre, sur le Mac : l'origine de l'écart de D+**
   (§ 6). Banc jetable, Valhalla 3.9.1 en Docker, Nancy v5, fonctions de
   l'app. Résultat : le D+ dépend de l'endroit où l'on coupe (cause 1) ;
   la rotation est juste, à un point en double près. Parade (b) retenue.
   **Reste, en T7** : sur iOS, l'ouverture « le plus proche » jusqu'au
   bout (même valeur qu'Android attendue) ; et C11 sur un GPX de plus de
   14 000 points, où `thinTrack` peut garder d'autres points dans la
   forme jointe que dans le tracé du fichier.
2. **Début de T5, sur `node:sqlite` puis sur les deux simulateurs** : la
   reconstruction de la table avec `STRICT` et `AUTOINCREMENT`, et le
   compteur `sqlite_sequence` après `RENAME`. Parade si le compteur ne
   suit pas : le réécrire après le `RENAME`.
3. **T2, sur le Mac** : la règle du § 2 sur **toute la Lorraine** (314
   circuits), pas seulement Nancy. Noter combien de circuits sont
   ordonnés, retirés à plus de 5 %, ou refusés, et pourquoi. Si plus d'un
   tiers des circuits d'un seul morceau sont refusés, le signaler au
   pilotage : la règle est peut-être trop stricte ailleurs.
4. **T7, en release** : le glisser avec 36 points de passage (circuit de
   35 km) et 51 points (GPX de plus de 50 km), méthode de la phase 4.
   Seuil : 100 ms. Parade : plafond à 35 tronçons. Si le seuil tombe dès
   T5, le signaler tout de suite au pilotage.
5. **T4** : l'ordre des couches (`beforeId`) et le nom le long du trait,
   sur les deux simulateurs, avec les polices hors ligne déjà installées.
6. **Début de T6, menu à 4 actions** (§ 7 bis) : sur Android, la feuille
   du menu (`Modal`) s'ouvre depuis le « ⋮ » et l'appui long, se ferme
   par « Annuler », un toucher hors de la feuille et la touche Retour ;
   sur iOS, la feuille d'actions montre bien 4 actions et « Annuler ». Le
   designer juge son aspect (maquette 40, écran 9c). S'il refuse une
   feuille de l'app, le pilotage décide (`@expo/ui`, avec un essai
   jetable).

## Réponses d'Émilien (9 novembre 2026)

Pour chaque question, la recommandation est retenue.

1. Règle d'ordonnancement tolérante, qui change C2 : **acceptée** (§ 2).
2. Parade du D+, après le contrôle 1 : **(b)**, une requête par suite de
   tronçons non touchés ; après une retouche, le D+ reste un ordre de
   grandeur (§ 6).
3. Points intermédiaires en petits ronds sans numéro au zoom d'ouverture,
   numéros au zoom proche (maquette 12, question 1) : **oui** (§ 10).
4. Titre de la création = nom du circuit (maquette 12, question 2) :
   **oui** (§ 10).
5. Plusieurs circuits sous le doigt : une courte liste pour choisir
   (maquette 12, question 3) : **oui** (§ 9).
6. Dire dans la feuille que les petites variantes ne sont pas reprises
   (maquette 12, question 4) : **oui** (§ 9).
7. Zone ancienne : le bouton lance la mise à jour, puis ouvre l'onglet
   Zones (maquette 12, question 5) : **oui** (§ 9).
8. GPX modifié : une bulle à l'ouverture prévient du remplacement, sans
   boîte de confirmation (maquette 12, question 6) : **oui** (§ 8).

## Sources (relevées le 9 novembre 2026)

- Essai T1 : `/Users/utilisateur/dev_ai/vtt-nav-preuves/p07/t1-essai/LISEZMOI.md`
  (hors dépôt), sorties `sortie-A-strict.txt`, `sortie-A-topologie.txt`,
  `sortie-A-tolerant.txt`, `sortie-A-segments.txt`,
  `sortie-B-ios-mesures.txt`, `sortie-B-android-gestes.txt`,
  `sortie-C-ios-origine.txt`, `sortie-C-android-origine.txt`,
  `sortie-C-*-proche.txt`, `sortie-C-jest.txt` ; scripts `ordonner.py`,
  `ordonner_tolerant.py`, `topologie.py` ; captures
  `ios-C1/C2/C3-origine-*.png`, `android-C1/C2/C3-origine-*.png`,
  `ios-proche-1-ouverture.png`, `android-C4-proche-1-ouverture.png`
  (valeurs de D+ du § 6). Branche jetable `claude/p07-essai`, commit
  `384d458` (code non relu).
- Contrôle 1 : `/Users/utilisateur/dev_ai/vtt-nav-preuves/p07/controle1/LISEZMOI.md`
  (hors dépôt), sorties `sortie-mesures.txt`, `sortie-diagnostic.txt`,
  `sortie-parade-b.txt`.
- Maquettes : `design/v1/12-circuit-balise.html` (écran 8, textes,
  questions) et `design/v1/40-mes-itineraires.html` (écrans 3, 9a, 9b).
- Code lu pour l'alignement du 9 novembre : `core/route-info/routeInfo.ts`,
  `profile.ts` ; `core/routing/infoRequest.ts`, `infoResponse.ts`,
  `routingEngine.ts` ; `core/routes/routeRepo.ts`, `routeName.ts`,
  `routeText.ts`, `routeList.ts`, `track.ts` ; `core/draft/problem.ts` ;
  `features/map/useLegInfos.ts`, `useLegResults.ts` ;
  `shared-data/routes/useRoutes.ts` ; `ui/openActionMenu.ts`,
  `useRouteMenu.tsx`.
- React Native, `Alert` : « On Android at most three buttons can be
  specified » : https://reactnative.dev/docs/alert
- Code lu sur la branche de phase (`9edfa8b`) : `zones/zonefactory/trails.py` ;
  `mobile/src/core/routes/` (`reopen.ts`, `migrations.ts`,
  `savedRoute.ts`, `importedRoute.ts`, `track.ts`) ;
  `mobile/src/core/gpx/trackLengthM.ts` ; `mobile/src/features/map/`
  (`useLegResults.ts`, `DraftSession.tsx`, `DraftRoot.tsx`,
  `draftTarget.ts`, `MapScreen.tsx`, `ZoneMap.tsx`, `useTrackInfos.ts`,
  `useDifficultyTable.ts`).
- Wiki OSM, rôles des membres d'un itinéraire (vide, `forward`,
  `backward`) : https://wiki.openstreetmap.org/wiki/Relation:route
- Wiki OSM, rôles des itinéraires de loisir (`main`, `alternative`,
  `excursion`, `approach`, `connection`), adoptés comme base :
  https://wiki.openstreetmap.org/wiki/Role:alternative et
  https://wiki.openstreetmap.org/wiki/Proposed_features/Recreational_route_relation_roles
- SQLite, changer une contrainte en reconstruisant la table :
  https://www.sqlite.org/lang_altertable.html#otheralter ; `AUTOINCREMENT`
  et `sqlite_sequence` : https://www.sqlite.org/autoinc.html
