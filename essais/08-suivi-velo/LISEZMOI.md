# Essai 08 (T1, partie A) : `trace_route` donne-t-il de bonnes directions ?

Essai jetable de la phase 8a. Il répond à la question du « Risque 1 » de la
spec : pour un tracé gardé, le moteur Valhalla (moteur de calcul d'itinéraire)
rend-il, par sa fonction `trace_route`, des directions écrites utilisables ?
Cette partie se fait sur le Mac, sans construire l'app et sans simulateur.

## Résumé

**`trace_route` suffit pour un itinéraire créé dans l'app et pour un circuit
balisé : directions identiques à celles de `route`, 0 m d'écart. Il ne suffit
pas seul pour un GPX venu de l'extérieur : il peut couper une partie du tracé
sans erreur, ou ajouter un demi-tour fantôme. Il faut donc le garder, avec un
contrôle du résultat et la parade (virages calculés d'après la forme du
tracé) en secours.** Détails plus bas.

## Moteur utilisé

- Valhalla 3.9.1 dans Docker (`ghcr.io/valhalla/valhalla:3.9.1`), avec
  `valhalla_tiles.tar` de la zone Nancy **v6** (fabriquée le 2026-11-09,
  trouvée dans
  `.claude/worktrees/phase-7-circuits-balises-715f16/zones/out/nancy/`).
- Réglages par défaut de Valhalla (générés par `valhalla_build_config`), sans
  autre changement que les chemins des tuiles. Les limites de service de
  valhalla-mobile sont celles du `defaultConfig` de la bibliothèque (non
  vérifiées une par une) : la limite de 16 000 points est celle de Valhalla.
- Coût : `bicycle`, `bicycle_type: mountain`, `use_roads: 0`
  (`ROUTE_COSTING` de `mobile/src/core/routing/routeRequest.ts`), langue
  `fr-FR`, unités en kilomètres.
- Le moteur tourne sur le Mac : les temps ci-dessous ne sont **pas** ceux d'un
  téléphone.

## Comment rejouer

Docker lancé, puis (de ce dossier ; `$TUILES` = dossier contenant
`valhalla_tiles.tar` et `trails.geojson` de Nancy v6, `valhalla.json` généré
par `valhalla_build_config --mjolnir-tile-extract /data/valhalla_tiles.tar
--mjolnir-tile-dir /data/tiles`, sans les clés `timezone` et `admin`) :

```
docker run -d --name vtt-t1 -p 8002:8002 -v $TUILES:/data \
  --entrypoint valhalla_service ghcr.io/valhalla/valhalla:3.9.1 /data/valhalla.json 1
python3 -I 1-itineraire-cree.py
python3 -I 2-circuit-haye.py $TUILES/trails.geojson
python3 -I 3-gpx.py $TUILES/trails.geojson ../../mobile/src/core/gpx/__testeur__/exemples/strava.gpx
python3 -I 4-diagnostic-troncature.py $TUILES/trails.geojson > resultats/4-diagnostic-troncature.txt
python3 -I 5-ecarts.py > resultats/5-ecarts-gpx.txt
python3 -I 6-sans-bruit.py $TUILES/trails.geojson > resultats/6-sans-bruit.txt
docker rm -f vtt-t1
```

Python 3 standard seulement (pas de paquet à installer). `outils.py` regroupe
les fonctions communes (appel du moteur, mesures d'écart, listes de directions).
`requetes/` contient les requêtes envoyées (la ligne encodée y est remplacée
par une note, elle est dans les scripts).

## Les 3 itinéraires

| | 1. Itinéraire créé | 2. Circuit de Haye | 3. GPX |
|---|---|---|---|
| Source | `route` avec 7 points de passage autour de la forêt de Haye (les mêmes requêtes que l'app) | ligne ordonnée du circuit OSM 11656724 dans `trails.geojson` (ADR 0020) | **GPX simulé** à partir du circuit 15712020 « Petite Suisse » (voir plus bas) |
| Longueur du tracé | 34 033 m | 21 326 m | 35 323 m |
| Points du tracé | 1 020 | 1 025 | 3 928 |
| Voie (part de la longueur) | sentier 42 %, chemin 19 %, route 37 % | chemin 61 %, sentier 32 %, route 6 % | chemin 59 %, route 39 %, sentier 1 % |
| Temps de réponse `trace_route` (`map_snap`) | 12 ms | 13 ms | 28 ms |
| Nombre de directions | 68 | 40 | 52 |
| Longueur recalée / longueur du tracé | 100 % | 100 % | 97 % |
| Écart moyen tracé -> recalé | 0,0 m | 0,0 m (95 % : 0,1 m) | 7,2 m (95 % : 9,1 m) |
| Part du tracé à plus de 20 m du recalé | 0 % | 0 % | 2,3 % (741 m, tout à la fin) |
| Directions absurdes | aucune | aucune | 1 demi-tour fantôme + 1 direction manquante |

(Les mots « sentier » et « chemin » sont ceux de Valhalla : `path` et
`track`.)

### 1. Itinéraire créé dans l'app

- 34 km, partant de l'ouest de la forêt de Haye (rue de Fontenoy) et en faisant le tour
  (un peu au-dessus des 35 km demandés au plus : j'ai retiré un point de
  passage pour tenir sous 35 km). Il contient 42 % de sentier.
- `trace_route` avec `map_snap` rend **exactement les mêmes 68 directions que
  `route`** (mêmes textes, même ordre) : le script le vérifie (`same
  instructions as route: True`). Rien d'étonnant : le tracé vient de `route`.
  Ce cas ne prouve donc que « le tracé d'un itinéraire de l'app se recale
  sur lui-même sans perte », ce qui est le besoin de la phase 8.
- Directions : listes dans `resultats/1-directions-route-reference.md` et
  `resultats/1-directions-trace_route-map_snap.md`.
- Pas d'absurdité : pas de demi-tour, pas de « tout droit » répétés. 5
  directions font moins de 30 m (deux ronds-points enchaînés, deux virages
  successifs à Route Neuve) ; ce sont de vrais enchaînements, pas des erreurs.
  Mon contrôle est automatique (voir « Ce que je n'ai pas vérifié »).
- **`edge_walk` échoue** : `Exact route match algorithm failed to find path`
  (code 443). Cause trouvée : il casse juste après un point de passage
  intermédiaire (`through`) de la requête, vers le km 5,4 ; avant ce point,
  il marche. Un itinéraire à un seul départ et une seule arrivée marche. Il
  rend le même résultat que `map_snap` quand il marche, mais l'app crée des
  itinéraires avec points de passage : **`edge_walk` est inutilisable tel
  quel, il faut `map_snap`**. `walk_or_snap` (essayé à la main) marche.

### 2. Circuit balisé de la forêt de Haye

- 21,3 km, boucle, ligne du paquet Nancy v6 (relation 11656724).
- `map_snap` : 40 directions, recalage à 0,1 m au plus : le moteur reprend
  exactement la même voie, partout.
- Directions : `resultats/2-directions-trace_route-map_snap.md`. Rien
  d'absurde. 4 directions de moins de 30 m, toutes de vraies jonctions.
- Les tronçons sur chemin ou sentier n'ont **pas de nom** : le texte est
  alors seulement « Tournez à gauche. » (32 directions sur 40 sans nom de
  voie). L'écran peut afficher le sens du virage et la distance, mais pas
  « prenez le chemin X ».

### 3. GPX

Le dépôt n'a que de très petits GPX de test (3 à 4 points :
`mobile/src/core/gpx/__testeur__/exemples/*.gpx`, `fixtures/`), et le GPX
long de l'essai 1 (`R3.gpx`) n'est plus sur le disque (il est refabriqué par
un script qui a besoin du réseau, hors de ce que j'avais le droit de faire).
J'ai donc fait deux choses.

- **GPX simulé** (`resultats/3-gpx-simule.gpx`, 3 928 points, 35 km) : la ligne
  du circuit « Petite Suisse Lorraine à VTT » (relation 15712020, dans la zone
  Nancy), un point tous les 8 m, avec une erreur GPS qui dérive
  lentement (4 m en moyenne, graine fixe). Ce n'est **pas** un vrai
  enregistrement : à refaire avec un vrai GPX de sortie VTT à la partie B
  ou plus tard (voir « Ce que je n'ai pas vérifié »).
- **Le vrai fichier de test du dépôt** `strava.gpx` (3 points, 87 m) : OK,
  3 directions en 2 ms, mais le recalage est de 19 m en moyenne (des points
  fabriqués à la main, hors des voies). Peu instructif.

Résultat sur le GPX simulé :
- 52 directions, 97 % de la longueur recalée, écart moyen 7 m.
- **Les derniers 741 m ne sont pas recalés** (de 34,56 km à la fin) : le
  moteur arrête sa route avant, sans erreur. Même chose sans aucun bruit
  (`resultats/3d-*`, ~700 m) : le bout du circuit 15712020 n'est pas
  praticable en vélo pour Valhalla. La direction « arrivée » tombe donc
  environ 740 m avant la vraie fin.
- **1 demi-tour fantôme** au km 16,3 (« Faites demi-tour à droite », 5 m,
  entre « Tournez tout de suite à droite » et « Tournez à gauche »), absent
  sans bruit (`resultats/6-sans-bruit.txt`) : un recalage sur une voie
  voisine, créé par l'erreur GPS. Et une direction (« Serrez à gauche pour
  rester sur Place Duroc ») a disparu.
- **Cas grave : une erreur GPS « blanche »** (chaque point décalé au hasard,
  sans lien avec le précédent, 4 m, un point tous les 8 m) fait que le moteur
  **rend seulement 29 % du tracé (11,3 km sur 38,9), avec 17 directions, sans
  erreur** (`resultats/4-diagnostic-troncature.txt`). Les réglages
  `gps_accuracy`, `search_radius` et `turn_penalty_factor` n'y changent
  rien. Avec 2 m de bruit : 95 % ; avec un point tous les 20 m : 95 %. Cette
  erreur « blanche » est plus dure que le GPS réel (qui dérive), mais elle
  montre que **le moteur ne signale pas** un recalage incomplet.
- Limite de points : **16 000** (`max_shape`). Un tracé de 16 824 points est
  refusé : `Too many shape points: (16824). The limit is 16000`
  (`resultats/3c-limite-points-reponse.json`). Un tracé de 11 029 points (un
  point tous les 3 m, 35 km) passe. Un GPX d'un point par seconde sur 4 h
  atteint 14 400 points : il faut alléger (un point tous les 10 à 20 m
  suffit : 1 831 points pour 35 km donnent 52 directions et 95 % de longueur recalée, comme à 3 928 points).

## Temps de réponse

12 à 28 ms sur le Mac, pour 1 000 à 4 000 points. Tracé de 11 029 points : voir
`resultats/4-diagnostic-troncature.txt` (pas chronométré). Sur téléphone, à
mesurer avec la partie B (la spec vise 2 s pour partir en suivi, C12).

## `trace_route` dans valhalla-mobile 0.6.4 (code source lu)

Oui, il est exposé sur iOS et sur Android, **sur le même modèle que
`traceAttributes`**, avec une forme typée et une forme brute en JSON.

- iOS, `apple/Sources/Valhalla/Valhalla.swift` :
  - ligne 14 : `func traceRoute(request: MapMatchRequest) throws -> MapMatchRouteResponse`
  - ligne 24 : `func traceRoute(rawRequest: String) throws -> String`
  - ligne 220 : `public func traceRoute(rawRequest request: String) throws -> String {`
    (qui appelle `withActor { $0.traceRoute(request) }`, puis
    `ValhallaWrapper.mm` ligne 251, `PerformAction(&trace_route, ...)`)
  - et, juste à côté, ligne 16 : `func traceAttributes(request:)` et ligne 225 :
    `public func traceAttributes(rawRequest request: String) throws -> String`.
- Android, `android/valhalla/src/main/java/com/valhalla/valhalla/Valhalla.kt` :
  - ligne 155 : `fun traceRoute(request: MapMatchRequest): MapMatchRouteResponse {`
  - ligne 262 : `fun traceRouteRaw(requestJson: String): String {`
    (`return checkForError(valhallaActor.traceRoute(requestJson))`)
  - à côté : ligne 197 `fun traceAttributes(request: TraceAttributesRequest)`
    et ligne 274 `fun traceAttributesRaw(requestJson: String): String`.
  - `ValhallaActor.kt` ligne 11 : `fun traceRoute(request: String): String` ;
    `ValhallaKotlin.kt` ligne 31 : `external fun traceRoute(handle: Long, request: ByteArray): ByteArray`.
- Le module de l'app (`mobile/modules/valhalla-route/`) n'expose aujourd'hui que
  `traceAttributes` (iOS : `ValhallaRouteModule.swift` ligne 88-89 ; Android :
  `ValhallaRouteModule.kt` ligne 84-85 ; TypeScript : `index.ts` ligne 17).
  **Il faudra ajouter une fonction `traceRoute(requestJson)` sur le même
  modèle, des deux côtés** (appeler `traceRouteRaw` / `traceRoute(rawRequest:)`).
  Je n'y ai rien touché.
- Réserve : le code source dit que `trace_route` peut aussi répondre en GPX ou
  en PBF selon `format` ; pour notre usage, on garde le JSON (la forme brute
  le permet).

## Conclusion franche

1. **Itinéraire créé et circuit balisé** : `trace_route` (`map_snap`) suffit.
   Le tracé est recalé sur lui-même sans perte, les directions sont bonnes et
   rapides, rien d'absurde. C'est le gros des cas de la phase 8.
2. **GPX importé** : `trace_route` seul ne suffit pas. Sur un tracé qui ne
   vient pas du moteur, il peut (a) laisser de côté la fin ou un morceau, sans
   erreur, (b) créer un demi-tour fantôme, (c) donner une arrivée trop tôt.
3. **Recommandation** : choisir `trace_route` comme source des directions, mais
   - prendre `map_snap` (pas `edge_walk`), alléger le tracé à un point tous
     les 10 à 20 m (limite 16 000 points) ;
   - **contrôler la réponse** : si la longueur recalée est sous environ 95 % de
     celle du tracé, ou si un morceau de plus de 100 m du tracé est à plus de
     20 m du recalé, ne pas utiliser les directions de ce morceau ;
   - garder la **parade** (virages calculés d'après la forme du tracé) pour ces
     morceaux, pour les tronçons tracés à la main, hors zone, et pour
     remplacer un demi-tour de moins de 20 m suspect ;
   - les chemins et sentiers n'ont pas de nom : prévoir un texte du genre
     « Tournez à droite » sans nom de voie.

   C'est donc « `trace_route` + contrôle + parade en secours », pas « la
   parade seule » et pas « `trace_route` seul ». Décision à confirmer par
   l'architecte dans l'ADR 0021.

## Ce que je n'ai pas vérifié

- Sur un téléphone : cette partie A n'a utilisé que le moteur Docker (même
  version 3.9.1 que valhalla-mobile 0.6.4, résultats annoncés identiques par le
  pilotage). Le temps sur téléphone, la mémoire et l'appel depuis l'app sont
  pour la partie B.
- Un vrai GPX enregistré en VTT : le GPX 3 est simulé.
- Si une direction est « juste » sur le terrain : mon contrôle de l'absurde est
  automatique (demi-tours, mêmes manœuvres à la suite, directions de moins de
  30 m, écart au tracé) et ne remplace pas l'avis d'un cycliste.
- Un tracé hors zone ou tracé à la main (la spec prévoit « Suivez le tracé »).
- `trace_options` avec un `turn_penalty_factor` plus fort contre le demi-tour
  fantôme : seulement essayé sur le cas du bruit blanc.

## T2, contrôle M1 (10 novembre, Mac, Docker Valhalla 3.9.1, zone Nancy v6)

Fait au début de la tâche T2 (ADR 0021, « Contrôles avant de bâtir dessus »).
Les tuiles de la phase 7 n'étaient plus sur le disque : `valhalla_tiles.tar`
et `trails.geojson` de la release `zone-nancy-v6` ont été retéléchargés
(`gh release download`), empreintes identiques à celles de `SHA256SUMS`.
`7-forme-allegee.py` envoie, pour chacun des 4 itinéraires, la ligne éclaircie
à **un point tous les 20 m** à `trace_route` et à `trace_attributes`
(`map_snap`) ; sortie dans `resultats/7-forme-allegee.txt`.

- **Mêmes directions qu'avec tous les points** : oui pour 1 (68), 2 (40) et 3d
  (52). Pour 3 (GPX bruité) : 53 au lieu de 52, la direction de plus est
  « Serrez à gauche pour rester sur Place Duroc », celle que le bruit faisait
  disparaître avec tous les points (elle est dans la version sans bruit).
  Le demi-tour fantôme du km 16,3 reste dans les deux cas.
- **B6, deux formes recalées** (`trace_route` et `trace_attributes`) :
  identiques point pour point pour 1 et 2. Pas pour 3 et 3d : sur 3d,
  `trace_attributes` rend le circuit entier (34 904 m) alors que `trace_route`
  s'arrête 740 m avant la fin (34 167 m), mais les 1 262 premiers points sont
  identiques ; sur 3, les formes se séparent au point 533, au demi-tour
  fantôme. Le code compare donc les deux formes depuis le début et ne donne le
  type de voie qu'aux manœuvres dont l'indice est dans la partie commune.
- Réponses gardées : `resultats/m1-<n>-trace_route-20m-reponse.json` et
  `m1-<n>-trace_attributes-20m-reponse.json`. Les fixtures de Jest en sont
  tirées par `8-fixtures.py` (`mobile/src/core/tracking/fixtures/`), et la
  liste de directions de référence par `9-reference-directions.py`.
- Temps sur le Mac : 12 à 97 ms pour `trace_route` (le 97 ms est le premier
  appel), 9 à 15 ms pour `trace_attributes`.
