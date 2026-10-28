# ADR 0017 — Infos de l'itinéraire : altitudes, terrain, calcul par tronçon, écran Infos

- Statut : Accepté le 2026-10-28
- Date : 2026-10-28 (phase 5, tâche T1 de [p05-infos-itineraire](../phases/p05-infos-itineraire.md))
- Précise l'[ADR 0005](0005-infos-itineraire.md) (le profil vient de
  `height`, plus de `elevation_interval`), l'[ADR 0015](0015-module-natif-calcul.md)
  (deux fonctions de plus) et l'[ADR 0016](0016-itineraire-en-creation.md)
  (cache par tronçon, plein écran). Suit les ADR 0011 et 0014 sans les
  changer.

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

- La spec validée fait foi : critères C1 à C15. La difficulté VTT est en
  phase 5b.
- **Essai jetable T1** ([LISEZMOI](../phases/preuves/p05/t1-essai/LISEZMOI.md)),
  version finale (release), zone Nancy v3, Android en mode avion :
  - `height` et `traceAttributes` de valhalla-mobile 0.6.4 marchent hors
    ligne, avec des réponses identiques sur iOS, Android et le Mac
    (Valhalla 3.9.1) ;
  - `height` avec `resample_distance: 30`, `range: true`, précision 0 :
    même montée (D+) sur les trois plateformes, pour les 7 trajets. En
    précision 1, écart de 0,2 à 0,4 m ;
  - `height` ne refuse pas un point hors zone : `null` hors des tuiles HGT
    (grilles d'altitudes de 1° × 1°), vraie altitude dans une tuile ;
  - `trace_attributes` en `walk_or_snap` marche partout ; `edge_walk`
    échoue (443) sur R1 à R5 ; une ligne droite à la main échoue (444) ;
  - la somme des longueurs d'arêtes couvre 99,98 à 100 % du trajet, mais
    **99,04 % sur R4** (sauts d'indice non expliqués) ;
  - coût natif sur 42 km : `height` < 1 ms, `traceAttributes` 25 à 44 ms ;
  - changer la clé d'un point pendant un glisser plante iOS (SIGABRT,
    arrêt brutal) et coupe le geste sur Android.
- Essai 1 : méthode du dénivelé (une altitude tous les 30 m, seuil de 5 m)
  et règle du terrain (« Essai 1-bis » de [docs/essais/01](../essais/01-calcul-hors-ligne.md),
  fonction `classify` de `mesurer-1bis.py`).

## Décision

### 1. Deux fonctions de plus dans le module natif

`mobile/modules/valhalla-route/index.ts` gagne, sur le modèle de `route` :

```ts
height(requestJson: string): Promise<string>
traceAttributes(requestJson: string): Promise<string>
```

- **Versions brutes** : iOS `height(rawRequest:)`, `traceAttributes(rawRequest:)` ;
  Android `heightRaw(requestJson)`, `traceAttributesRaw(requestJson)`. La
  version typée de `height` ne sait pas rendre `null`.
- Mêmes erreurs que `route` (ADR 0015, § 5) : un refus de Valhalla revient
  en JSON (format texte de données) `{code, message}` ; la promesse n'est
  rejetée qu'avec `ERR_ENGINE_NOT_OPEN` ou `ERR_ENGINE`.
- **Requête `height`** : `{"encoded_polyline": <forme>, "resample_distance": 30, "range": true}`,
  précision par défaut (0, mètres entiers). On lit `range_height` : des
  paires `[distance en m, altitude ou null]`.
- **Requête `trace_attributes`** : la forme, le `costing` et les
  `costing_options` de `buildRouteRequest` (une seule constante),
  `"shape_match": "walk_or_snap"`, et
  `"filters": {"attributes": ["edge.use", "edge.density", "edge.length"], "action": "include"}` :
  les seuls champs dont le § 3 a besoin. On lit `edges`.
- La forme part en polyligne encodée à 6 décimales : `encodePolyline6`, à
  côté de `decodePolyline6`, testée par aller-retour.
- **Codes connus**, tous traduits en `failed` par `kindFromValhallaCode`
  (déjà le cas d'un code inconnu) : 312 (`height`, forme vide ou absente),
  114 (`trace`, forme vide), 123 (un seul point), 444 (hors tuiles, ou
  ligne droite), 443 (`edge_walk`, non utilisé), −1 ou 100 pour une requête
  illisible, selon la requête et la plateforme (relevés de T1 et T2 ; −1
  aussi pour un code illisible sur Android). Aucune sorte d'erreur nouvelle : pour les infos,
  seul compte « présent ou manquant » (§ 8).

### 2. Où vit chaque morceau

| Dossier | Contenu |
|---|---|
| `core/routing/` | `routingEngine` gagne `height(shape, signal?)` et `traceAttributes(shape, signal?)`, **dans la même file** que `route`, avec le même saut d'une demande abandonnée. `infoRequest.ts` : `buildHeightRequest`, `buildTraceRequest`. `infoResponse.ts` : `parseHeightResponse` → `HeightResult` (succès avec `ProfilePoint[]` = `[distanceM, heightM \| null]`, ou `RouteFailure`), `parseTraceResponse` → `TraceResult` (succès avec `TerrainEdge[]` = `{ use, density, lengthKm }`, ou `RouteFailure`). Ne lèvent jamais d'erreur. Dans `NativeRouting`, `height` et `traceAttributes` sont facultatifs, pour les faux modules des tests déjà écrits ; absents, ils donnent `failed` (T2) |
| `core/route-info/` (nouveau) | `elevation.ts` : `ascentDescent`, `RESAMPLE_M = 30`, `ELEVATION_THRESHOLD_M = 5`. `profile.ts` : `joinProfiles`, altitudes basse et haute (§ 4). `terrain.ts` : `classifyEdge`, `terrainSegments`, `terrainShares`, `roundShares` (§ 3). `legShape.ts` : `infoShape(leg, route, bbox)` (§ 5). `routeInfo.ts` : `summarizeInfo(legs)`, avec les données manquantes (§ 8) |
| `shared-data/routing/` | `computeHeights(shape, signal?)` et `computeTerrain(shape, signal?)`, aussi minces que `computeRoute` |
| `features/map/` | Hook (fonction React réutilisable) `useLegInfos`, à côté de `useLegResults` (§ 6). `DraftSession.tsx` (§ 7). `RouteInfoScreen.tsx`, son profil `ElevationProfile.tsx` (react-native-svg, déjà installé), sa carte en arche. Le D+ dans `RouteSummarySheet` |
| `app/draft/` | `_layout.tsx`, `index.tsx`, `infos.tsx`, fichiers minces (§ 7) |

- Le moteur ne contrôle pas le rectangle de la zone pour ces deux
  fonctions : la forme d'un tronçon calculé vient de lui. `infoShape`
  contrôle les tronçons à la main (§ 5).
- **Les hooks restent dans `features/map/`** : un seul écran s'en sert, la
  règle de l'ADR 0014 les y garde. Ils iront dans `shared-data/` quand une
  seconde fonctionnalité en aura besoin (phase 6 probable).

### 3. Classement du terrain

Règle de l'essai 1-bis (`classify`), arête par arête :

| Part | Condition |
|---|---|
| Piste | `use` = `track` |
| Sentier | `use` parmi `path`, `footway`, `mountain_bike`, `cycleway`, `pedestrian`, `bridleway`, `steps`, `sidewalk`, **et** `density` < 6 (`density` absente : 0) |
| Route | tout le reste (`road`, `service_road`, `living_street`, `driveway`, usage inconnu…), et les usages « sentier » en ville (`density` ≥ 6) |

- **« À la main »**, 4e part : la longueur à vol d'oiseau des tronçons à
  la main (`handLeg`, déjà utilisé par le résumé).
- `road_class` et `surface` ne servent pas. L'essai 1-bis l'a montré : une
  route forestière et une rue ont les mêmes classes ; `surface` ne servait
  qu'aux « laies », non affichées.
- Les zones sont fabriquées avec le Lua (script de fabrication des tuiles)
  standard de Valhalla (`zonefactory/build.py`) : `use` suffit à reconnaître
  une piste. La liste de `way_id` de l'essai ne servait qu'aux tuiles
  modifiées.
- Le seuil 6 est calé sur les données de Nancy : la doc ne définit pas
  l'échelle de `density`. Une seule constante, `DENSITY_TOWN`.
- **Base des parts** : somme des `edge.length` des tronçons calculés, plus
  la longueur des tronçons à la main. Pas la distance du moteur : sur R4,
  les parts feraient 99 %.
- **Arrondi** à l'unité, méthode du plus fort reste : chaque part prend sa
  partie entière, puis les points qui manquent pour 100 vont aux plus
  grands restes. À égalité : route, piste, sentier, à la main.
- « Route », « Piste », « Sentier » s'affichent toujours, même à 0 %.
  « À la main » seulement s'il y a un tronçon à la main.
- **Bande de terrain sous le profil** : `terrainSegments` fusionne les
  arêtes voisines de même part, mises à l'échelle de la longueur du tronçon
  dans le profil. Un tronçon à la main fait un segment « À la main ».

### 4. Dénivelé sur l'itinéraire entier

- Chaque tronçon a son profil (`range_height`). `joinProfiles` les met bout
  à bout, dans l'ordre. Les distances d'un tronçon sont décalées de la
  longueur des profils d'avant. Tous les points sont gardés : une altitude
  répétée à une jonction ne change pas le calcul.
- **D+ et D−** (montée et descente) se calculent sur ce profil joint,
  jamais tronçon par tronçon. Méthode de l'essai 1, identique à
  `comparer.py` de T1 :
  - référence = première altitude ; pour chaque altitude `h` suivante : si
    `h − réf ≥ 5`, D+ += `h − réf` et réf = `h` ; si `réf − h ≥ 5`, réf = `h` ;
  - D− : même calcul sur les altitudes changées de signe.
- **Pourquoi joint** : le seuil a une mémoire. 3 m de montée en fin de
  tronçon et 3 m au début du suivant font 6 m : comptés si joints, perdus
  si l'on additionne. Sinon, poser un point au milieu d'une montée
  changerait le D+ sans changer le tracé.
- Coût : environ 1 400 altitudes pour 40 km, bien moins de 1 ms.
- La liaison en pointillés n'est pas dans le profil (ADR 0016). L'axe du
  profil peut différer de quelques mètres de la distance du moteur.
- **Un `null`, ou un tronçon sans profil**, rend les altitudes manquantes
  pour tout l'itinéraire (§ 8). Pas de D+ partiel.

### 5. Tronçons à la main

- **Altitudes** : `height` sur la ligne droite `[départ, arrivée]`, même
  requête. Un seul chemin de code pour tous les tronçons (C4).
- **Contrôle du rectangle de la zone avant l'appel** (`infoShape`) : si un
  bout est hors du rectangle (point « relié à la main » hors zone), pas
  d'appel, altitudes manquantes. Raison : `height` répond hors zone dès
  qu'une tuile HGT couvre le point ; le résultat dépendrait du découpage du
  paquet. Règle simple : hors de la zone, pas d'infos. Une ligne droite
  entre deux points du rectangle y reste.
- **Pas de `traceAttributes`** (erreur 444 sur une ligne droite) : le
  tronçon compte dans « À la main ».

### 6. Quand on calcule, et le cache

- **Une requête TanStack Query par tronçon et par sorte d'info**, dans
  `useLegInfos` :
  - altitudes : `['routing', 'height', zone.id, zone.version, mode, from.lon, from.lat, to.lon, to.lat]` ;
  - terrain, tronçons calculés seulement : même clé avec `'terrain'` et
    `'path'`.
- Comme pour la route, la clé ne dépend que de la zone, du mode et des deux
  points : la forme calculée en découle. Un tronçon calculé : requêtes
  activées (`enabled`) quand sa route est connue. Un tronçon à la main :
  tout de suite.
- Réglages de l'ADR 0016, § 3 : `staleTime: Infinity`, `gcTime: 30 min`,
  `retry: false`, `networkMode: 'always'`, `refetchOnReconnect: false`. Un
  succès est la donnée, déjà lue (`ProfilePoint[]`, segments) ; un échec
  est levé, jamais gardé.
- **Deux requêtes plutôt qu'une** : si le terrain échoue, les altitudes
  restent (C10), et aucun échec n'entre dans le cache.
- **Jamais pendant un glisser** : les calculs de l'aperçu passent à côté du
  cache (ADR 0016, § 4) et n'ont pas d'infos. `useLegInfos` lit le tracé
  du TanStack Store (magasin d'état), qui ne change qu'au relâchement. Le
  résumé garde son D+ précédent, grisé, comme la distance.
- Après une action : ajouter calcule 1 tronçon (route, altitudes, terrain),
  déplacer 2, supprimer 1. Ces appels suivent les routes dans la file du
  moteur : un seul calcul natif à la fois (ADR 0015).
- **Annuler** retrouve les clés en cache : 0 appel. **Pas d'invalidation** :
  une clé ne change jamais de sens ; une nouvelle version de zone donne de
  nouvelles clés.
- **Le résumé change en une fois**, quand distance et altitudes de tous les
  tronçons sont connues ou en échec.

### 7. L'écran Infos dans Expo Router

- **Structure** (`app/draft.tsx` devient un dossier) :

  ```
  src/app/draft/_layout.tsx   <DraftSession><Stack screenOptions={{ headerShown: false }} /></DraftSession>
  src/app/draft/index.tsx     création (DraftScreen)        → /draft
  src/app/draft/infos.tsx     écran Infos (RouteInfoScreen) → /draft/infos
  ```

  `app/_layout.tsx` ne change pas : `draft` reste en `fullScreenModal`.
- **`DraftSession`** (`features/map/`) est un fournisseur de contexte
  (provider). Il choisit la zone active et crée le Store du tracé, avec la
  clé de zone qu'avait `DraftView`. Les deux écrans le lisent par
  `useDraftSession()`. Le Store vit tant que le plein écran est ouvert, pas
  plus (ADR 0016).
- La pile imbriquée (nested stack) empile Infos dans le plein écran, forme
  documentée par Expo Router pour un écran modal.
- **Ouverture** : toucher le résumé fait `router.push('/draft/infos')`. Le
  résumé n'est touchable qu'avec 2 points, des chiffres connus, et sans
  feuille d'erreur.
- **« Modifier »** fait `router.back()`. La création est restée montée sous
  Infos : l'itinéraire est intact par construction. Le retour d'Android et
  le glissement depuis le bord (iOS) font de même.
- `usePreventRemove` reste sur la création. D'après la doc de React
  Navigation, il marche dans une pile imbriquée : contrôle ci-dessous.
- **Contenu** (maquette 20) : en-tête « Nouvel itinéraire » (le nom arrive
  en phase 6) ; distance, durée, D+, D− ; profil avec altitudes basse et
  haute, bande de terrain ; légende des parts ; carte en arche. **Pas** de
  ligne « Difficulté » (phase 5b), **pas** de « Démarrer le suivi »
  (phase 8) : seul « Modifier » reste.
- **Carte en arche** : `ZoneBaseMap`, sans geste, cadrée sur tout le tracé,
  avec départ, arrivée, attribution courte et bouton « i ».
- Infos ne lance aucun calcul neuf : mêmes clés, tout vient du cache (C9).

### 8. Données manquantes (C10)

`summarizeInfo` rend chaque bloc présent, en attente ou manquant, l'un
sans l'autre :

| Bloc | Manquant si | L'écran montre |
|---|---|---|
| Altitudes (D+, D−, profil) | un tronçon sans profil (échec, hors zone) ou un `null` | « Altitudes indisponibles » à la place de D+, D− et du profil ; « — » pour le D+ du résumé |
| Terrain (parts, bande) | un tronçon calculé sans terrain, ou base nulle | « Terrain indisponible » à la place de la légende et de la bande |
| En attente | une requête pas finie | « … » à la place des chiffres |

Distance, durée et carte s'affichent toujours. Les fonctions de `core/` ne
lèvent jamais d'erreur ; les textes sont dans `fr.ts`.

### 9. Comparaison au Mac (C3, C5)

- **Itinéraires** : R1 à R5, avec les points de passage des requêtes de
  l'essai T1, posés en tronçons calculés (un par paire de points, comme
  l'app).
- **Banc** (programme de mesure) jetable, comme en T1, sur les deux
  simulateurs. Il fait tourner le vrai code de `core/` et `shared-data/`.
  Il écrit les réponses brutes de chaque tronçon, puis le D+, le D− et les
  parts calculés en TypeScript.
- **Script du Mac** (`python3 -I`, rejouable, rangé avec les preuves de
  T7), deux contrôles :
  1. **Même méthode** : il refait en Python, sur les réponses de l'app,
     jonction, seuil, classement et arrondi de cet ADR. Écart permis : 1 m
     et 1 point (attendu : 0) ;
  2. **Même moteur** : il rejoue les mêmes requêtes (mêmes formes de
     tronçons) sur Valhalla 3.9.1 en Docker, puis refait le calcul. Écart
     permis : 1 m et 1 point.
- Pas de référence tirée de l'essai 1 : son rééchantillonnage diffère.
- Une capture de l'écran Infos d'une référence montre le même D+ que le
  banc : la chaîne jusqu'à l'écran est prouvée.
- Jest : profils simples à D+ connu (C2), plus des réponses réelles gardées
  en T2 (A-B, une ligne à la main, un tronçon de R4). La valeur attendue
  d'un cas réel vient du script du Mac (référence externe, ADR 0011, § 5).

### 10. Point choisi agrandi (C14, écart A1 de la phase 4)

- **Tout point choisi** prend l'aspect `marqueur.point-deplace` (rond de 40,
  chiffre de 18, halo) et le garde pendant le glisser. C'est la voie qui
  marche sur les deux plateformes dans l'essai.
- **Règle : ne jamais changer la clé d'un point pendant un glisser.** Elle
  change au toucher et après le relâchement, comme déjà (`annotationKey`).
- Un point non choisi saisi directement reste à 28 sur Android pendant le
  geste. Accepté : le relâchement le choisit, donc l'agrandit.
- A2 et A3 : la note « À la main : 0,6 km » lit la longueur à la main,
  ajoutée à `summarize`.

## Alternatives rejetées

- **`elevation_interval` dans `route`** (prévu par l'ADR 0005) : un tronçon
  à la main n'a pas de route, il faudrait `height` en plus (deux chemins de
  code). Pas de distances. Une décimale : D+ variable entre plateformes. Et
  la requête de route, donc son cache, changerait.
- **`height` en précision 1** : 0,2 à 0,4 m d'écart entre plateformes.
- **Somme des D+ par tronçon** : dépend de l'endroit des points (§ 4).
- **Altitudes et terrain dans une seule requête** : un échec du terrain
  cacherait les altitudes, ou serait gardé en cache.
- **`trace_attributes` sur l'itinéraire entier** : tout refaire à chaque
  action. **`edge_walk`** : erreur 443 sur R1 à R5.
- **Parts rapportées à la distance du moteur** : 99 % sur R4.
- **Infos par-dessus la création, sans route** : hors d'Expo Router.
- **Route sœur `app/draft-infos.tsx`** : le Store de la création n'y est
  pas accessible sans variable globale, et un écran poussé au-dessus d'un
  `fullScreenModal` dans la même pile native n'est pas prouvé.
- **Store global au niveau du module** : survit à l'écran (contraire à
  l'ADR 0016). **Tracé passé en paramètre d'adresse** : deux copies.
- **Clé changée au début du glisser** : plantage iOS. **Marqueur fantôme**
  posé au début du glisser : non essayé, gardé en réserve.
- **D+ partiel quand une altitude manque** : chiffre trompeur (question 1).
- **Hooks dans `shared-data/` dès maintenant** : un seul utilisateur
  (ADR 0014).

## Conséquences

- Positif : la logique des infos est pure, dans `core/`, et se compare au
  Mac ligne à ligne. Aucune dépendance nouvelle. Annuler et l'écran Infos
  ne coûtent aucun calcul.
- Négatif : le module passe de 3 à 5 fonctions ; l'imitation (mock) de
  `jest.setup.js` en gagne deux. Le Store passe de `DraftView` à
  `DraftSession` : les tests d'écran de la création l'enveloppent.
- Négatif : `features/map/` grossit encore. À découper en phase 6, quand
  « Mes itinéraires » ouvrira aussi les infos.
- Négatif : après une action, la file du moteur porte 3 appels par tronçon
  au lieu d'1. Coût natif faible (< 50 ms pour 42 km d'un coup) ; C9 le
  mesure.
- À l'acceptation : l'ADR 0005 reçoit « profil par `height`, dénivelé sur
  le profil joint : ADR 0017 » ; l'ADR 0015 (§ 1) reçoit « `height` et
  `traceAttributes` ajoutés : ADR 0017 ».

## Contrôles avant de bâtir dessus

- **Début de T5, sur les deux simulateurs** (contrôle court, jetable) : la
  pile imbriquée. Infos s'empile sans nouveau plein écran ; la croix et le
  retour d'Android ouvrent encore « Abandonner cet itinéraire ? » ; revenir
  d'Infos ne l'ouvre pas. Parade si `usePreventRemove` ne voit pas la
  sortie : le déclarer dans `DraftSession`.
- **T3** : Python et TypeScript donnent le même D+ sur les réponses réelles
  de T2.
- **T7** : mesure C9 du glisser avec les appels d'infos dans la file, même
  méthode qu'en phase 4.
- Non prouvé : la cause des sauts d'arêtes de R4 ; un vrai téléphone.

## Réponses d'Émilien (28 octobre 2026)

1. **Altitudes manquantes** : tout ou rien. L'écran dit « Altitudes
   indisponibles » et montre le reste.
2. **Couleur de la part « À la main »** : le magenta des tirets en
   attendant. Le designer la confirme ou en propose une autre en T8, sur
   les captures.

## Sources (relevées le 28 octobre 2026)

- Essai T1 : [LISEZMOI](../phases/preuves/p05/t1-essai/LISEZMOI.md),
  [comparaison.txt](../phases/preuves/p05/t1-essai/comparaison.txt),
  `code/trialP05.ts.txt` (branche `claude/p05-essai-infos`, 9d68b81).
- Essais 1 et 1-bis : [docs/essais/01](../essais/01-calcul-hors-ligne.md) ;
  hors dépôt, `essais/01-calcul-hors-ligne/analyse/mesurer-1bis.py`
  (`classify`, `DENSITY_TOWN`) et `zone/references/preparer-references.py`
  (`ascent`).
- Valhalla, `height` : https://valhalla.github.io/valhalla/api/elevation/api-reference/
- Valhalla, `trace_attributes` : https://valhalla.github.io/valhalla/api/map-matching/api-reference/
- valhalla-mobile 0.6.4 (`Valhalla.swift`, `Valhalla.kt`) :
  https://github.com/Rallista/valhalla-mobile/tree/0.6.4
- Expo Router, modales et pile imbriquée : https://docs.expo.dev/router/advanced/modals/
- React Navigation, `usePreventRemove` : https://reactnavigation.org/docs/preventing-going-back
- TanStack Query, `enabled` : https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries
