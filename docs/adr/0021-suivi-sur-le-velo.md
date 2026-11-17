# ADR 0021 — Suivi sur le vélo : directions, placement sur le tracé, seuils, chiffres réels

- Statut : accepté pour la phase 8a (validé par Émilien le 10 novembre
  2026, avec les recommandations des 3 questions ci-dessous et des 8
  questions de la maquette 30). **Complément 8b (§ 8 à § 12) accepté** (validé par Émilien le 16
  novembre 2026, avec l'écart iOS de la luminosité et la réponse « oui »
  aux deux questions du complément).
- Date : 2026-11-10 (phase 8a, tâche T1 de [p08-suivi-velo](../phases/p08-suivi-velo.md)) ;
  complément le 2026-11-16 (phase 8b, tâche T1 de
  [p08b-suivi-velo-finitions](../phases/p08b-suivi-velo-finitions.md))
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
  (C10) et le trait de liaison (C11) sont en phase 8b.** Ils sont traités
  par le complément 8b (§ 8 à § 12), avec son propre contexte.
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

## Complément 8b (16 novembre 2026)

**Contexte du complément.**
- La spec validée fait foi :
  [p08b-suivi-velo-finitions](../phases/p08b-suivi-velo-finitions.md),
  critères C9 à C13 et « Choix déjà faits par le pilotage » 1 à 5.
  Questions 1 à 3 de la phase 8 : déjà tranchées le 10 novembre.
- **Essai T1 de la 8b**, fait le 16 novembre, builds release sur les deux
  simulateurs : [LISEZMOI](../phases/preuves/p08b/t1-essai/LISEZMOI.md).
  Les preuves citées plus bas sont dans ce dossier
  (`docs/phases/preuves/p08b/t1-essai/`).
- Ce que fait le code aujourd'hui (lu le 16 novembre, commit `d351964`) :
  - **Réglages** : un fichier `settings.json` (ADR 0013, § 6), lu par
    `parseSettings` (`core/settings/settings.ts`) et par la requête
    `useSettings` (`shared-data/settings/useSettings.ts`). Il ne garde que
    `wifiOnly`. **Piège** : `useSetWifiOnly` écrit `{ wifiOnly }` seul ;
    un second réglage serait effacé à chaque écriture ;
  - **onglet Carte** : la position vient de `useCurrentPosition` de
    MapLibre (`features/map/MapPosition.tsx`) ; le point bleu est fait de
    deux ronds posés dans `UserLocation`, sans flèche ni halo. Le bouton a
    deux états (permis, refusé). La caméra est bloquée sur le rectangle de
    la zone (`maxBounds`, `ZoneBaseMap.tsx`). À la première position dans
    la zone, la carte va sur elle au zoom 14 (`ZoneMap.tsx`) ; hors de la
    zone, elle reste sur toute la zone et affiche « hors de la zone » ;
  - **trait de liaison** : `linkSegments` (`core/routing/routeLink.ts`,
    seuil `MIN_LINK_METERS = 5`) dessine les deux bouts de chaque tronçon
    calculé. **L'écran Infos d'un itinéraire créé, sur une zone en
    service, le dessine déjà** : `CreatedInfos` passe `geometry.links`
    (`mainGeometry`, à partir des tracés gardés). Il manque sur l'écran
    Infos d'un itinéraire qui sort de la zone (`PlainInfos`, cas
    `leaves`) et pendant le suivi ;
  - **suivi** : les pointillés de l'écart sont des ronds posés tous les
    10 points d'écran, espacés en mètres selon le zoom gardé dans l'état
    (`gapDots`, `TrackingMap.tsx`). Le zoom d'un cadrage est prévu par
    `boundsZoom`, puis la caméra fait `fitBounds`.

### 8. Luminosité pendant le suivi (C9)

**8.1 Bibliothèque.** `expo-brightness` **~58.0.3**, la version du SDK 58
(`npx expo install expo-brightness`). Elle est d'Expo, publiée avec le
SDK 58 (version 58.0.3 étiquetée `latest` sur npm le 16 novembre 2026).
Pas de dépendance au-delà d'`expo` et de `react-native`.

**8.2 Ce que fait chaque plateforme** (essai, point 1) :

| | Android | iOS |
|---|---|---|
| `setBrightnessAsync(1)` | change **la fenêtre de l'app seule** ; le réglage du téléphone ne bouge pas (`android-luminosite-dumpsys.txt`) | change **tout le téléphone** (doc Apple, `doc-apple-uiscreen-brightness-extrait.txt`) ; sans effet visible sur le simulateur (`ios-log-luminosite.txt`) |
| Rendre | `restoreSystemBrightnessAsync()` : la fenêtre reprend le réglage du téléphone, luminosité adaptative comprise | réécrire la valeur lue avant (`setBrightnessAsync(valeur)`) ; `restoreSystemBrightnessAsync` n'y fait rien |
| Arrière-plan | rendu par le système, seul ; au retour, la fenêtre garde son réglage | rien n'est rendu seul : l'app doit le faire sur `background` ; elle en a le temps (`ios-log-luminosite-arriere-plan.txt`) |
| App fermée de force | rendu par le système, seul | **rien ne peut le rendre** : la luminosité reste au maximum jusqu'au verrouillage du téléphone |

**8.3 Ce que l'app fait, et quand.** Une règle pure décide :

```ts
// core/tracking/brightness.ts
export type BrightnessChoice = 'auto' | 'max';
export function wantsMaxBrightness(choice: BrightnessChoice, status: TrackingStatus): boolean;
// vrai seulement si choice === 'max' et status === 'tracking'
```

`paused` (arrière-plan) et `ended` (résumé) donnent donc « rendre ». Un
hook (fonction React réutilisable) `useTrackingBrightness`, monté dans
`TrackingSession`, applique la règle :

| Moment | Android | iOS |
|---|---|---|
| Passage à « maximum » (départ du suivi, choix changé, retour au premier plan) | `setBrightnessAsync(1)` | lire `getBrightnessAsync()` et la garder (sauf si déjà au maximum par nous), puis `setBrightnessAsync(1)` |
| Passage à « rendre » (choix « Automatique », fin du suivi, résumé) | `restoreSystemBrightnessAsync()` | `setBrightnessAsync(valeur gardée)`, puis oublier la valeur |
| `AppState` = `background` | rien à faire (le système rend) ; le hook rend quand même, sans risque | rendre **tout de suite**, dans l'écouteur d'`AppState`, sans attendre un rendu React |
| `AppState` = `inactive` (centre de contrôle, appel) | rien | rien |
| Retour `active`, suivi en cours, choix « Maximum » | remettre le maximum (une ligne de plus, sans risque) | relire la valeur du téléphone (la personne a pu la changer), puis le maximum |
| Démontage de l'écran de suivi | rendre | rendre |

- Chaque appel est dans un `try … catch` : un échec laisse la luminosité
  comme elle est, sans planter le suivi.
- **Écart accepté, iOS** : si l'app est fermée de force ou plante pendant
  le suivi avec « Maximum », l'écran reste au maximum **jusqu'au
  verrouillage du téléphone**. Apple le documente : le système remet le
  réglage d'origine au déverrouillage suivant. Aucune parade possible
  dans l'app. Pendant le suivi l'écran est gardé allumé (`useKeepAwake`) :
  seul le bouton latéral le verrouille. « Automatique » (par défaut) n'a
  jamais cet écart.
- Rien ne touche le placement ni le Store du suivi : C13 n'est pas
  concerné.

**8.4 Permission Android.** Le plugin de configuration d'`expo-brightness`
s'applique seul au `prebuild` (génération des dossiers natifs) et ajoute `WRITE_SETTINGS`, permission
spéciale mal vue sur Google Play (`android-permissions-sans-plugin.txt`).
L'app n'en a pas besoin : elle ne change jamais le réglage du téléphone
(`setSystemBrightnessAsync` n'est pas utilisé). Dans `app.json` :

```json
"android": { "blockedPermissions": ["android.permission.WRITE_SETTINGS"] }
```

Prouvé par l'essai : l'APK (paquet d'installation Android) ne contient plus la permission
(`android-permissions-avec-blockedPermissions.txt`), et la luminosité par
fenêtre ne s'en sert pas. Aucun plugin ni permission sur iOS.

**8.5 Où vit le réglage.** Dans `settings.json`, à côté de `wifiOnly` :

```ts
// core/settings/settings.ts
export type Settings = { wifiOnly: boolean; brightness: BrightnessChoice };
export const defaultSettings: Settings = { wifiOnly: true, brightness: 'auto' };
```

- `parseSettings` lit **chaque champ à part** : un champ absent ou faux
  prend sa valeur par défaut, sans effacer l'autre. Un fichier de la
  phase 2 (sans `brightness`) donne donc « Automatique ».
- **Écriture par fusion** : `updateSettings(patch)` dans
  `shared-data/settings/settingsFile.ts` relit le fichier, fusionne,
  écrit. Les écritures passent l'une après l'autre (une promesse
  enchaînée), pour que deux touches rapides ne se perdent pas.
  `useSetWifiOnly` passe par elle ; `useSetBrightness` est nouveau, sur le
  même modèle (`setQueryData` après l'écriture).
- **Une seule lecture** : l'onglet Réglages, le panneau 31b et le hook de
  luminosité lisent `useSettings()`. Même clé de Query : changer l'un
  change l'autre tout de suite, et le choix reste d'une sortie à l'autre.
- Pas de Store : le réglage est une donnée gardée, lue par Query
  (règle de l'ADR 0007).

**8.6 Roue dentée et panneau 31b** (maquettes 30 et 31b).
- Roue dentée sur l'écran de suivi ; noire tant que le panneau est
  ouvert. Le panneau est une simple `View` en bas de l'écran, **pas une
  `Modal`** : pas de voile, la carte et le panneau du haut continuent de
  vivre et de répondre. « Reste » est masqué tant qu'il est ouvert ; la
  caméra prend une marge du bas égale à sa hauteur (position visible
  au-dessus).
- Fermeture : « Fermer », la roue dentée, glisser vers le bas
  (`PanResponder`, outil de geste de React Native, sans dépendance
  nouvelle), et le retour
  d'Android. Pour le retour : le rappel de `usePreventRemove` ferme le
  panneau s'il est ouvert, sinon il ouvre « Terminer la sortie ? » comme
  aujourd'hui.
- **Fermeture seule à moins de 100 m d'une direction.** La distance vient
  de `panelOf(state).imminent` (`core/tracking/trackingState.ts`,
  `IMMINENT_M = 100`) : c'est le seuil qui fait passer le panneau du haut
  au jaune (prochain virage ou arrivée à 100 m ou moins). Le panneau 31b
  se ferme au **passage** de `imminent` de faux à vrai. Ouvert alors que
  `imminent` est déjà vrai, il reste ouvert jusqu'au prochain passage :
  sinon la roue dentée ne ferait rien à l'approche d'un virage.
  « Suivez le tracé » à venir et l'écart ne ferment pas le panneau (ils ne
  passent jamais au jaune).
- Un seul réglage dans le panneau en v1 (choix 4 du pilotage).

### 9. Onglet Carte : position, cap, recentrage, cadrage hors zone (C10)

**9.1 Le point, la flèche, le halo : nos propres couches.** On n'utilise
plus `UserLocation` de MapLibre (bibliothèque de carte). Raisons, tirées
de l'essai (point 2) :
- son halo est faux : environ **deux fois** le vrai rayon à Nancy au
  zoom 17 (23 px pour 12,7 px à 5 m), car il suit une formule fixe ;
- on ne peut changer ni sa flèche ni ses couleurs sans la remplacer, et la
  maquette 90 veut un rond bleu de 32 bordé de blanc, avec une **flèche
  blanche** ;
- nos couches sont **prouvées** sur les deux plateformes
  (`ios-own-manual-2-trace-t12.png`, flèche à 187° ;
  `ios-own-manual-1-position-fixe.png`, rond seul ;
  `android-own-manual-4-apres-bouton-suit.png`).

Une source GeoJSON (format de données géographiques) `position`, un point,
avec ses propriétés, **au-dessus de toutes les autres couches** (voile et
bord de la zone compris). Les valeurs exactes sont celles de la maquette
90 complétée (`design/v1/90-carte.html`, note « Pour l'architecte et le
développeur », § 1) et de `design/tokens.md` (`marqueur.position`,
`marqueur.position-halo`). De bas en haut :

| Couche | Dessin |
|---|---|
| `position-halo` (circle) | rayon exact : `['interpolate', ['exponential', 2], ['zoom'], 0, ['get', 'r0'], 22, ['*', ['get', 'r0'], 4194304]]` (expression de l'essai) ; `#1A73E8` à 16 %, bord de 1 à 40 %. Pas de halo si la précision est inconnue (pas de `r0`) |
| `position-ombre` (circle) | souhaitée par le designer : rayon 16, noir à 25 %, flou 0,5, décalée de 2 vers le bas. Retirée si elle coûte (C13) |
| `position-rond` (circle) | rayon 13, `#1A73E8`, bord blanc de 3 : 32 de diamètre |
| `position-fleche` (symbol) | image `fleche-cap`, `icon-size` 0,8, `icon-rotate: ['get', 'heading']`, `icon-rotation-alignment: 'map'`, `icon-allow-overlap` et `icon-ignore-placement` ; filtre `['has', 'heading']` |

- `r0` = précision (m) / (78 271,517 × cos(latitude)) : le rayon en points
  au zoom 0, tuiles de 512 points. `metersPerPoint` sort de
  `features/map/tracking/trackingGeometry.ts` vers `core/position/` pour
  servir aux deux.
- L'image `fleche-cap` est un PNG transparent de 40 × 40 points
  (`mobile/assets/images/fleche-cap.png`, en @2x et @3x), tiré du tracé
  de la maquette (`M20 8 L28.5 28 L20 23.5 L11.5 28 Z`, pointé au nord),
  déclaré par le composant `Images` de MapLibre. C'est aussi la flèche du
  suivi (taille 1).
- **Le même composant sert à l'écran de création** (maquette 10) : flèche
  et halo compris. Son bouton garde deux états (repos, refusé) : **pas de
  « suit ma position »** pendant qu'on pose des points. Le composant de
  couches s'appelle `UserPuckLayers` (`features/map/`), à la place de
  `UserPositionLayers`.
- Le point de l'écran de suivi : voir la question (a) plus bas.

**9.2 Une seule source de position : celle de MapLibre.** `useCurrentPosition`
(déjà utilisé) pour le dessin ; `trackUserLocation` (§ 9.4) pour la
caméra. Les deux passent par le gestionnaire de position de MapLibre, pas
par `expo-location`. `expo-location` ne sert qu'à la permission, comme
aujourd'hui.

Pourquoi pas `expo-location` pour le dessin : il donne un cap à `0`
(Android) ou `-1` (iOS) quand le cap est inconnu, avec une vitesse nulle
(essai). MapLibre donne `null` dans ces cas (code lu, v11.5.0) :
- iOS : `heading` = `CLLocation.course`, mis à `null` s'il est négatif
  (`ios/modules/location/MLRNLocation.m`) ;
- Android : `heading` = `location.bearing` seulement si
  `location.hasBearing()`, sinon `null`
  (`android/.../modules/MLRNLocationModule.kt`).

C'est donc le **cap du mouvement** (la course), pas la boussole : la
direction où l'on va, comme le veut la maquette.

**9.3 Règle du cap.** Une seule règle, celle de la maquette 90 (elle
remplace la règle « sans délai » de la première version de ce
complément). Fonction pure, avec un petit état
(`core/position/userPuck.ts`) :

```ts
export const MIN_HEADING_SPEED_MS = 0.5;
export const SLOW_HIDE_MS = 5_000;
type HeadingState = { heading: number | null; slowSince: number | null };
export function nextHeading(state: HeadingState, coords: { heading: number | null; speed: number | null }, at: number): HeadingState;
```

À chaque position :
1. `heading` absent, pas un nombre fini, ou hors de 0 à 360 :
   **pas de flèche** (`heading: null`), tout de suite.
2. Vitesse connue et **au moins 0,5 m/s** (ou vitesse inconnue) : la
   flèche prend ce cap ; `slowSince` est remis à `null`.
3. Vitesse connue et sous 0,5 m/s : la flèche **garde le dernier cap**
   pris à 0,5 m/s ou plus ; `slowSince` note l'heure du début. Après
   **plus de 5 s** de suite sous 0,5 m/s, la flèche disparaît.

Pourquoi le délai : à basse vitesse la course est bruitée, et un arrêt
de quelques secondes (carrefour, montée raide) ne doit pas faire
clignoter la flèche. Entre deux positions, la flèche ne bouge pas. Sans
cap, la propriété `heading` est absente du point : le filtre cache la
flèche, il reste le rond et le halo. Sur l'émulateur Android, une
position répétée arrive sans cap : la flèche peut disparaître une
seconde (règle 1). Le confort réel se juge en phase 10.

**9.4 Le bouton de recentrage, trois états.**

| État | Quand | Dessin (maquette 90) | Toucher |
|---|---|---|---|
| Position refusée | permission non accordée | viseur barré | demande la permission, ou la boîte « Position désactivée » qui mène aux réglages (code actuel) |
| Repos | permission accordée, la carte ne suit pas | fond crème clair, viseur brun | voir la règle du § 9.5 |
| Suit ma position | `trackUserLocation="default"` actif | fond brun, viseur crème | rien de plus (reste « suit ») |

La caméra qui suit est celle de MapLibre : prop
`trackUserLocation="default"` du composant `Camera`, et
`onTrackUserLocationChange`. Prouvé sur les deux plateformes
(`ios-log-js-native.txt`, `android-log-js-native.txt`, captures
`*-js-native-3-apres-geste.png` puis `*-4-apres-bouton-suit.png`).

- **État « suit »** = un booléen `following` de l'écran. La prop vaut
  `'default'` s'il est vrai, `undefined` sinon.
- **Sortie au glissement** : MapLibre sort seul du suivi quand on
  déplace la carte d'un doigt, et envoie `onTrackUserLocationChange` avec
  `null`. On met alors `following` à faux. Sur Android l'événement arrive
  deux fois : mettre à faux deux fois ne change rien.
- **Zoomer garde « suit »** (maquette 90 : double toucher, deux doigts).
  Le suivi de MapLibre garde le zoom courant pendant qu'il suit (essai),
  mais l'essai n'a testé que le glissement. Le contrôle T3-a vérifie le
  zoom au double toucher et aux deux doigts. Si MapLibre sort du suivi au
  zoom, on l'accepte (le designer l'accepte aussi) : le bouton repasse au
  repos par le même `null`, sans code de plus.
- **Notre code bouge la caméra** (cadrer un circuit touché, aller au bord
  de la zone) : `following` passe d'abord à faux. **Feuille d'un circuit
  refermée** : la carte revient où elle était (code actuel) ; si elle
  suivait avant, `following` repasse à vrai.
- **On sort de la zone en étant suivi** (une position hors du
  rectangle) : `following` passe à faux et le message « hors de la
  zone » apparaît. La caméra ne peut pas suivre au-delà de `maxBounds`
  (§ 9.5).
- **Toucher au repos, position connue dans la zone** : si le zoom est
  sous 15, d'abord `easeTo({ center, zoom: 15, duration: 500 })`, puis
  `following` à vrai à la fin du mouvement ; sinon `following` à vrai
  tout de suite (zoom gardé).
- **Toucher au repos, pas encore de position** : `following` passe à vrai
  **tout de suite** (maquette 90). À la première position, la règle du
  § 9.5 s'applique comme pour un toucher : dans la zone, la carte la
  suit ; hors zone, `following` repasse à faux et la carte fait le
  cadrage du cas (`near` ou `far`).
- **Permission accordée** (au retour des réglages du téléphone, ou à la
  réponse de la demande) : `following` passe à vrai, puis même règle à la
  première position. Avant la réponse à la première demande : viseur au
  repos, pas barré.
- Libellés lus : « Recentrer sur ma position » (repos, existant), « La
  carte suit ma position » (suit), « Position désactivée » avec l'indice
  « Touchez pour l'autoriser dans les réglages » (refusé). Textes dans
  `fr.ts`.
- Le suivi de MapLibre est permis ici, alors qu'il est rejeté pour l'écran
  de suivi (§ 3) : sur l'onglet Carte il n'y a pas de position « posée sur
  le tracé » à montrer ; la position du téléphone est la bonne.

**9.5 Ouverture et cadrage, dans la zone et hors de la zone.** Fonction
pure (`core/zones/opening.ts`) :

```ts
export const NEAR_ZONE_M = 10_000;
export const NEAR_MAX_ZOOM = 14;
export function openingPlan(bbox: Bbox, lon: number, lat: number):
  | { kind: 'inside' }
  | { kind: 'near'; edge: [number, number] }
  | { kind: 'far' };
export function nearZoom(edge: [number, number], position: [number, number],
  map: { width: number; height: number },
  keep: { side: number; top: number; bottom: number }): number;
```

- **Forme de la zone : le rectangle** (`zone.bbox`). C'est la seule forme
  que donne le catalogue (ADR 0003), celle du voile hors zone et de
  `maxBounds`.
- **Bord le plus proche** = `clampToBbox(bbox, lon, lat)` (déjà dans
  `core/zones/activeZone.ts`). Distance = `distanceMeters` (haversine,
  `core/routing/routeLink.ts`) entre la position et ce point.
- `inside` : position dans le rectangle. `near` : dehors, à 10 km ou moins
  du bord. `far` : au-delà.

**Cadrage `near` : centré sur le bord, `maxBounds` inchangé** (règle de la
maquette 90, écran 4 ; elle remplace le « `maxBounds` élargi » de la
première version de ce complément).
- **Centre** = le point du bord le plus proche (`edge`), rentré de
  0,000001° (environ 0,1 m) vers l'intérieur du rectangle, pour ne pas
  dépendre d'une égalité de nombres à virgule sur le bord.
- **Zoom** = `nearZoom` : le plus fort, **14 au plus**, qui garde le
  centre de la position à au moins **48** des bords gauche et droit de la
  carte, **140** de son haut (sous le message) et **32** au-dessus de
  « Nouvel itinéraire ». Calcul en Mercator (projection de la carte, monde
  de 512 points au zoom 0) : décalage de la position au zoom 0 (`dx0`,
  `dy0`), puis `zoom = min(14, log2(placeX / |dx0|), log2(placeY / |dy0|))`,
  où `placeX = largeur / 2 − 48`, et `placeY = hauteur / 2 − 140` si la
  position est au-dessus du centre, `hauteur / 2 − marge du bas` sinon.
  Un décalage nul ne compte pas. La marge du bas = hauteur de la carte −
  haut du bouton « Nouvel itinéraire » + 32, mesurée par `onLayout`. À
  10 km, environ 9,6 (le minimum de la carte est 8).
- Mouvement : `easeTo({ center, zoom, padding: NO_PADDING, duration: 300 })`.
  Bouton au repos : la carte ne peut pas suivre hors de la zone.
- **Pourquoi centrer sur le bord** : `maxBounds` de MapLibre RN 11.5.0
  contraint **le centre** de la caméra, pas toute la vue (code lu le
  16 novembre 2026, dans `mobile/node_modules/@maplibre/maplibre-react-native/`) :
  - iOS (`ios/components/map-view/MLRNMapView.m`, lignes 742 à 746) :
    `mapView:shouldChangeFromCamera:toCamera:` **refuse** tout mouvement
    dont le centre sort de `maxBounds`
    (`MLNCoordinateInCoordinateBounds(newCamera.centerCoordinate, maxBounds)`) ;
  - Android (`android/.../components/camera/MLRNCamera.kt`, ligne 177) :
    `map.setLatLngBoundsForCameraTarget(maxBounds)`, qui borne la cible
    (le centre) de la caméra.

  Un cadrage « boîte autour des deux points » aurait son centre dehors :
  refusé sur iOS, rabattu sur Android, position coupée. Centré sur le
  bord, il passe partout, sans toucher à `maxBounds` : la carte reste
  bloquée sur la zone (décision du 26 octobre), la position tient dans
  une moitié de l'écran.

| Cas | Caméra (ouverture, ou toucher du bouton au repos) | Bouton | Message « hors de la zone » |
|---|---|---|---|
| `inside` | ouverture : centre = position, zoom 14 (`easeTo`, 300 ms) ; toucher : zoom 15 au moins (§ 9.4) | suit | non |
| `near` | ouverture : centre = bord le plus proche, zoom `nearZoom` ; toucher : le même cadrage si Émilien répond oui à la question (b), sinon comportement actuel | repos | oui |
| `far` | ouverture : toute la zone (inchangé) ; toucher : comportement actuel (point de la zone le plus proche, zoom 15 au moins) | repos | oui |
| pas encore de position | toute la zone | repos | non |
| position refusée | toute la zone | barré | non |

- La règle d'ouverture ne joue **qu'une fois**, au premier affichage de
  la carte de la zone (lancement, ou zone changée), à la première
  position, et seulement si la carte n'a pas été touchée (code actuel).
  Revenir sur l'onglet ne recadre pas.
- Le message « hors de la zone » s'affiche tant que la position est hors
  du rectangle (code actuel), cas `near` compris. Il doit faire au moins
  48 de haut, texte centré en hauteur (maquette 90).

**9.6 Rapidité d'ouverture (C13).** La vue d'ouverture ne change pas :
toute la zone, puis un mouvement à la première position, comme
aujourd'hui. Le nouveau coût est une source GeoJSON d'un point mise à
jour une fois par seconde. Mesure de l'essai (`ouverture-zoom.txt`, du
montage à `onDidFinishLoadingMap`, 3 ouvertures à froid) : iOS 154 à
158 ms au zoom 9 et 159 à 178 ms au zoom 14 ; Android 331 à 393 ms au
zoom 9 et 404 à 711 ms au zoom 14. Ouvrir directement au zoom 14 n'est
donc **pas** plus rapide sur Android : on garde l'ouverture sur toute la
zone. Le testeur mesure avant et après la phase, même méthode (C13).

### 10. Trait de liaison sur l'écran Infos et pendant le suivi (C11)

**10.1 Source** (choix 2 du pilotage) : le trait se redessine à partir de
ce qui est déjà gardé : les points posés (`draft.points`) et le tracé de
chaque tronçon (`legs[i].shape`). Rien de nouveau dans la base, pas de
montée de version.

**10.2 Règle**, une fonction pure (`core/routes/track.ts`, à côté de
`trackOfCreated`) :

```ts
export function routeLinks(draft: Draft, legs: SavedLeg[]): LonLat[][];
```

- Pour chaque tronçon `mode: 'path'` **sans** `trace` :
  `linkSegments(point posé de départ, point posé d'arrivée, shape)`. C'est
  le code de la création (ADR 0016, § 5) : un trait à chaque bout, seuil
  **5 m** (`MIN_LINK_METERS`).
- Tronçon « à la main » : aucun trait (il passe déjà par les points posés).
- Tronçon `trace` (circuit, GPX modifié, ADR 0020) : aucun trait. Un GPX
  importé n'a pas de tronçons : aucun trait (choix 3 du pilotage).
- Un point posé entre deux tronçons calculés donne deux traits (fin de
  l'un, début de l'autre), comme dans la création.

**10.3 Où il est dessiné.**
- **Écran Infos** : `CreatedInfos` le dessine déjà (§ contexte du
  complément). On ajoute le cas `PlainInfos` avec la carte de la zone
  (`leaves`) pour un itinéraire créé, par `routeLinks`. Un contrôle
  vérifie que `mainGeometry` et `routeLinks` donnent les mêmes traits sur
  un itinéraire de test ; sinon, on aligne `mainGeometry` (exclure les
  tronçons `trace`).
- **Suivi** : `TrackingSource` gagne `links: LonLat[][]`, rempli par
  `sourceOfCreated` (vide pour `sourceOfGpx`). `TrackingMap` le dessine
  dans une source `suivi-liaison`, **déclarée avant** les sources du
  tracé (donc dessous), avec le style de `draft-link-line`
  (`mapColors.routeLink`, `line-dasharray: [0.1, 2.5]`, bouts ronds). Pas
  de `beforeId` (piège iOS de `DraftLayers`). Le designer vérifie le
  rendu sur fond blanc en T6.

**10.4 Ce qui ne change pas** (question 1 de la phase 8) : la ligne du
suivi (`sourceOfCreated`), le placement, les directions, la distance
restante, la distance, la durée, le D+ et le GPX ignorent le trait. Il
vit dans une liste à part, jamais ajoutée à la ligne.

### 11. Les deux remarques du testeur de la 8a (C12)

**11.1 « Arrivée 10 m » en haut, « Reste 0 m » en bas.** Cause, lue dans
le code : les deux chiffres valent bien `longueur − progressM`, mais
`panelDistance` arrondit à 10 m et ne montre **jamais 0**
(`Math.max(10, …)`) ; `formatRemaining` montre 0. Sur le point
d'arrivée, le haut dit donc 10 m et le bas 0 m. Remède (choix 1 du
pilotage) :
- pour le panneau « arrivée » (`kind: 'arrive'`), la distance est
  `remainingM(line, placement)`, **la même fonction** que « Reste » (le
  long du tracé) ; cas `!next` compris, qui donne 0 aujourd'hui ;
- sous **30 m** (`ARRIVAL_M`, le seuil de l'arrivée), le panneau dit
  seulement « Arrivée », sans chiffre, jusqu'à l'écran « ARRIVÉE ! ». Une
  fonction pure `panelNumber(panel)` rend `null` dans ce cas, et
  `panelDistance(…)` sinon ; `GuidancePanel` l'utilise ;
- au-dessus de 30 m, les deux chiffres peuvent encore différer par leurs
  arrondis (50 m de 300 à 999 m en haut, 10 m en bas) : ce sont les
  formats de la maquette 30, inchangés.

**11.2 Les pointillés de l'écart se serrent pendant un recadrage.**
Cause probable (non prouvée) : l'espacement des points est calculé avec
le zoom **prévu** par `boundsZoom`, mais la caméra fait `fitBounds`, qui
calcule son propre zoom. Un écart de 4 points pour 10 (constat du
testeur) veut dire que le vrai zoom est plus bas d'environ 0,7. Piste :
sur iOS, MapLibre ajoute la marge restée du mouvement précédent (marge
du haut de 33 % en mode « suit ») à celle de `fitBounds`. Le défaut dure
tant que dure le cadrage, d'où « quelques secondes ».

Remède : **un seul calcul du zoom, le nôtre.** Pour un cadrage
(`overview` et `bounds`), la caméra fait `easeTo({ center, zoom,
bearing, padding, duration: 1000 })` au lieu de `fitBounds`, avec :
- `zoom` = `boundsZoom(…)` (déjà écrit, rotation comprise) ;
- `center` = le milieu des deux points en Mercator (projection de la
  carte ; pour deux points,
  le centre de leur boîte tournée est leur milieu) ; pour `overview` (cap
  0), le centre de la boîte ;
- la marge donnée **en entier** à chaque mouvement (haut, bas, gauche,
  droite), jamais héritée.

Le zoom des pointillés est alors celui où la caméra s'arrête. Pendant la
seconde du mouvement, les points bougent avec la carte, comme le tracé :
accepté.

**Ce que le développeur vérifie d'abord** (T4) : sur iOS, en écart, la
position arrêtée, journaliser le zoom prévu et `mapRef.getZoom()` une
fois la caméra immobile. S'ils diffèrent, le remède s'applique ; s'ils
sont égaux, la cause est ailleurs : il le signale au pilotage avant de
changer le code.

### 12. Structure du code et tests (ADR 0011, 0014)

| Dossier | Nouveau ou touché |
|---|---|
| `core/settings/settings.ts` | `Settings` gagne `brightness` ; `parseSettings` champ par champ |
| `core/tracking/` | `brightness.ts` (nouveau) : `BrightnessChoice`, `wantsMaxBrightness`. `trackingState.ts` : distance du panneau « arrivée » par `remainingM`, `panelNumber`. `trackingLine.ts` : `TrackingSource.links` |
| `core/routes/track.ts` | `routeLinks` (importe `linkSegments` de `core/routing/`) |
| `core/position/` (nouveau) | `userPuck.ts` : `nextHeading`, `MIN_HEADING_SPEED_MS`, `SLOW_HIDE_MS`, `metersPerPoint` (déplacé), `haloRadiusAtZoom0`, `puckFeature(coords, heading)` |
| `core/zones/opening.ts` (nouveau) | `NEAR_ZONE_M`, `NEAR_MAX_ZOOM`, `openingPlan`, `nearZoom`, le centre rentré du bord |
| `shared-data/settings/` | `settingsFile.ts` : `updateSettings(patch)`, écritures à la suite. `useSettings.ts` : `useSetBrightness`, `useSetWifiOnly` par fusion |
| `ui/` | `FloatingButton.tsx` : prop `active` (fond brun, pictogramme crème). Un sélecteur à deux segments partagé (`ui/Segmented.tsx`, deux variantes : crème pour Réglages, blanc pour le suivi) si celui de l'écran 10 se laisse sortir sans changer son rendu ; sinon chaque écran garde le sien |
| `features/settings/SettingsScreen.tsx` | rubrique « Pendant le suivi » (maquette v1/80) |
| `features/map/` | `UserPuckLayers.tsx` (nouveau, remplace `UserPositionLayers`, servi à la Carte et à la création). `MapPosition.tsx` : `RecenterButton` à trois états (deux pour la création), `useMapPosition` rend aussi cap (`nextHeading`) et précision. `ZoneMap.tsx` : `following`, ouverture et toucher par `openingPlan` et `nearZoom`, mesure du haut de « Nouvel itinéraire ». `ZoneBaseMap.tsx` : props `trackUserLocation`, `onTrackUserLocationChange` (`maxBounds` inchangé). `SavedRouteInfoScreen.tsx` : liaison dans `PlainInfos` |
| `features/map/tracking/` | `useTrackingBrightness.ts` (nouveau, seul fichier qui importe `expo-brightness`). `TrackingSettingsPanel.tsx` (nouveau, panneau 31b). `TrackingScreen.tsx` : roue dentée, panneau, « Reste » masqué, retour d'Android. `TrackingSession.tsx` : monte le hook. `TrackingMap.tsx` : source `suivi-liaison`, marge du bas, cadrage par `easeTo`. `trackingGeometry.ts` : centre du cadrage |
| `core/i18n/fr.ts` | textes de 31b, de v1/80, et les libellés lus du bouton (« La carte suit ma position », « Position désactivée », indice) |
| `mobile/assets/images/` | `fleche-cap.png`, @2x, @3x |
| `app.json` | `android.blockedPermissions` |
| `jest.setup.js` | imitation (mock) d'`expo-brightness` |

- **Imports** (ADR 0011, § 3) : `core/position/` et `core/zones/opening.ts`
  n'importent que `core/`. `features/map/` importe `core/`, `shared-data/`
  et `ui/`, comme aujourd'hui. `features/settings/` importe
  `shared-data/settings/`. Aucune fonctionnalité n'importe l'autre :
  ce qu'elles partagent est dans `shared-data/settings/` et `ui/`.
- **Dépendance nouvelle** : `expo-brightness` seulement.

**Tests Jest, logique pure (`core/`)** :

| Quoi | Attendu |
|---|---|
| `parseSettings` | fichier de la phase 2 → « Automatique » ; `brightness` faux → « Automatique » sans toucher `wifiOnly` ; les deux lus |
| `wantsMaxBrightness` | vrai seulement pour `max` et `tracking` |
| `nextHeading` | sans cap (`null`) → pas de flèche tout de suite ; cap 361 → pas de flèche ; vitesse 2 m/s → cap ; puis 0,3 m/s pendant 4 s → dernier cap gardé ; 0,3 m/s pendant 6 s → pas de flèche ; vitesse inconnue avec cap → cap |
| `haloRadiusAtZoom0` | valeur de référence de l'essai : 5 m à Nancy (48,69°) donnent 12,7 points au zoom 17 ; maquette : 40 m au zoom 15 donnent 25,4 points |
| `openingPlan` | dedans ; dehors à 3 km de chaque côté et à un coin (bord = coin) ; à 9,9 km et à 10,1 km (seuil, distance haversine de référence) |
| `nearZoom` | jamais plus de 14 ; position à 2,5 km à l'est (exemple de la maquette, environ 11,6) ; à 10 km (environ 9,6) ; position au-dessus et au-dessous du centre (marges 140 et du bas) ; le centre est dans le rectangle |
| `routeLinks` | point posé à 50 m du chemin → deux traits ; à 3 m → aucun ; tronçon à la main → aucun ; tronçon `trace` (circuit `nancyCircuits.json`) → aucun |
| Liaison sans effet | sur un itinéraire avec un point hors chemin : ligne du suivi, longueur, directions et GPX exporté **identiques** avec et sans `routeLinks` |
| `panelOf`, `panelNumber` | sur le point d'arrivée : distance du panneau = `remainingOf` ; sous 30 m, `panelNumber` = `null` ; à 40 m, « 40 m » |
| Cadrage du suivi | centre du cadrage = milieu des deux points ; zoom = `boundsZoom` |

**Testing Library (`features/`)** : rubrique de l'onglet Réglages (choix,
écriture par fusion) ; roue dentée, panneau, « Fermer », retour d'Android
qui ferme le panneau, fermeture seule au passage de `imminent` ;
luminosité : appels attendus à l'imitation d'`expo-brightness` au départ,
au choix changé, sur `background`, au retour et à la fin, par plateforme
(`Platform.OS` imité) ; onglet Carte : trois états du bouton,
`onTrackUserLocationChange(null)` qui remet au repos (deux fois de suite
aussi), toucher avant la première position (« suit » tout de suite, puis
règle du § 9.5 à la première position), feuille d'un circuit refermée
(« suit » repris), ouverture `inside`, `near`, `far`, sans position et
refusée ; écran de création : point avec flèche, bouton sans « suit ».

**Sur simulateur (T5)** : traces rejouées (méthode de l'essai) pour la
flèche, le halo, « suit ma position » puis repos au geste, le cadrage
`near` ; parcours Maestro C14 ; mesures C13 (banc de la 8a et ouverture de
l'onglet Carte, méthode de `ouverture-zoom.txt`).

### Questions pour Émilien (complément 8b)

**Tranchées le 16 novembre 2026 : (a) oui, (b) oui.** Le point de
l'écran de suivi prend la flèche et le halo en 8b (T3). Hors de la zone
à 10 km ou moins, « Recentrer » refait le cadrage commun.

Deux questions du designer (maquette 90, « Questions »), portées par le
pilotage. L'architecture permet les deux réponses ; voici ce que chacune
change.

**(a) Le point de l'écran de suivi prend-il aussi la flèche et le halo en
8b ?** Recommandation du designer : oui, mêmes couches, taille 40.
- **Oui** : `TrackingMap` dessine `UserPuckLayers` (rond de 40, flèche à
  `icon-size` 1) au lieu de son rond. Le cap de la flèche est celui du
  suivi (`cameraBearing`, § 3 : cap du tracé, ou du mouvement hors du
  tracé), pas la course du GPS ; le halo prend la précision de la
  dernière position gardée, qu'il faut garder dans l'état du suivi. Le
  point reste posé sur le tracé ; gris sans flèche si le GPS est perdu.
  Environ une demi-tâche de plus en T3.
- **Non** : le suivi garde son rond seul ; flèche et halo en phase 10.

**(b) Le bouton « Recentrer », hors de la zone à 10 km ou moins,
refait-il le cadrage commun ?** Recommandation du designer : oui.
- **Oui** : le toucher au repos dans le cas `near` fait le même
  mouvement que l'ouverture (bord le plus proche, `nearZoom`, § 9.5).
  Une branche de plus dans le toucher.
- **Non** : le toucher garde le comportement actuel (point de la zone le
  plus proche, zoom 15) et la position reste hors de l'écran (remarque R1
  de la phase 2) ; seule l'ouverture fait le cadrage commun.

### Accord avec les maquettes complétées (16 novembre 2026)

Relu : `design/v1/90-carte.html` (note « Pour l'architecte et le
développeur »), `design/30-suivi-velo.html` (« Roue dentée et panneau des
réglages »), `design/31b-suivi-reglages.html`, `design/tokens.md`.
- **Cadrage hors zone** : règle du designer retenue (centre sur le bord,
  `maxBounds` inchangé, § 9.5). Elle remplace mon `maxBounds` élargi : la
  maquette n'a rien à changer.
- **Cap** : règle du designer retenue (dernier cap gardé, flèche cachée
  après 5 s sous 0,5 m/s, § 9.3).
- **Zoom pendant « suit »** : garde « suit » ; à confirmer par T3-a,
  écart accepté par le designer si MapLibre en sort.
- **Toucher avant la première position** : « suit » tout de suite (§ 9.4).
- **Écran de création** : même composant de point, sans « suit » (§ 9.1).
- **Roue dentée et panneau 31b** : la règle de fermeture seule de la
  maquette 30 est celle du § 8.6 (fermé au passage au jaune ; ouvert
  pendant le jaune, il reste ouvert pour cette direction). Libellé lu
  « Réglages du suivi », avec `accessibilityState.expanded`.
- **Format « jamais 0 m » de la maquette 30** : il vaut pour les
  directions. Pour l'arrivée, sous 30 m, le panneau dit « Arrivée » sans
  chiffre (choix 1 du pilotage, § 11.1) : le designer met la ligne des
  formats à jour s'il le juge utile.

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

**Complément 8b — luminosité**
- **`setSystemBrightnessAsync` (réglage du téléphone, Android)** : il
  demande `WRITE_SETTINGS`, une permission spéciale, et il faudrait
  rendre le réglage même si l'app plante. La fenêtre seule suffit et
  Android la rend seul.
- **Plugin d'`expo-brightness` laissé tel quel** : il ajoute
  `WRITE_SETTINGS` sans besoin.
- **Rendre la luminosité sur `inactive` (iOS)** : `inactive` arrive aussi
  pour le centre de contrôle et un appel ; l'écran baisserait sans raison.
- **Garder la valeur iOS sur le disque, pour la rendre au lancement
  suivant après un plantage** : au lancement suivant, le téléphone a
  souvent été verrouillé et le système l'a déjà rendue ; réécrire une
  vieille valeur pourrait la fausser. Plus de code pour un cas rare.
- **Réglage dans un Store ou dans SQLite** : c'est une donnée gardée et
  courte ; `settings.json` et Query existent déjà pour ça.
- **Panneau 31b en `Modal`** : il bloquerait les touches et, sur iOS,
  poserait un voile ; la maquette le veut non bloquant.

**Complément 8b — onglet Carte**
- **`UserLocation` de MapLibre avec `accuracy` et `heading`** (la
  recommandation de l'essai si le design s'en contente) : halo deux fois
  trop grand, flèche et couleurs non réglables. La maquette 90 demande une
  flèche blanche dans le rond.
- **`NativeUserLocation mode="course"`** : sur iOS il se comporte comme
  « heading » (boussole), sans flèche ni halo sur le simulateur ; sur
  Android, flèche dans une direction non expliquée (essai).
- **Position d'`expo-location` pour le point** : seconde source, cap `0`
  ou `-1` quand il est inconnu ; MapLibre donne `null`.
- **Caméra maison (`easeTo` à chaque position)** : prouvée aussi
  (`*-own-manual-*`), mais un mouvement par seconde pour ce que la prop
  native fait seule. Gardée en repli si le contrôle T3-a échoue.
- **Cap du relèvement entre deux positions, en repli** : jamais déclenché
  dans l'essai, donc non prouvé ; MapLibre donne déjà la course.
- **Ouvrir la carte directement au zoom 14 sur la position** : la
  position n'est pas connue au montage, et le zoom 14 n'ouvre pas plus
  vite sur Android (essai).
- **`maxBounds` élargi et cadrage « boîte autour des deux points »** (la
  première version de ce complément) : il faut changer `maxBounds` selon
  la position, et un centre hors du rectangle est refusé sur iOS tant que
  `maxBounds` n'a pas changé (ordre des props à garantir). Centrer sur
  le bord (maquette 90) donne le même résultat sans toucher à
  `maxBounds`.
- **Caméra libre (`free`) dans le cas `near`** : la carte ne serait plus
  bloquée près de la zone (décision du 26 octobre).
- **Flèche cachée tout de suite sous 0,5 m/s** (première version) : elle
  clignoterait à chaque arrêt court ; la maquette garde le dernier cap
  5 s.
- **Contour réel de la zone pour le bord le plus proche** : le catalogue
  ne donne qu'un rectangle.

**Complément 8b — trait de liaison et remarques du testeur**
- **Garder les traits dans la base** : montée de version pour une donnée
  qui se recalcule en microsecondes (choix 2 du pilotage).
- **Ajouter le trait à la ligne du suivi** : il compterait dans la
  distance et le guidage (question 1 de la phase 8).
- **Panneau « arrivée » qui garde son chiffre jusqu'à 10 m** : il dirait
  encore « 10 m » sur le point d'arrivée. « Arrivée » sans chiffre sous
  30 m suit le seuil de l'arrivée (choix 1 du pilotage).
- **Pointillés en `line-dasharray`** (espacement fixe à l'écran) : ovales
  sur iOS (comparaison de la 8a, `design/comparaisons/p08a-suivi-velo.md`,
  C3) ; c'est pour ça que les ronds existent.
- **Lire le zoom réel dans `onRegionDidChange`** : les événements de nos
  propres mouvements arrivent en retard, pendant le mouvement suivant
  (contrôle B2 de la 8a).

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

**Complément 8b**
- Positif : une seule dépendance nouvelle (`expo-brightness`, d'Expo),
  sans permission sur aucune plateforme.
- Positif : un seul réglage, lu au même endroit par l'onglet Réglages, le
  panneau 31b et le suivi.
- Positif : le point bleu a un halo au vrai rayon et une flèche au dessin
  de la maquette ; une seule source de position (MapLibre).
- Positif : le trait de liaison vient du même code que la création, sans
  rien de nouveau dans la base.
- Négatif : **iOS, app fermée de force avec « Maximum »** : l'écran reste
  au maximum jusqu'au verrouillage du téléphone (écart accepté, § 8.3).
- Négatif : le point de l'onglet Carte est à nous : une image de flèche à
  tenir, et quatre couches au lieu d'un composant.
- Négatif : `useSetWifiOnly` change de forme (écriture par fusion) ; les
  tests qui l'imitent restent valables, ceux qui lisent le fichier
  voient un champ de plus.
- Négatif : la flèche peut clignoter sur l'émulateur Android (positions
  répétées sans cap) ; le confort réel se juge en phase 10.
- À l'acceptation : l'ADR 0013 (§ 6) reçoit « `settings.json` garde
  aussi `brightness`, écriture par fusion : ADR 0021, § 8 » ; l'ADR 0016
  (§ 5) reçoit « trait de liaison redessiné aussi sur Infos et pendant le
  suivi, par `routeLinks` : ADR 0021, § 10 ».

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

**Complément 8b.** Prouvé par l'essai T1 de la 8b : luminosité par
fenêtre sur Android et son rendu seul ; `blockedPermissions` ; cap tiré de
la course sur les deux simulateurs ; couches maison (avec la caméra
maison) ; `trackUserLocation="default"` avec `UserLocation`, sortie au
geste et retour par le bouton. Restent trois contrôles courts, au début de
la tâche qui en a besoin, sur les deux simulateurs, en release :

- **T3-a. Couches maison avec `trackUserLocation="default"`.** L'essai a
  prouvé chacun, pas les deux ensemble. Attendu : un seul point à
  l'écran (pas de point natif de MapLibre en plus), la caméra suit, sort
  au glissement avec `null`, revient au bouton. **Zoom** : un double
  toucher et un pincement à deux doigts pendant « suit » ; noter si
  MapLibre envoie `null` (sortie du suivi) ou garde le suivi. Les deux
  sont acceptés (§ 9.4) ; le résultat est écrit dans le LISEZMOI de la
  tâche. Et `useCurrentPosition` donne `heading: null` sans cap
  (journal, position fixe puis trace). Si le point ou le suivi échoue :
  caméra maison (`easeTo` à chaque position, sortie par `userInteraction`
  de `onRegionWillChange`), prouvée avec les couches maison.
- **T3-b. Cadrage `near` centré sur le bord, `maxBounds` inchangé** :
  position à 2,5 km à l'est de la zone (exemple de la maquette 90), puis
  à 9,5 km au sud et près d'un coin. Attendu sur les deux plateformes : la
  caméra va bien au centre demandé (lu par `onRegionDidChange`, pas
  refusé sur iOS ni rabattu sur Android), au zoom de `nearZoom`, et la
  position est à l'écran avec ses marges (capture). Si iOS refuse le
  centre sur le bord : le rentrer davantage (0,0001°) et le signaler.
- **T4-a. Pointillés** : zoom prévu et zoom réel journalisés (§ 11.2),
  avant de changer le code.
- **Luminosité réelle** (iOS surtout), confort de la flèche, précision du
  halo, et ce qui reste après une fermeture de force sur iOS : sur un vrai
  téléphone, phase 10 (liste de PILOTAGE.md).

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
- 2026-11-14, T6, décision du pilotage (défaut vu par le testeur) : une
  position dont l'heure de prise (`location.timestamp`, ms depuis
  l'époque) est antérieure à l'heure du départ du suivi est ignorée
  (ni avancement, ni distance, ni D+). Une position à l'heure exacte du
  départ est gardée.
- 2026-11-14, T6, décision du pilotage (défaut vu par le testeur) : une
  position ancienne mais à l'heure récente passe le filtre ci-dessus. La
  première position est gardée tout de suite (une position ancienne seule
  reste donc affichée environ 1 s : accepté). Si la suivante est à 25 m/s
  ou plus d'elle (distance divisée par l'écart des heures de prise,
  `takenAt` sinon `at` ; écart nul ou négatif : plausible seulement à 5 m
  ou moins), on jette la première : le suivi repart de l'état initial
  (même départ, même ligne, mêmes consignes ; placement, distance et
  positions gardées remis à zéro) et la nouvelle position devient la
  première, vérifiée à son tour. Dès que deux positions cohérentes sont
  gardées, la règle ne joue plus, pause comprise.
- 2026-11-16, T6, décision du pilotage (défaut vu par le testeur, capture
  `ios-p5-defaut-arrivee-immediate-0m.png`) : l'arrivée exige aussi au
  moins 100 m réellement roulés (`MIN_RIDE_M`, distance réelle de la
  sortie), en plus des 30 m de la fin et des 90 % du tracé parcourus.
  Démarrer sur le point d'arrivée ne termine plus le suivi.

## Écarts acceptés pendant la phase 8b

- 2026-11-16, T2, décision de la session de phase (relecture) :
  `updateSettings` est dans `shared-data/settings/updateSettings.ts`, pas
  dans `settingsFile.ts` (§ 12). Deux tests existants imitent tout
  `settingsFile` sans cette fonction. Le comportement ne change pas.
- 2026-11-16, T2, décision de la session de phase (relecture) : le
  réglage de luminosité est lu par `TrackingScreen` (`useSettings()`) et
  passé à `TrackingSession` par une prop. La session reste testable sans
  fournisseur de requêtes ; c'est toujours une seule lecture du réglage.
- 2026-11-16, T2 : le sélecteur à deux choix (`ui/Segmented.tsx`) est
  nouveau et sert à 31b et à v1/80 ; l'écran 10 garde le sien.

- 2026-11-16, T2, décision de la session de phase (testeur et
  designer) : le passage de « Recherche du GPS » à la première position
  ne compte pas comme un passage au jaune. Un panneau 31b ouvert pendant
  la recherche reste ouvert, même si la première position est déjà à
  100 m ou moins d'une direction. Seul un passage de « non jaune », avec
  une position, à « jaune » le ferme.
- 2026-11-16, T2 (designer) : panneau 31b ouvert, la caméra calcule sa
  marge du haut sur la partie de carte visible au-dessus du panneau, pour
  garder le point au-dessus du panneau, même sur un petit écran.

- 2026-11-16, T3, décision de la session de phase (relecture) : une
  permission accordée par la première demande se comporte comme une
  permission déjà accordée au lancement. Pas de « suit » avant la
  première position ; la règle d'ouverture (§ 9.5) s'applique à la
  première position. Seuls un toucher du bouton et le retour des
  réglages du téléphone après un refus mettent « suit » tout de suite.
  Cela précise le § 9.4 et garde le cas « plus loin » de la spec.
- 2026-11-16, T3, décision de la session de phase : sur l'écran de
  création, le point de position reste sous les marqueurs (comme avant
  la 8b), et non au-dessus de toutes les couches (§ 9.1).
- 2026-11-16, T3 : un toucher du bouton avant la première position,
  puis une première position loin de la zone : point de la zone le plus
  proche, zoom 15 (§ 9.4, règle du toucher). Le toucher dit qu'on veut
  voir sa position.

- 2026-11-17, T4, décision de la session de phase (relecture) :
  `TrackingSource.links` est facultatif (`links?:`), pas `links: LonLat[][]`
  (§ 10.3). Le rendre obligatoire forçait à modifier des tests déjà
  commités. `sourceOfCreated` et `sourceOfGpx` le remplissent toujours ;
  `TrackingMap` lit `source.links ?? []`.
- 2026-11-17, T4, décision du pilotage : le remède du § 11.2 (`easeTo` au
  lieu de `fitBounds`) n'est pas appliqué. Le contrôle T4-a trouve, caméra
  arrêtée, le zoom réel égal au zoom prévu (42 cadrages). Reste un léger
  tassement des pointillés pendant la seconde du recadrage sur iOS,
  accepté (`docs/phases/preuves/p08b/t4/LISEZMOI.md`).

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

## Sources du complément 8b (relevées le 16 novembre 2026)

- Essai T1 de la 8b :
  [LISEZMOI](../phases/preuves/p08b/t1-essai/LISEZMOI.md) et, dans le
  même dossier : `android-luminosite-dumpsys.txt`,
  `android-luminosite-logcat.txt`, `ios-log-luminosite.txt`,
  `ios-log-luminosite-arriere-plan.txt`,
  `android-permissions-sans-plugin.txt`,
  `android-manifest-blockedPermissions.txt`,
  `android-permissions-avec-blockedPermissions.txt`,
  `ios-log-js-native.txt`, `android-log-js-native.txt`,
  `ios-log-own-manual.txt`, `android-log-own-manual.txt`,
  `ouverture-zoom.txt`, les captures `ios-*` et `android-*`, l'écran de
  test `essai-EssaiScreen.tsx.txt`.
- `expo-brightness` pour le SDK 58 (`setBrightnessAsync` : « sur iOS,
  jusqu'au verrouillage » ; « sur Android, l'activité seule » ;
  `restoreSystemBrightnessAsync` Android seulement) :
  https://docs.expo.dev/versions/v58.0.0/sdk/brightness/ (extrait gardé :
  `doc-expo-brightness-extrait.txt`). Registre npm (étiquette `latest` =
  58.0.3, publiée vers le 11 novembre 2026 d'après le registre) :
  https://registry.npmjs.org/expo-brightness
- Apple, `UIScreen.brightness` (réglage de tout le téléphone, rendu au
  verrouillage) : https://developer.apple.com/documentation/uikit/uiscreen/brightness
  (extrait gardé : `doc-apple-uiscreen-brightness-extrait.txt`).
- Expo, permissions bloquées (`android.blockedPermissions`) :
  https://docs.expo.dev/guides/permissions/
- MapLibre React Native 11.5.0 (installé), code lu dans
  `mobile/node_modules/@maplibre/maplibre-react-native/` :
  `ios/modules/location/MLRNLocation.m` (cap = `course`, `null` si
  négatif), `android/src/main/java/org/maplibre/reactnative/modules/MLRNLocationModule.kt`
  (cap = `bearing` si `hasBearing()`), `ios/components/camera/MLRNCamera.m`
  (`trackUserLocation`, `maxBounds`), `ios/components/map-view/MLRNMapView.m`
  lignes 742 à 746 (`maxBounds` refuse un centre dehors),
  `android/src/main/java/org/maplibre/reactnative/components/camera/MLRNCamera.kt`
  ligne 177 (`setLatLngBoundsForCameraTarget`),
  `lib/typescript/module/hooks/useCurrentPosition.d.ts`.
  Doc du composant `Camera` :
  https://maplibre.org/maplibre-react-native/docs/components/camera
- Code lu (commit `d351964`) : `core/settings/settings.ts`,
  `shared-data/settings/settingsFile.ts`, `useSettings.ts`,
  `features/settings/SettingsScreen.tsx`, `features/map/MapScreen.tsx`,
  `ZoneMap.tsx`, `ZoneBaseMap.tsx`, `MapPosition.tsx`, `draftGeometry.ts`,
  `DraftLayers.tsx`, `SavedRouteInfoScreen.tsx`, `infoGeometry.ts`,
  `features/map/tracking/TrackingMap.tsx`, `trackingGeometry.ts`,
  `TrackingSession.tsx`, `core/tracking/trackingState.ts`, `remaining.ts`,
  `placement.ts`, `trackingLine.ts`, `core/routing/routeLink.ts`,
  `core/routes/track.ts`, `savedRoute.ts`, `reopen.ts`,
  `core/zones/activeZone.ts`, `catalogue.ts`, `ui/FloatingButton.tsx`,
  `app.json`.
- Remarques du testeur de la 8a : `docs/phases/preuves/p08a/t8-final/LISEZMOI.md`
  (Réserves) ; `docs/phases/p08a-suivi-velo-resultats.md`.
- Maquettes, dans leur version complétée du 16 novembre 2026 :
  `design/30-suivi-velo.html` (« Roue dentée et panneau des réglages »),
  `design/31b-suivi-reglages.html`, `design/v1/80-reglages.html`,
  `design/v1/90-carte.html` (« Pour l'architecte et le développeur »,
  « Questions »), `design/tokens.md` (`marqueur.position`,
  `marqueur.position-halo`, `suivi.bouton-reglages`).
