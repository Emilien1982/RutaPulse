# T4 : table de correspondance des tests de la phase 3

Phase 4, tâche T4, contrôle du `testeur`. Cette table dit ce qu'est devenu
chaque test de la phase 3 qui échouait après T4 (61 tests, 2 causes voulues).
Références : ADR 0016 (`docs/adr/0016-itineraire-en-creation.md`), spec
(`docs/phases/p04-creer-modifier-itineraire.md`), écart M1 de
`design/comparaisons/p03-t6.md`.

Types de changement : **porté** (même test, même sens, nouvel écran),
**adapté** (même intention, scénario ou assertion changés), **retiré**
(comportement supprimé, avec justification).

Fichiers des nouveaux tests :

- `mobile/src/features/map/DraftScreenPortT4Testeur.test.tsx` (écran
  `DraftScreen`, moteur de calcul simulé), appelé « Port » plus bas ;
- `mobile/src/features/map/DraftScreenZonePortT4Testeur.test.tsx` (écran
  `DraftScreen` avec le vrai moteur de `core/routing/routingEngine.ts` et un
  module natif simulé et compté), appelé « Zone » plus bas. Il existe parce que
  le test du rectangle d'un point d'arrivée se fait dans le moteur (ADR 0016,
  section 5), pas dans l'écran : « 0 appel au moteur » se compte donc sur
  l'appel natif.

## 1. Ancienne création supprimée (38 tests)

ADR 0016, section 2 : `useRouteCreation` et la création dans `ZoneMap`
disparaissent, « Nouvel itinéraire » ouvre `/draft`.

### `RouteCreation.test.tsx` (13 tests retirés du fichier, 2 gardés)

| Titre d'origine | Nouveau test | Type |
|---|---|---|
| « Nouvel itinéraire » button › opens the creation: top bar, hint, no button | Port : « the button of the map tab opens /draft instead of drawing in place » et « opens the creation: top bar, hint, no "Nouvel itinéraire" button » | adapté |
| … › closes the creation with the cross | Port : « closes the creation with the cross, without a question under 2 points » | adapté |
| route creation › ignores the touches outside the creation | Port : « the map tab ignores the touches: no point, no engine call » | adapté (il n'y a plus de mode création sur l'onglet Carte) |
| … › first touch sets the start and asks for the end | Port : « the first touch sets the start and asks for the end, no engine call » | porté |
| … › second touch computes, then shows distance and duration | Port : « the second touch computes, the figures fade meanwhile, then show 25,1 km and 1 h 35 » | adapté (plus de texte « Calcul en cours… » : le résumé reste, atténué ; les points portent un `id` ; espace fine) |
| … › a new touch after the end replaces the end and computes again | aucun | **retiré** : ADR 0016 section 1 « Ajouter : le point va à la fin » et choix 1 de la spec (« Un point s'ajoute toujours à la fin »). Le cas équivalent est dans `DraftScreenSpec.test.tsx` (C2 : « a touch adds one point at the end and starts one calculation ») |
| errors › a point outside the zone: sheet of the mockup 52, engine not called | Port : « a first point outside the zone: sheet of mockup 52, engine not called, no download button » | adapté (l'assertion « pas de texte à la main » est retirée : la spec C9 ajoute « Relier ce point à la main » en T5) |
| … › "Retirer ce point" drops the refused touch and keeps the start | Zone : « the refused point is the outside one: "Retirer ce point" keeps the start » | adapté (moteur réel : le rectangle de l'arrivée est testé dans le moteur) |
| … › outOfZone answered by the engine is shown the same way | Port : « outOfZone answered by the engine is shown the same way » | porté |
| … › noRoute shows a French message and a way out | Port : « %s shows a French message and a way out » (noRoute) | porté |
| … › engineUnavailable shows a French message and a way out | idem (engineUnavailable) | porté |
| … › zoneUnreadable shows a French message and a way out | idem (zoneUnreadable) | porté |
| … › failed shows a French message and a way out | idem (failed) | porté |

Gardés sans changement dans `RouteCreation.test.tsx` : « is on the map with a
zone » et « does not exist on the map without a zone ». Le fichier a perdu ses
aides devenues inutiles (`touchMap`, `startRoute`, `mockLineData`).

### `RouteCreationT4Testeur.test.tsx` (11 tests retirés, 1 gardé)

| Titre d'origine | Nouveau test | Type |
|---|---|---|
| spec T4 : parcours › parcours complet : titre, appel dans l ordre, résumé de la maquette, sortie | Port : « full path: title, one call, figures, the cross asks nothing wrong, "Enregistrer" and "D+" absent » | adapté (2 points : la sortie est gardée, la croix appelle `router.back`) |
| … › pendant le calcul : indicateur visible | Port : « the second touch computes, the figures fade meanwhile… » et Spec C10 : « keeps the previous figures, faded, during a calculation » | adapté (l'indicateur « Calcul en cours… » est remplacé par les chiffres atténués ; la clé `route.computing` a été retirée de `fr.ts` en T4) |
| … › hors périmètre absent | Port : « full path… » (vérifie « Enregistrer » et « D+ » absents) | adapté : « Boucler » et « Annuler » ne sont plus hors périmètre (spec C5 et C6, ADR 0016 section 1) ; ils sont testés dans `DraftScreenSpec.test.tsx` |
| spec C6 : erreurs › messages français non vides, distincts, avec une sortie | Port : « the messages are French, not empty, and distinct from one kind to the other » | porté (`farFromPath` a le même titre que `noRoute` : il n'est pas dans la boucle des titres distincts, mais dans le « %s shows… ») |
| … › point hors rectangle : message, computeRoute non appelé | Port : « a point outside the rectangle: message, engine not called » et Zone : « start outside the rectangle: same sheet, zero native call » | porté |
| … › arrivée hors rectangle après un départ valide : pas d appel | Zone : « end outside the rectangle: sheet "Point hors de votre zone", zero native call » et « end far to the east… » | adapté (compté sur l'appel natif : voir l'introduction) |
| … › Retirer ce point : on peut toucher à nouveau et calculer | Port : « "Retirer ce point" on a first point outside: we can touch again and compute » | porté |
| … › après une erreur du moteur, Retirer ce point permet un nouvel essai | Port : « after an engine error, "Retirer ce point" allows a new try, computed again » | porté |
| … › computeRoute qui rejette : l écran ne plante pas | Port : « a rejected computeRoute does not crash the screen, nor leave it computing » | adapté (la feuille « Calcul impossible » s'ouvre) |
| spec : réponse lente puis arrivée changée › seule la dernière réponse s affiche | Port : « only the answer of the legs still on screen is shown » | adapté : on ne remplace plus l'arrivée (ADR 0016 section 1) ; on supprime le point du tronçon lent puis on en ajoute un autre |
| … › réponse lente en erreur ignorée si une autre est arrivée | Port : « a slow failure of a leg no longer on screen is ignored » | adapté (même raison) |

Gardé : « bouton visible avec une zone, absent sans zone ».

### `RouteCreationRace.test.tsx` (2 tests, fichier supprimé)

| Titre d'origine | Nouveau test | Type |
|---|---|---|
| touches that arrive before a render › two touches in the same act compute one route from A to B | Port : « two touches in the same act add two points and compute one leg » | adapté (garde de 120 ms, deux points, un calcul) |
| … › a touch right after "Nouvel itinéraire" sets the start | Port : « a touch right after the screen opens sets the start » | adapté |

### `RouteCreationOutOfZoneT3Testeur.test.tsx` (2 tests, fichier supprimé)

| Titre d'origine | Nouveau test | Type |
|---|---|---|
| end outside the rectangle: sheet "Point hors de votre zone", zero engine call | Zone : « end outside the rectangle: sheet "Point hors de votre zone", zero native call » | adapté |
| start outside the rectangle: same sheet, zero engine call | Zone : « start outside the rectangle: same sheet, zero native call » | adapté |

### `RouteFixT7.test.tsx` (10 tests retirés, 2 gardés)

Les ids des sources et des couches passent de `route-*` à `draft-*`
(`DraftLayers.tsx`).

| Titre d'origine | Nouveau test | Type |
|---|---|---|
| B1 dotted link › draws start -> first point and last point -> end, under the route | Port : même titre | porté (ids `draft-*`) ; Port ajoute « draws the link at both ends of every leg (3 points: 4 links) » |
| … › draws no link when the points are on the route (< 5 m) | Port : même titre | porté |
| … › draws no link while computing | Port : même titre | porté |
| … › draws no link with an error sheet | Port : « draws no link for a leg with an error sheet » | porté |
| B1 layer order › renders the route source and its casing from the opening | Port : « keeps all the sources and layers mounted from the opening » | adapté (l'ordre est vérifié par comparaison, pas par liste exacte, car il y a maintenant une source d'aperçu) |
| … › puts the link layer under the casing with beforeId | Port : même titre | porté (`draft-casing`) |
| … › keeps the link source mounted when the link goes and comes back | Port : même titre | adapté : le rectangle est testé par le moteur, il répond donc `outOfZone` ; « aucune liaison pendant l'erreur » devient « aucune liaison n'atteint le point refusé », car les tronçons déjà bons gardent leurs liaisons |
| B2 recenter button › goes to bar height + 64 in creation | Port : « stays at 60 on the map tab, goes to bar height + 64 in creation » (et « follows the measured height of the top bar ») | porté |
| B3 refused point › centers it in the visible part: bar on top, sheet at the bottom | Port : même titre | porté |
| B3 camera after the error › does not move the camera when the error goes away | Port : même titre | porté |

Gardés : « B2 recenter button › stays at 60 outside the creation » (le test du
même nom est aussi couvert dans Port) et « B3 recenter › passes a zero padding… ».

## 2. Espace fine insécable U+202F (23 tests modifiés)

Écart M1 de `design/comparaisons/p03-t6.md`. Seule l'espace attendue change
(` `), avec un commentaire en tête de fichier. Type : **adapté** pour les
23.

| Fichier | Tests modifiés |
|---|---|
| `core/routing/formatRoute.test.ts` (5) | formatDistance › formats the length given by Valhalla ; shows meters under one kilometer ; uses the French decimal comma, one decimal ; formatDuration › shows minutes under one hour ; shows hours and two-digit minutes |
| `core/routing/formatRouteRounding.test.ts` (2) | writes 0.9996 km in kilometers, not "1000 m" ; keeps meters just under the limit |
| `core/routing/formatRouteT4Testeur.test.ts` (14) | formatDistance : 25.1, 0, 0.999, 1, 99.95, 12.34, 0.85 ; formatDuration : 5700, 0, 59, 3599, 3600, 1260, 3660 |
| `core/draft/legs.test.ts` (1) | summarize › ends up as "1 min" when the sum is under a minute |
| `core/draft/draftSpec.test.ts` (1) | summarize (C7, C8, C10) › minimum duration displays "1 min" (0 s and 20 s) |

## 3. Totaux

Mesures de Jest (`npx jest`, `npm run verify`).

| | Tests | Dont en échec |
|---|---|---|
| Avant T4-testeur (état reçu) | 776 (775 annoncés : un test de plus à l'exécution) | 61 |
| Retirés des anciens fichiers (ancienne création) | 38 | |
| Ajoutés : portage (Port 36 + Zone 5) | 41 | |
| Ajoutés : tests de la spec (`DraftScreenSpec.test.tsx`) | 39 | |
| Modifiés sur place (espace fine) | 23 (compris dans les 776) | |
| **Après** | **818** | **0** |

Contrôle : 776 − 38 + 41 + 39 = 818.

Le nombre de tests monte de 42. Sur les 38 tests retirés de leur fichier, un
seul est retiré sans remplaçant du même sens (« a new touch after the end
replaces the end »), son contraire étant testé dans la spec (C2). Les
assertions « Boucler » et « Annuler absents » sont retirées : ces boutons sont
dans le périmètre. Les 4 tests de la phase 3 qui passaient déjà restent à leur
place, sans changement.
