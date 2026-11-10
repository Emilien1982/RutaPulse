# ADR 0021 — Suivi sur le vélo : directions, placement sur le tracé, seuils, chiffres réels

- Statut : accepté (validé par Émilien le 10 novembre 2026, avec les
  recommandations des 3 questions ci-dessous et des 8 questions de la
  maquette 30)
- Date : 2026-11-10 (phase 8a, tâche T1 de [p08-suivi-velo](../phases/p08-suivi-velo.md))
- Précise l'[ADR 0006](0006-suivi-arriere-plan-notification.md) (GPS et
  écran allumé, pour le suivi au premier plan),
  l'[ADR 0007](0007-donnees-locales-et-etat.md) (état du suivi dans un
  Store) et l'[ADR 0015](0015-module-natif-calcul.md) (une fonction de plus
  dans le module natif). Réutilise les ADR 0017, 0019 et 0020 (profil
  d'altitudes, tracé gardé, tronçons `trace`). Suit les règles d'import
  des ADR 0011, 0014 et 0015 sans les changer.

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture). GPS veut dire « Global Positioning System » (positionnement
par satellites). GPX veut dire « GPS Exchange Format » (format d'échange de
traces GPS).

## Contexte

- La spec validée fait foi. Phase 8a : tâches T1 à T4, sans la luminosité ;
  critères C1 à C8 et C12 à C15. **La luminosité (C9), l'onglet Carte
  (C10) et le trait de liaison (C11) sont en phase 8b.** Cet ADR ne les
  traite pas.
- Réponses d'Émilien du 10 novembre (questions 1 à 3 de la spec) : le suivi
  ne guide pas sur le trait de liaison ; pendant le suivi, la caméra suit
  la position même hors de la zone ; la phase 9 (téléphone verrouillé)
  passe en V2.
- **Maquette 30 complétée par le designer** (`design/30-suivi-velo.html`,
  10 novembre) : 8 états (suivi normal, panneau jaune, « Suivez le tracé »,
  écart, arrivée en vue, « Terminer », attente du GPS, départ loin du
  tracé), leur ordre de priorité, les règles de la caméra, « GPS perdu »,
  les formats de nombres et les textes. Il demande à cet ADR deux règles :
  pas de clignotement au seuil des 30 m, et quoi faire quand on rejoint le
  tracé ailleurs qu'au départ. Elles sont au § 3.
- **Essai T1, partie A** ([LISEZMOI](../../essais/08-suivi-velo/LISEZMOI.md)),
  sur le Mac, Valhalla 3.9.1 dans Docker (logiciel qui fait tourner des
  programmes isolés), zone Nancy v6 :

  | | Itinéraire créé (34 km) | Circuit de Haye (21 km) | GPX simulé (35 km) |
  |---|---|---|---|
  | `trace_route`, `map_snap` | 12 ms, 68 directions | 13 ms, 40 directions | 28 ms, 52 directions |
  | Longueur recalée / longueur du tracé | 100 % | 100 % | 97 % |
  | Morceaux à plus de 20 m du recalé | aucun | aucun | 741 m, à la fin |
  | Directions absurdes | aucune | aucune | 1 demi-tour fantôme, 1 direction perdue |

  - `trace_route` (fonction de Valhalla qui recale un tracé sur les voies
    et rend les directions) donne pour un itinéraire créé exactement les
    68 directions de `route`.
  - `edge_walk` (recalage arête par arête, sans tolérance) échoue :
    erreur 443 juste après un point de passage `through`. **`map_snap`
    (recalage qui tolère les écarts) marche partout.**
  - Sur un GPX, Valhalla peut **couper une partie du tracé sans le
    signaler** : avec un bruit GPS « blanc » de 4 m tous les 8 m, il ne rend
    que 29 % du tracé, sans erreur. Avec un point tous les 20 m : 95 %.
  - Limite de Valhalla : 16 000 points par tracé (`max_shape`).
  - Sur le circuit, 32 directions sur 40 n'ont **pas de nom de voie** : le
    texte du moteur est seulement « Tournez à gauche. ».
  - valhalla-mobile 0.6.4 expose `trace_route` en forme brute :
    iOS `traceRoute(rawRequest:)`, Android `traceRouteRaw(requestJson)`.
    Notre module ne l'expose pas encore.
  - **Pas encore fait (partie B)** : rien sur simulateur, faute de place sur
    le disque. Voir « Contrôles avant de bâtir dessus ».
- Ce que fait le code aujourd'hui (lu le 10 novembre 2026, commit `4870904`) :
  - la position de l'onglet Carte vient de `useCurrentPosition` de MapLibre
    (bibliothèque de carte), permission « pendant l'utilisation »
    (`features/map/MapPosition.tsx`). `expo-location` 58.0.x est déjà
    installé. `expo-keep-awake` ne l'est pas ;
  - le moteur passe par une file, un appel à la fois
    (`core/routing/routingEngine.ts`), avec `route`, `height`,
    `pointHeights` et `traceAttributes` ;
  - un itinéraire gardé donne une seule ligne par `trackOfCreated`
    (`core/routes/track.ts`), qui passe par les points recalés : le trait
    de liaison n'y est pas ;
  - l'écran Infos (`features/map/SavedRouteInfoScreen.tsx`) calcule le
    profil d'altitudes joint (`summarizeInfo`, ADR 0017 et 0020) avec une
    prise de zone (`useZoneHold`) ;
  - `classifyEdge` (`core/route-info/terrain.ts`) range une voie en route,
    piste ou sentier ;
  - ESLint (contrôle du code) accepte un sous-dossier dans une
    fonctionnalité : depuis `features/map/tracking/`, `../ZoneBaseMap` est
    permis.

## Décision

### 1. Source des directions : `trace_route`, contrôlé, au départ du suivi

**1.1 Ce qu'on demande au moteur.** Au départ du suivi, une fois, jamais
pendant le suivi. Rien n'est gardé dans la base (choix 1 de la spec).

La **ligne du suivi** est le tracé gardé, tel quel :
- itinéraire créé (et circuit, et GPX modifié) : `trackOfCreated(draft, legs)` ;
- GPX importé : `track`, éclairci par `thinTrack` s'il dépasse 14 000
  points (ADR 0019, § 5).

Elle est coupée en **parties guidées** et **parties libres** :

| Partie | Quand | Directions |
|---|---|---|
| Libre, raison « à la main » | tronçon à la main | aucune : « Suivez le tracé » |
| Libre, raison « hors zone » | tronçon dont un point sort du rectangle de la zone tenue ; morceau de GPX hors du rectangle ; tout le tracé si la zone de l'itinéraire n'est pas en service | aucune : « Suivez le tracé » |
| Guidée | tout le reste | `trace_route` |

Des parties guidées qui se suivent n'en font qu'une : en général, une seule
requête pour tout l'itinéraire.

**Requête `trace_route`**, une par partie guidée, dans la file du moteur :

```json
{ "encoded_polyline": "<partie, un point tous les 20 m>",
  "shape_match": "map_snap",
  "costing": "bicycle",
  "costing_options": { "bicycle": { "bicycle_type": "mountain", "use_roads": 0 } },
  "directions_options": { "language": "fr-FR", "units": "kilometers" } }
```

- `map_snap`, jamais `edge_walk` (erreur 443 de l'essai).
- **Un point tous les 20 m** le long de la partie, plus le dernier point
  (`spaceEvery(line, 20)`, nouveau, à côté de `thinTrack`). Raison : sur
  un tracé bruité, des points plus serrés font échouer le recalage (29 %
  à 8 m, 95 % à 20 m dans l'essai). 35 km font 1 750 points ; 200 km,
  limite de distance de Valhalla, en font 10 000 : toujours sous 16 000.
- Même `costing` que tous les calculs (`ROUTE_COSTING`).

**Requête du type de voie**, juste après, sur la même forme allégée :
`traceAttributes` (déjà dans le module) avec `shape_match: map_snap` et
`filters: {attributes: ["edge.use", "edge.density", "edge.begin_shape_index", "shape"], action: "include"}`
(forme exigée par Valhalla, comme `buildTraceRequest` ; corrigé en T2).
Elle donne le type de chaque voie recalée (§ 1.4). Nouvelle fonction de
requête `buildMatchedEdgesRequest`, à côté de `buildTraceRequest`, qui ne
change pas.

**1.2 Le module natif gagne `traceRoute`.**

```ts
traceRoute(requestJson: string): Promise<string>
```

- iOS : `valhalla.traceRoute(rawRequest:)` ; Android :
  `valhalla.traceRouteRaw(requestJson)`. Même modèle que `traceAttributes`
  (ADR 0017, § 1) : un refus de Valhalla revient en JSON (format texte de
  données) `{code, message}` ; la promesse n'est rejetée qu'avec
  `ERR_ENGINE_NOT_OPEN` ou `ERR_ENGINE`.
- `core/routing/routingEngine.ts` gagne `traceRoute(shape, signal?)` et
  `matchedEdges(shape, signal?)`, dans la même file, sur le modèle
  d'`infoCall`. Dans `NativeRouting`, `traceRoute` est facultatif, comme
  `height`.
- Tous les codes d'erreur (442, 443, 444, 171…) donnent `failed`. Pour le
  suivi, seul compte « directions présentes ou non ».

**1.3 Contrôle de la réponse.** Le moteur ne signale pas un recalage
incomplet (essai). On contrôle donc chaque partie guidée, sur notre ligne :

1. **Morceaux non recalés.** On prend un point tous les 10 m sur la
   partie, et on mesure sa distance à la forme recalée (placement avec
   l'avancement, § 2, appliqué à la forme recalée). Une suite de points à
   **plus de 20 m** du recalé, longue de **plus de 100 m**, devient une
   partie libre, raison « non recalé ». Sur le GPX de l'essai : les 741 m
   de la fin.
2. **Directions placées sur notre ligne.** Le point de début de chaque
   manœuvre (point `begin_shape_index` de la forme recalée) est placé sur
   notre ligne, dans l'ordre, avec l'avancement (§ 2). Une manœuvre à plus
   de 20 m de notre ligne, ou tombée dans une partie libre, est retirée.
3. **Demi-tour.** Un demi-tour (types 12 et 13) n'est gardé que si notre
   ligne fait vraiment demi-tour : le cap 20 m avant et le cap 20 m après
   diffèrent de plus de 150°. Le demi-tour fantôme de l'essai est retiré ;
   un vrai aller-retour garde le sien.
4. **Échec de la requête**, ou réponse illisible : toute la partie devient
   libre, raison « non recalé ».

Cette règle remplace « longueur recalée sous 95 % » du LISEZMOI : elle dit
**où** est le trou, pas seulement qu'il existe.

**1.4 Le texte : construit par nous, depuis le type de manœuvre et le
type de voie.** On ne garde pas le texte du moteur. Raisons :
- tout texte visible passe par `t()` et `fr.ts` (ADR 0011) ;
- le texte du moteur est fait pour la voiture (« Pédalez vers le sud »,
  « Vous êtes arrivé à votre destination ») et donne des noms de rue que
  la maquette 30 ne veut pas (« rare en forêt, et trop long ») ;
- 32 directions sur 40 du circuit n'ont pas de nom : « Tournez à gauche. »
  seul ne distingue pas un sentier d'une piste au même carrefour.

Consigne = le geste, puis le type de la voie prise s'il est connu (textes
de la maquette 30) :

| Type Valhalla | Geste | Texte (clé `tracking.gesture.*`) |
|---|---|---|
| 9, 16 | légèrement | « Légèrement à droite / à gauche » |
| 10, 15 | tourner | « Tournez à droite / à gauche » |
| 11, 14 | virage serré | « Virage serré à droite / à gauche » |
| 23, 24 | fourche | « À la fourche, à droite / à gauche » |
| 22 | tout droit à une fourche | « Continuez tout droit » |
| 12, 13 | demi-tour (si gardé, § 1.3) | « Faites demi-tour » |
| 26 | rond-point | « Au rond-point, {n}e sortie » (`roundabout_exit_count`) |
| 18, 20, 37 / 19, 21, 38 | bretelle, sortie, insertion | comme « légèrement à droite / à gauche » |
| 1 à 3 (départ), 4 à 6 (arrivée), 7 (`becomes`), 8 (`continue`), 17, 25, 27 (sortie du rond-point), 28, 29, autres | — | retirée |

- `continue` (8) et `becomes` (7) sont retirés : ce sont des changements
  de nom de voie, sans geste. « Tout droit » ne vient que du type 22,
  donné par Valhalla à une fourche. C'est la règle de la maquette : « tout
  droit seulement à un carrefour où l'on pourrait se tromper ».
- L'arrivée du moteur (types 4 à 6) est retirée : l'arrivée est **notre**
  dernière direction, au bout de notre ligne (§ 3). Sur le GPX de l'essai,
  l'arrivée du moteur tombait 740 m trop tôt.
- **Type de voie** : la voie dont `begin_shape_index` égale celui de la
  manœuvre, dans la réponse de `matchedEdges`, rangée par `classifyEdge`
  (la règle de l'écran Infos) : « sur le sentier », « sur la piste », « sur
  la route ». Cette correspondance d'indices n'est permise que si les deux
  formes recalées (`trace_route` et `matchedEdges`) sont identiques ;
  sinon, et si `matchedEdges` échoue, la consigne n'a pas de type de voie.
  Le contrôle B6 vérifie qu'elles le sont.
- Les textes restent dans `fr.ts`. `core/tracking/directionText.ts` rend
  une clé et ses paramètres ; il se teste sans téléphone.

**1.5 La parade : « Suivez le tracé », pas des virages calculés.**

Une partie libre (à la main, hors zone, non recalée) n'a pas de direction.
Le panneau dit « Suivez le tracé » (écran 3 de la maquette). La carte
orientée, le tracé et la partie roulée en gris guident.

Pourquoi pas les virages calculés d'après la forme du tracé (choix 1 de la
spec) :
- C2 demande « Suivez le tracé » pour les tronçons à la main et hors zone :
  la parade la plus simple le tient déjà ;
- sur une trace GPS bruitée (le cas même où le moteur échoue), des virages
  tirés de la forme donnent des zigzags : des « directions absurdes »,
  contraires à C2 ;
- elle demande des seuils (angle, longueur) à régler sans vrai GPX VTT.

**En réserve** : si un vrai GPX VTT (contrôle B5, ou phase 10) laisse plus
de 10 % de sa longueur « non recalé », on revient sur cette décision.
Voir la question 1.

**1.6 Liste des directions.** `buildGuidance` (`core/tracking/`) rend une
liste triée le long de notre ligne :

```ts
type Direction =
  | { kind: 'turn'; atM: number; gesture: Gesture; side?: 'left' | 'right'; exit?: number; way?: 'trail' | 'track' | 'road' }
  | { kind: 'follow'; fromM: number; toM: number; reason: 'hand' | 'outOfZone' | 'noMatch' }
  | { kind: 'arrive'; atM: number };  // atM = longueur de la ligne
```

Tant que la liste n'est pas prête (moins de 2 s, C12), ou si le moteur
n'est pas utilisable, tout l'itinéraire compte comme une partie libre.

### 2. Placement sur le tracé, avec l'avancement (C3)

**2.1 La ligne.** Au départ : les points de la ligne du suivi, leurs
distances cumulées sur la sphère de Valhalla (la formule de
`trackLengthM`), et leurs coordonnées dans un plan local en mètres
(longitude multipliée par le cosinus de la latitude moyenne, méthode
de l'ADR 0020, § 3). La distance d'un point à un segment se calcule dans ce
plan. Pas de `@turf/turf` (prévu par l'ADR 0006) : deux fonctions de
quelques lignes suffisent, et le dépôt a déjà `trackLengthM`.

**2.2 Une seule primitive.** `nearestOnLine(line, point, fromM, toM)` : le
point de la ligne le plus proche, cherché seulement sur les segments entre
les distances `fromM` et `toM`. Rend la distance le long de la ligne
(`alongM`), la distance au point (`gapM`) et le cap du segment. Elle sert
trois fois : position GPS (ici), manœuvres et contrôle de la réponse
(§ 1.3).

Un **passage** est un minimum local de la distance du point à la ligne,
à moins de 20 m (corrigé en T2 : avec « une suite de segments voisins »,
les deux bras d'un lacet reliés par un virage proche ne feraient qu'un).
`passagesNear(line, point, 20)` cherche sur toute la ligne et rend le
meilleur point de chaque passage.

**2.3 Les règles, pour chaque position reçue.**

Position écartée si sa précision (`coords.accuracy`) dépasse **50 m**. Elle
compte seulement pour « le GPS répond ».

État : `phase` du placement (`approach`, `onTrack`, `offTrack`),
`progressM` (dernier placement sur le tracé), `offCount`, la position
précédente et son heure.

1. **Avant le tracé (`approach`, écran 8 de la maquette).** On cherche les
   passages à moins de **20 m** sur toute la ligne. Si le cap du mouvement
   est connu (au moins 10 m depuis la position précédente gardée), on
   écarte les passages dont le cap diffère de plus de 90°. Parmi ceux qui
   restent, **le premier dans l'ordre du tracé** gagne. On passe
   `onTrack`, `progressM` = son `alongM`. Aucun passage : on reste
   `approach`, le panneau montre la distance à vol d'oiseau jusqu'au départ.
   - Conséquence voulue (question 5 du designer) : si l'on rejoint le
     tracé ailleurs qu'au départ, le guidage part de là. Ce qui est avant
     compte comme roulé (en gris) ; les directions d'avant sont passées.
   - Le filtre de cap règle la boucle (départ = arrivée : on prend le
     départ) et l'aller-retour (on prend le sens où l'on roule).
2. **Sur le tracé (`onTrack`).** Fenêtre de recherche :
   `[progressM − 50 m, progressM + 500 m + 15 m/s × secondes depuis le dernier placement]`.
   15 m/s, c'est 54 km/h, une descente rapide : après une pause ou un trou
   de GPS, la fenêtre a grandi d'autant. Dans la fenêtre, parmi les points
   à moins de 30 m, on prend celui qui minimise
   `gapM + 0,5 × |alongM − attendu|`, où `attendu = progressM + distance parcourue depuis la position précédente`.
   - Ce terme départage deux passages proches dans la fenêtre (lacets à
     20 m l'un de l'autre) : le bon est celui qui suit le mouvement.
   - Un passage plus loin dans le tracé (retour d'un aller-retour, autre
     boucle d'un 8, fin d'une boucle) est hors de la fenêtre : jamais
     choisi.
   - On peut reculer : 50 m par position au plus. La distance restante
     remonte alors, ce qui est vrai.
3. **Écart, sans clignotement.** On passe `offTrack` après **2 positions
   de suite** sans point à moins de 30 m dans la fenêtre. On revient
   `onTrack` dès **une position à moins de 20 m** dans la fenêtre. Entre 20
   et 30 m, l'état ne change pas. Deux garde-fous contre le clignotement :
   un délai pour partir (2 s), un seuil plus bas pour revenir (20 m).
4. **Hors du tracé (`offTrack`, écran 4).** `progressM` ne bouge pas. La
   **cible** est le point le plus proche dans
   `[progressM − 50 m, progressM + 2 km]`. Le panneau montre la distance
   jusqu'à elle ; « Reste » et « D+ restant » prennent la valeur de la
   cible (maquette).
5. **Reprise ailleurs.** Après **5 positions de suite** `offTrack` sans
   rien dans la fenêtre, on cherche sur toute la ligne, comme en 1, avec
   une préférence : les passages placés après `progressM − 50 m` d'abord
   (raccourci vers l'avant), sinon le premier dans l'ordre du tracé
   (retour en arrière). Raison du délai : un écart de quelques secondes
   près d'un autre passage du tracé ne doit pas faire sauter.

Constantes, dans `core/tracking/placement.ts` : `MAX_ACCURACY_M = 50`,
`OFF_TRACK_M = 30`, `BACK_ON_TRACK_M = 20`, `OFF_TRACK_FIXES = 2`,
`WINDOW_BACK_M = 50`, `WINDOW_AHEAD_M = 500`, `MAX_SPEED_MS = 15`,
`TARGET_AHEAD_M = 2000`, `RELOCATE_FIXES = 5`.

**2.4 Coût (C12 : 50 ms par position).** Une recherche dans la fenêtre
lit les segments de 550 m environ : quelques dizaines à quelques centaines,
plus une recherche par dichotomie dans les distances cumulées pour trouver
le premier. La recherche sur toute la ligne (départ, reprise ailleurs) lit
tous les segments : 14 000 au plus, environ 1 à 3 ms sur Hermes (moteur
JavaScript de React Native). Pas d'index spatial : inutile à cette taille.
C12 se mesure en version finale (release), autour de la fonction
`reduceTracking`.

### 3. Seuils et affichage

| Seuil | Valeur | Remarque |
|---|---|---|
| Écart affiché | plus de 30 m, 2 positions de suite | retour sous 20 m (§ 2.3) |
| Arrivée | à moins de 30 m du dernier point de la ligne **et** `progressM` ≥ 90 % de la longueur | une boucle ne finit pas au départ ; marche aussi `offTrack` |
| Panneau jaune | prochaine direction ou arrivée à 100 m ou moins | jamais pour l'écart ni « Suivez le tracé » (maquette) |
| Zoom | 15,5 en route ; 16,5 à 100 m ou moins d'une direction | environ 430 m et 220 m de large sur un écran de 390 points. Le designer peut les changer : deux constantes |
| GPS perdu | plus de 10 s sans position | maquette |
| Attente du GPS | message de plus après 30 s | maquette |
| Mise à jour | une par seconde au plus | une position traitée si 900 ms au moins depuis la précédente |
| Carte touchée | la caméra revient seule 10 s après le dernier geste | maquette |

L'essai ne justifie pas de changer les seuils de la spec (30 m, 30 m et
90 %, 100 m). Seul ajout : le seuil de retour de 20 m.

**Le panneau** (`panelOf(state)`, logique pure) suit l'ordre de priorité de
la maquette :
1. pas encore de position : attente du GPS (écran 7) ;
2. `approach` : distance jusqu'au départ (écran 8) ;
3. `offTrack` : distance jusqu'à la cible (écran 4) ;
4. dans une partie libre : « Suivez le tracé », distance jusqu'à sa fin,
   ligne du dessous selon la raison (écran 3) ; si elle va jusqu'au bout,
   écran 5 avec cette ligne ;
5. la prochaine direction est l'arrivée : écran 5 ;
6. sinon la prochaine direction : écran 1 ou 2.

« GPS perdu » s'ajoute à l'état affiché, sans le remplacer. Une partie
libre **à venir** s'annonce comme une direction : « Suivez le tracé »
dans 300 m, panneau blanc (à confirmer par le designer, voir « Notes pour
le designer »).

**Cap et caméra.**
- Sur le tracé, le cap est **celui du tracé** au point placé : stable, sans
  bruit, et connu même à l'arrêt. Hors du tracé : le cap entre les deux
  dernières positions gardées à plus de 10 m l'une de l'autre. Avant tout
  mouvement : inconnu, nord en haut. On ne lit pas `coords.heading` : les
  simulateurs ne le donnent pas toujours, et il est faux à l'arrêt.
- Le point de position est **sur le tracé** quand on est `onTrack` (au
  point placé), et à la position GPS sinon. Raison : en forêt, le GPS
  flotte de 10 à 20 m ; le point resterait sinon à côté du trait.
- La caméra est pilotée par notre code, pas par le suivi de MapLibre :
  `camera.easeTo({ center, bearing, zoom, padding, duration: 1000 })` à
  chaque mise à jour, position au tiers du bas (marge du haut). Une seule
  source de position : celle que la logique utilise.
- Écran 4 et 8 : la caméra cadre la position et la cible.
- La boussole bascule entre « sens de la marche » et « nord en haut ».
- La partie roulée en gris : deux morceaux de la ligne dans une source
  GeoJSON (format de données géographiques), avant et après `progressM`,
  mis à jour quand `progressM` a bougé d'au moins 10 m. La ligne dessinée
  est éclaircie à 5 000 points au plus (`thinTrack`). La phase 4 met déjà
  à jour une source 5 fois par seconde pendant le glisser.
- Pendant le suivi, la caméra n'est **pas** bloquée sur la zone (question 2
  de la spec).

### 4. Distance et D+ restants ; chiffres réels de l'arrivée

**Distance restante** = longueur de la ligne − `progressM` (ou − `alongM`
de la cible, hors du tracé). C3 : juste à 20 m près.

**D+ restant.** Le profil d'altitudes est **celui de l'écran Infos** :
mêmes fonctions, mêmes clés de Query (TanStack Query, ADR 0007), donc 0
appel au moteur (ADR 0017, § 6 ; ADR 0020, § 6).
- Au départ, on calcule une fois la **montée cumulée** le long du profil,
  avec la méthode de l'ADR 0017 (seuil de 5 m), point par point :
  `climbAt[i]` = montée comptée jusqu'à l'altitude `i`.
- D+ restant = D+ total − `climbAt` au point du profil qui correspond à
  `progressM`. Les deux axes diffèrent de quelques mètres : on passe de
  l'un à l'autre par la proportion des longueurs.
- Au départ, il vaut exactement le D+ de l'écran Infos ; il ne remonte
  jamais en avançant ; il vaut 0 à l'arrivée.
- Altitudes manquantes (hors zone, échec) : « — » (règle « tout ou rien »,
  ADR 0017).

**Chiffres réels de l'arrivée** (décisions de design du 21 octobre) :
- **Positions gardées** : une position reçue (précision ≤ 50 m) est gardée
  si elle est à 10 m ou plus de la dernière gardée. Le bruit à l'arrêt ne
  s'ajoute pas. 35 km donnent environ 3 500 positions.
- **Distance** : somme des distances entre positions gardées, sur la
  sphère de Valhalla. Après une pause en arrière-plan, le saut entre la
  dernière position d'avant et la première d'après compte en ligne droite,
  comme le saut entre deux segments d'un GPX (ADR 0019, § 7). Voir la
  question 3.
- **D+** : **une seule** requête `height` à la fin (« Arrivée » ou
  « Terminer »), sur les positions gardées (`thinTrack` à 14 000 points),
  avec la requête de l'écran Infos (`buildHeightRequest` : une altitude
  tous les 30 m), puis `ascentDescent`. Pas d'appel par lots pendant le
  suivi : `height` coûte moins de 1 ms pour 42 km (ADR 0017). L'écran
  « ARRIVÉE ! » montre « … » le temps de la réponse.
  - Une position hors du rectangle de la zone, ou un moteur non utilisable :
    D+ « — » (« hors de la zone, pas d'infos », ADR 0017, § 5).
  - L'altitude du GPS ne sert jamais.
- **Durée** : de « Démarrer le suivi » à l'arrivée ou à « Terminer »,
  horloge du téléphone, pauses et arrière-plan compris.
- Le résumé n'est pas gardé (choix 6 de la spec).

### 5. État du suivi, GPS, écran allumé, arrière-plan

**5.1 Où vit l'état.** Dans un **TanStack Store** (magasin d'état), comme
le prévoit l'ADR 0007. Il est créé à l'ouverture de l'écran de suivi et
jeté à sa fermeture, sur le modèle de `DraftSession` (ADR 0017, § 7). Tout
changement passe par une fonction pure :

```ts
type TrackingEvent =
  | { type: 'fix'; fix: Fix }               // une position GPS
  | { type: 'guidance'; directions: Direction[] }
  | { type: 'pause'; at: number } | { type: 'resume'; at: number }
  | { type: 'tick'; at: number }            // chaque seconde : GPS perdu, attente du GPS
  | { type: 'finish'; at: number };         // « Terminer » confirmé
function reduceTracking(state: TrackingState, event: TrackingEvent): TrackingState;
```

- `TrackingState` contient : `status` (`tracking`, `paused`, `ended`),
  la fin (`arrived` ou `finished`), le placement (§ 2), la liste des
  directions, les positions gardées et la distance réelle, l'heure du
  départ et de la fin.
- L'arrivée est décidée dans `reduceTracking`, à la position qui la
  remplit.
- Les composants lisent leur part avec un sélecteur (`useStore`) : le
  panneau ne se redessine que si son contenu change.
- Pas de Pacer (limiteur de cadence, prévu par l'ADR 0007 pour cet
  écran) : le GPS donne une position par seconde, et la règle des 900 ms
  suffit.

**5.2 Cycle de vie.**

| Moment | Ce qui se passe |
|---|---|
| « Démarrer le suivi » (écran Infos) | permission « pendant l'utilisation » ; refusée : la boîte « Position désactivée » de l'onglet Carte, avec le texte de la maquette, et on reste sur Infos. Accordée : `router.push('/tracking/12')` |
| Ouverture | prise de zone (`useZoneHold`) ; ligne du suivi ; profil (cache) ; écran allumé ; abonnement GPS ; calcul des directions lancé (§ 1), sans attendre |
| Chaque position | `fix` → `reduceTracking` → Store → écran et caméra |
| Arrière-plan | `pause` : abonnement GPS coupé. L'écran allumé est rendu par le système |
| Retour | `resume` : abonnement GPS repris. L'avancement est intact ; la fenêtre a grandi (§ 2.3) |
| Arrivée, ou « Terminer » confirmé | `ended` : GPS coupé, écran libéré, requête `height` du D+ réel, résumé (v1/60) à la place du suivi, sur le même écran |
| « Fermer » (résumé) | `router.back()` vers l'écran Infos ; le Store est jeté |

- **Prise de zone** : une mise à jour de zone ne remplace pas le moteur
  pendant le suivi (ADR 0018, § 4).
- **Arrière-plan** : seulement l'état `background` d'`AppState`. L'état
  `inactive` d'iOS (centre de contrôle, appel entrant) ne coupe rien.
- Si le système ferme l'app en arrière-plan, le suivi est perdu. Voir la
  question 2.

**5.3 GPS.** `expo-location`, **API classique**, `watchPositionAsync` :
`accuracy: Accuracy.BestForNavigation`, `timeInterval: 1000` (Android),
`distanceInterval: 0`. Permission « pendant l'utilisation » seulement,
celle de l'onglet Carte.
- L'API `expo-location/next` de l'ADR 0006 sert au suivi verrouillé, en V2.
  Au premier plan, l'API classique suffit : elle est stable et documentée
  pour le SDK 58 (« seulement quand l'app est au premier plan », ce qui
  est le besoin de la 8a).
- La position de l'onglet Carte (MapLibre) reste allumée sous le suivi.
  Deux lecteurs du GPS pendant le suivi : accepté en 8a ; la batterie se
  mesure en phase 10.

**5.4 Écran allumé.** `expo-keep-awake` **~58.0.3** (version du SDK 58,
`npx expo install expo-keep-awake`, sans plugin ni permission). Le hook
`useKeepAwake('tracking')` est monté dans le composant de suivi, et
démonté au résumé. L'écran n'est donc gardé allumé que pendant le suivi
(C8).

**5.5 Navigation, « Terminer », retour d'Android.**
- `src/app/tracking/[id].tsx`, fichier mince, et sa ligne dans
  `app/_layout.tsx` : `presentation: 'fullScreenModal'`,
  `headerShown: false`, `gestureEnabled: false` (comme la création,
  ADR 0016, § 6).
- `usePreventRemove(status !== 'ended', …)` bloque toute sortie, retour
  d'Android compris. Il ouvre la boîte « Terminer la sortie ? » (textes de
  la maquette). « Terminer » envoie `finish` ; on reste sur l'écran, qui
  montre le résumé. C7 : la même boîte pour le bouton et pour le retour.
- Sur le résumé, le retour d'Android ferme, comme « Fermer ».

### 6. Structure du code (ADR 0011, 0014, 0015)

| Dossier | Contenu |
|---|---|
| `modules/valhalla-route/` | `traceRoute` dans `index.ts`, `ValhallaRouteModule.swift`, `ValhallaRouteModule.kt` ; l'imitation (mock) de `jest.setup.js` en gagne une |
| `core/routing/` | `guidanceRequest.ts` : `buildTraceRouteRequest`, `buildMatchedEdgesRequest`. `guidanceResponse.ts` : `parseTraceRouteResponse` (forme recalée, manœuvres : type, `begin_shape_index`, longueur, sortie de rond-point), `parseMatchedEdges`. Ne lèvent jamais d'erreur. `routingEngine.ts` : `traceRoute`, `matchedEdges` |
| `core/routes/track.ts` | `spaceEvery(line, stepM)` à côté de `thinTrack` |
| `core/tracking/` (nouveau) | `trackingLine.ts` : ligne, distances cumulées, plan local, parties guidées et libres d'un itinéraire gardé. `nearest.ts` : `nearestOnLine`, `passagesNear`. `placement.ts` : § 2. `guidance.ts` : `buildGuidance` (§ 1.3 à 1.6). `directionText.ts` : clé et paramètres d'une direction. `remaining.ts` : distance et D+ restants. `ride.ts` : positions gardées, distance réelle. `trackingState.ts` : `TrackingState`, `reduceTracking`, `panelOf`. `testing/fabricate.ts` : lignes et traces fabriquées. `fixtures/` |
| `shared-data/routing/` | `computeGuidance.ts` : `computeTraceRoute`, `computeMatchedEdges`, aussi minces que `computeHeights` |
| `features/map/` | `useRouteAltitudes.ts` : le calcul du profil sorti de `SavedRouteInfoScreen` (itinéraire créé et GPX), pour Infos et suivi. Le bouton « Démarrer le suivi » dans `SavedRouteInfoScreen` (maquette v1/20) |
| `features/map/tracking/` (nouveau) | `TrackingScreen.tsx` (suivi puis résumé), `TrackingSession.tsx` (Store, effets : GPS, `AppState`, écran allumé, directions, D+ réel), `useGpsFixes.ts` (`expo-location`), `TrackingMap.tsx` (fond, ligne roulée et restante, point, caméra), `GuidancePanel.tsx`, `TrackingFooter.tsx`, `RideSummary.tsx` (v1/60) |
| `app/` | `tracking/[id].tsx` ; sa ligne dans `_layout.tsx` |
| `core/i18n/fr.ts` | tous les textes nouveaux (`tracking.*`, `ride.*`) |

- **Le suivi reste dans `features/map/`**, dans un sous-dossier. Il a
  besoin du fond de carte (`ZoneBaseMap`, `mapStyle`) et du calcul des
  infos (`useLegResults`, `useLegInfos`, `useTrackInfos`), tous dans
  `features/map/`. Une fonctionnalité `features/tracking/` à part
  demanderait d'abord de sortir le fond de carte et ces hooks : un gros
  déplacement sans second utilisateur. Même raison qu'aux ADR 0016, 0017
  et 0019. ESLint permet `../` depuis le sous-dossier.
- **Qui importe quoi** : `core/tracking/` importe `core/routes/`,
  `core/routing/`, `core/route-info/` et `core/i18n/`, plus `core/draft/`,
  `core/gpx/` et `core/zones/` pour leurs types, `trackLengthM` et le
  rectangle de la zone (complété en T2 ; permis par l'ADR 0011 § 3).
  `features/map/tracking/` importe `core/`, `shared-data/`, `ui/`,
  `../` (le reste de `features/map/`), `expo-location`, `expo-keep-awake`
  et MapLibre. Seul `shared-data/routing/` touche le module natif.
- **Dépendance nouvelle** : `expo-keep-awake` seulement.

### 7. Tests

**Jest, logique pure (`core/`)** :

| Quoi | Données | Attendu |
|---|---|---|
| Placement (C3) | lignes fabriquées en mètres (`testing/fabricate.ts`) : ligne droite de 2 km, boucle, aller-retour sur le même chemin, lacets avec deux passages à 20 m, croisement en 8 ; traces à 5 m/s avec un bruit de 8 m à graine fixe | distance restante juste à 20 m près ; jamais de saut sur l'autre passage ; une boucle ne finit pas au départ |
| Écart (C5) | trace qui s'écarte de 80 m pendant 40 s puis revient ; trace qui oscille entre 20 et 30 m | `offTrack` après 2 positions, retour sous 20 m, aucun clignotement ; reprise au bon endroit |
| Reprise ailleurs | départ à 500 m du tracé ; raccourci vers l'avant ; retour en arrière | règles 1 et 5 du § 2.3 |
| Arrivée (C6) | boucle ; aller simple ; arrivée en étant `offTrack` | à 30 m et 90 % seulement |
| Directions (C2) | **réponses enregistrées de l'essai** : `1-trace_route-map_snap-reponse.json` avec la ligne de `1-route-reponse.json` ; `2-…` avec le circuit 11656724 de `core/routes/fixtures/nancyCircuits.json` ; `3-…` avec `3-gpx-simule.gpx` ; `3d-…` sans bruit | la liste de consignes, dans l'ordre, égale une liste de référence écrite depuis les fichiers `*-directions-*.md` de l'essai (référence externe, ADR 0011, § 5). GPX : pas de demi-tour fantôme, « Suivez le tracé » sur les 741 derniers mètres, arrivée au bout de la ligne |
| Parties libres | itinéraire avec un tronçon à la main ; GPX qui sort de la zone ; moteur en échec | « Suivez le tracé » avec la bonne raison |
| Textes | chaque type Valhalla du tableau du § 1.4 | la bonne clé, ou retirée |
| D+ restant | profil à D+ connu | égal au D+ de l'écran Infos au départ, décroissant, 0 à la fin |
| Chiffres réels | trace fabriquée avec arrêts et pause | distance, filtre de 10 m, durée pauses comprises |
| `reduceTracking` | pause puis reprise ; « Terminer » ; arrivée | avancement intact ; GPS coupé demandé |

- Les réponses `matchedEdges` (`trace_attributes` en `map_snap`) n'ont pas
  été enregistrées par l'essai : T2 les enregistre sur le Mac, avec les
  scripts de l'essai et le même Docker (contrôle M1).
- Les fichiers de l'essai sont copiés dans `core/tracking/fixtures/`, avec
  un `SOURCE.md` qui dit d'où ils viennent (comme `core/routing/fixtures/`).

**Testing Library (`features/`)** : l'écran de suivi affiche chaque état
du panneau ; « Terminer » ouvre la boîte ; le résumé s'affiche ;
`expo-keep-awake` et `expo-location` sont imités.

**Traces rejouées sur les simulateurs (T6, C13)** :
- Traces dans `mobile/e2e/gps/` : une position par seconde
  (`lat,lon` par ligne), fabriquées par `mobile/e2e/gps/fabriquer.py`
  (Python 3 standard, `python3 -I`) depuis les itinéraires de référence,
  à 5 m/s, avec un écart de 80 m et un retour, et une variante « Terminer
  avant l'arrivée ».
- **iOS** : `xcrun simctl location "iPhone 17" start --speed=5 <lat,lon> <lat,lon> …`
  (le simulateur va d'un point à l'autre à cette vitesse), puis
  `xcrun simctl location "iPhone 17" clear`.
- **Android** (`emulator-5584`) : le script envoie une position par
  seconde avec `adb -s emulator-5584 emu geo fix <lon> <lat>` (longitude
  d'abord).
- **Maestro** : la commande `travel` (points et vitesse) déplace la
  position depuis le scénario. Si le contrôle B1 la montre fiable sur les
  deux plateformes, C13 l'utilise ; sinon le testeur lance le script de
  rejeu à côté du scénario.

### 8. Luminosité

Hors de la phase 8a : réglage, roue dentée et panneau 31b sont en phase 8b
(C9), avec leur propre ADR ou complément.

## Alternatives rejetées

**Directions**
- **`trace_route` seul, sans contrôle** : sur un GPX, une fin manquante ou
  29 % du tracé seulement, sans erreur (essai).
- **Virages calculés d'après la forme, seuls ou en parade** : bruit d'une
  trace GPS, seuils à régler sans données, risque de directions absurdes
  (§ 1.5). En réserve.
- **`edge_walk`** : erreur 443 après un point `through`.
- **`route` tronçon par tronçon pour un itinéraire créé** : un circuit et
  un GPX n'ont pas de tronçons du moteur ; deux chemins de code.
- **Garder les directions dans la base** : montée de version, et rien pour
  les GPX déjà importés (choix 1 de la spec).
- **Texte du moteur** : hors de `fr.ts`, voix de voiture, noms de rue.
- **Texte sans type de voie** (« Tournez à gauche » seul) : plus simple,
  mais la maquette demande « sur le sentier », et c'est la seule aide à un
  carrefour sans nom. Le prix est un appel natif de plus au départ.
- **Type de voie tiré du terrain de l'écran Infos** (`walk_or_snap`, par
  tronçon, sans indices) : il faudrait le caler par longueurs cumulées,
  imprécis juste au carrefour.

**Placement**
- **Point le plus proche sur toute la ligne** : saute sur l'autre passage
  d'une boucle ou d'un aller-retour (contraire à C3).
- **Avancement qui ne recule jamais** : faux si l'on fait demi-tour pour
  de bon.
- **Index spatial (grille)** : inutile pour 14 000 segments au plus.
- **`@turf/turf`** : une grosse dépendance pour deux fonctions.
- **Seuil unique de 30 m, sans délai** : clignote en forêt, où la
  précision est de 10 à 20 m.

**Caméra et GPS**
- **Suivi de position de MapLibre (`followUserLocation`)** : une seconde
  source de position, différente de celle de la logique ; cap du GPS
  bruité à l'arrêt.
- **`expo-location/next`** dès la 8a : en bêta, utile seulement en
  arrière-plan (V2).
- **Point affiché toujours à la position GPS** : flotte à côté du trait.

**Chiffres réels**
- **Altitude du GPS** : trop bruitée (spec).
- **`height` par lots pendant le suivi** : du code et des appels pour un
  calcul qui coûte moins de 1 ms à la fin.

**État**
- **État dans React (`useReducer`)** : les rappels du GPS et d'`AppState`
  liraient une copie périmée ; tout l'écran se redessinerait à chaque
  position.
- **Store global au niveau du module** : survivrait à l'écran.
- **Résumé sur une route à part** : il faudrait passer les chiffres par
  l'adresse ou par une variable globale.

## Conséquences

- Positif : toute la logique du suivi est pure, dans `core/`, testée sans
  téléphone, sur les réponses réelles de l'essai.
- Positif : une seule primitive (`nearestOnLine`) pour la position GPS, les
  manœuvres et le contrôle de la réponse.
- Positif : itinéraire créé, circuit et GPX passent par le même chemin.
  Un passage mal recalé ou hors zone dit « Suivez le tracé » au lieu d'une
  direction fausse.
- Positif : le D+ restant au départ égale celui de l'écran Infos, sans
  nouvel appel.
- Négatif : deux appels natifs au départ (`trace_route`, `matchedEdges`),
  plus un à la fin (`height`). Coût mesuré sur le Mac : 12 à 44 ms chacun.
- Négatif : le module passe à 6 fonctions ; l'imitation de `jest.setup.js`
  en gagne une.
- Négatif : `features/map/` grossit encore (sous-dossier `tracking/`).
- Négatif : si le système ferme l'app en arrière-plan, le suivi est perdu
  (question 2).
- Négatif : la distance réelle compte en ligne droite le trou d'une pause
  en arrière-plan (question 3).
- Négatif : deux lecteurs du GPS pendant le suivi (onglet Carte et suivi).
- À l'acceptation : l'ADR 0006 reçoit « au premier plan (phase 8a) : API
  classique `watchPositionAsync`, pas de `@turf/turf` : ADR 0021 » ;
  l'ADR 0007 reçoit « pas de Pacer pour l'écran de suivi : ADR 0021 » ;
  l'ADR 0015 (§ 1) reçoit « `traceRoute` ajouté : ADR 0021 ».

## Notes pour le designer

- **Cap à l'arrêt** : la maquette dit « à l'arrêt, cap inconnu, nord en
  haut ». Sur le tracé, le cap est celui du tracé : il reste connu à
  l'arrêt, et la carte ne tourne pas à chaque pause. Nord en haut
  seulement avant le premier mouvement, ou à l'arrêt hors du tracé.
- **Partie libre à venir** : proposée comme une direction « Suivez le
  tracé » dans {distance}, panneau blanc. À confirmer.
- **Départ rejoint plus loin** : ce qui est avant compte comme roulé (en
  gris).
- Zooms 15,5 et 16,5 : deux constantes, à régler sur les captures.

## Contrôles avant de bâtir dessus

**Partie B de l'essai T1, faite le 10 novembre 2026** en version finale
sur les deux simulateurs (preuves : `essais/08-suivi-velo/partie-b/`).
Résultats :

- **B1 prouvé.** Une position par seconde ; `coords.heading` existe avec
  `simctl location start` et `geo fix` en boucle. Maestro `travel` marche
  mais **sans cap** (iOS −1, Android 0) : les parcours Maestro ne comptent
  pas sur le cap du GPS (le cap du suivi vient du tracé, § 5).
- **B2 prouvé**, sauf la fluidité (« sans saccade »), reportée au vrai
  téléphone (phase 10). Le geste se lit par `userInteraction` sur
  `onRegionWillChange` et `onRegionDidChange` ; les `easeTo` du code
  donnent `false`. Un geste long prolonge la pause de 10 s. Ne pas lire
  la position de la caméra dans `onRegionDidChange` d'un `easeTo` (un
  cycle de retard).
- **B3 prouvé.** iOS : `isActivated` (`isIdleTimerDisabled`). Android :
  `dumpsys power` avec un délai de veille court. Le module relâche le
  verrou en arrière-plan et le reprend seul au retour.
- **B4 prouvé.** `traceRoute` ajouté au module natif ; réponses identiques
  au Mac sur iOS et Android, sauf le champ parlé
  `verbal_post_transition_instruction` (format du nombre selon la langue du
  téléphone) : l'app ne s'en sert pas. 10 à 210 ms par appel, départ sous
  0,25 s sur simulateur. Le Mac de référence doit utiliser les tuiles de
  la zone installée (même empreinte).
- **B5 partiel.** Aucun vrai GPX VTT disponible. Trace simulée (circuit de
  la Petite Suisse, bruit lent de 3 à 5 m) : 2,1 % sans direction,
  toujours la fin du circuit, non praticable à vélo pour Valhalla. Un vrai
  GPX reste à essayer (phase 10).
- **B6 prouvé.** Formes identiques pour 1 et 2 ; divergence pour 3 et 3d,
  ce qui confirme l'écart accepté (type de voie seulement sur la partie
  commune).
- **Règle ajoutée** : `npx expo run:android` a installé l'APK d'essai sur
  un téléphone réel branché, malgré `ANDROID_SERIAL` et `--no-install`.
  Construire par `./gradlew app:assembleRelease` puis
  `adb -s emulator-5584 install -r`.

Texte d'origine des contrôles (avant l'essai) :

- **B1. Trace rejouée** : une position avance chaque seconde, sur iOS
  (`xcrun simctl location … start`) et sur Android (`adb emu geo fix`
  en boucle), lue par `watchPositionAsync`. Noter si `coords.heading`
  existe, et si la commande `travel` de Maestro marche sur les deux.
- **B2. Caméra** : `camera.easeTo` avec `center`, `bearing`, `zoom`,
  `padding` et `duration: 1000`, une fois par seconde, suit la position et
  tourne avec le cap, sans saccade, sur les deux plateformes. Et la carte
  sait dire qu'un geste vient de l'utilisateur (pour la reprise après
  10 s).
- **B3. Écran allumé** : avec `useKeepAwake`, l'écran ne s'éteint pas
  au-delà du délai de mise en veille ; il s'éteint de nouveau après le
  démontage. Comportement après un passage en arrière-plan puis retour.
- **B4. `traceRoute` dans l'app**, en version finale, sur les deux
  plateformes : les réponses pour les 3 itinéraires de l'essai sont
  identiques à celles du Mac ; temps mesuré (C12 : départ en moins de 2 s).
  Un refus (forme vide) revient en JSON, sans plantage.
- **B5. Un vrai GPX de sortie VTT** (le GPX de la partie A est simulé),
  au moins 20 km en forêt : part « non recalé », directions relues.
  Si plus de 10 % de la longueur est « non recalé », le signaler au
  pilotage (question 1).
- **B6. Les deux formes recalées** (`trace_route` et `trace_attributes`
  en `map_snap`, même forme envoyée) sont identiques, point pour point,
  sur les 3 itinéraires. Sinon : pas de type de voie dans la consigne, et
  le pilotage décide.

**Sur le Mac, début de T2** (Docker de l'essai) :
- **M1.** Enregistrer les réponses `trace_attributes` en `map_snap` des 3
  itinéraires (fixtures de Jest), et refaire les essais 1 et 2 avec la
  forme allégée à un point tous les 20 m : mêmes directions qu'avec tous
  les points.

**T6** : C12 en version finale (départ, 50 ms par position, une mise à jour
par seconde), méthode des phases 4 et 6.

**Non prouvé** : un vrai téléphone en forêt (GPS, batterie, confort de la
caméra) : phase 10.

## Écarts acceptés pendant la phase 8a

- 2026-11-10, T2, accepté par le pilotage : le type de voie n'est donné
  qu'aux manœuvres situées dans la partie où les formes recalées de
  `trace_route` et de `trace_attributes` sont identiques depuis le départ
  (plutôt que tout ou rien). Sur un GPX bruité, les consignes après la
  séparation des formes n'ont pas de type de voie.
- 2026-11-10, T2, accepté par le pilotage : texte « Au rond-point, 1re
  sortie » (la maquette ne donnait que « {n}e sortie »).
- 2026-11-10, T2, décision de la session de phase (relecture du
  testeur) : deux virages à moins de 25 m (`CHAIN_M`) s'annoncent
  ensemble, « Tournez à gauche sur la route, puis à droite sur la piste ».
  Deux au plus ; jamais avec l'arrivée ni « Suivez le tracé ». Reste à
  régler sur le terrain (phase 10) : virages du même côté sur la même
  voie entre 25 et 50 m (doublons d'une même courbe), et zigzags de 25 à
  55 m annoncés séparément.
- 2026-11-10, T2 : trois précisions du texte (§ 1.1 forme des filtres,
  § 2.2 définition d'un passage, § 6 imports), sans changement de
  décision.

## Questions tranchées par Émilien (10 novembre 2026)

Les trois recommandations sont retenues. La question 7 du designer est
tranchée aussi : **oui**, « Démarrer le suivi » marche pour un GPX hors de
vos zones ou une zone supprimée, tout en « Suivez le tracé », fond uni,
D+ « — ».


1. **Parade sur un passage mal recalé d'un GPX.** Recommandation :
   **« Suivez le tracé »** sur ce passage, comme sur un tronçon à la main.
   Autre choix : des virages calculés d'après la forme du tracé (choix 1
   de la spec) : plus de directions, mais plus de code, et des risques de
   directions absurdes sur une trace bruitée. On y revient si un vrai GPX
   VTT laisse plus de 10 % sans direction (contrôle B5).
2. **Si le système ferme l'app en arrière-plan, le suivi est perdu.**
   Recommandation : **l'accepter en 8a.** La pause est courte en usage
   normal (écran allumé, spec). Garder l'avancement sur le disque viendra
   avec le suivi verrouillé, en V2. Autre choix : garder l'avancement à
   chaque position, et proposer « Reprendre le suivi » au lancement :
   plus de code et une boîte de plus.
3. **Distance pendant une pause en arrière-plan.** Le GPS est coupé : on
   ne sait pas par où tu es passé. Recommandation : **compter la ligne
   droite** entre la position d'avant et celle d'après (même règle que les
   trous d'un GPX). Autre choix : ne rien compter pendant la pause (la
   distance serait plus courte que la vraie).

La question 7 du designer (« Démarrer le suivi » pour un GPX hors de vos
zones, ou une zone supprimée) reste la sienne. L'architecture permet les
deux réponses : sans zone en service, tout l'itinéraire est une partie
libre « hors zone », D+ restant et D+ réel « — ». Le « oui » coûte un style
de carte uni pour le fond.

## Sources (relevées le 10 novembre 2026)

- Essai T1, partie A : [LISEZMOI](../../essais/08-suivi-velo/LISEZMOI.md),
  `resultats/4-diagnostic-troncature.txt`, `5-ecarts-gpx.txt`,
  `6-sans-bruit.txt`, `1-directions-trace_route-map_snap.md`,
  `2-directions-trace_route-map_snap.md`, `outils.py` (table des types de
  manœuvre). Commit `4870904`.
- Maquette 30 complétée : `design/30-suivi-velo.html` (états, priorité,
  caméra, textes, formats). Décisions de design :
  [docs/06](../06-decisions-design.md).
- valhalla-mobile 0.6.4, `traceRoute(rawRequest:)` et `traceRouteRaw` :
  https://github.com/Rallista/valhalla-mobile/blob/0.6.4/apple/Sources/Valhalla/Valhalla.swift,
  https://github.com/Rallista/valhalla-mobile/blob/0.6.4/android/valhalla/src/main/java/com/valhalla/valhalla/Valhalla.kt
- Valhalla, `trace_route`, `trace_attributes`, `shape_match`, attributs
  `edge.begin_shape_index` et `shape` :
  https://valhalla.github.io/valhalla/api/map-matching/api-reference/
- Valhalla, types de manœuvre et `roundabout_exit_count` :
  https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/
- `expo-keep-awake` pour le SDK 58 (~58.0.3, `useKeepAwake`, étiquettes) :
  https://docs.expo.dev/versions/v58.0.0/sdk/keep-awake/ ; registre npm
  (dernière version 58.0.3) : https://registry.npmjs.org/expo-keep-awake
- `expo-location` pour le SDK 58 (`watchPositionAsync`, premier plan
  seulement, options, `coords.heading` qui peut être `null`, ~58.0.20) :
  https://docs.expo.dev/versions/v58.0.0/sdk/location/
- MapLibre React Native v11, `CameraRef.easeTo` (centre, cap, zoom, marge) :
  https://maplibre.org/maplibre-react-native/docs/components/camera ;
  changements de la v11 : https://maplibre.org/maplibre-react-native/docs/setup/migrations/v11
- Maestro, commande `travel` : https://docs.maestro.dev/api-reference/commands/travel
- Émulateur Android, commande `geo fix` de la console :
  https://developer.android.com/studio/run/emulator-console
- Simulateur iOS, `xcrun simctl location` : aide intégrée
  (`xcrun simctl help location`), à confirmer par B1.
- Code lu (commit `4870904`) : `core/routing/routingEngine.ts`,
  `routeRequest.ts`, `infoRequest.ts`, `routeResponse.ts` ;
  `core/routes/track.ts` ; `core/gpx/trackLengthM.ts` ;
  `core/route-info/routeInfo.ts`, `elevation.ts`, `terrain.ts` ;
  `features/map/MapPosition.tsx`, `SavedRouteInfoScreen.tsx`,
  `useTrackInfos.ts` ; `shared-data/routing/computeInfos.ts` ;
  `modules/valhalla-route/index.ts` ; `app/_layout.tsx` ;
  `eslint.config.js` ; `package.json`.
