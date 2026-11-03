# ADR 0019 — Itinéraires gardés et fichiers GPX

- Statut : Accepté le 2026-11-03 par Émilien (proposé le même jour)
- Date : 2026-11-03 (phase 6, tâche T1 de [p06-mes-itineraires-gpx](../phases/p06-mes-itineraires-gpx.md))
- Précise l'[ADR 0007](0007-donnees-locales-et-etat.md) (SQLite lu par
  TanStack Query), l'[ADR 0016](0016-itineraire-en-creation.md) (création
  rouverte), l'[ADR 0017](0017-infos-itineraire-calcul.md) (infos d'un
  tracé gardé) et l'[ADR 0018](0018-difficulte-et-mise-a-jour-des-zones.md)
  (décision 5 : tracé gardé, infos recalculées). Suit les règles d'import
  des ADR 0011, 0014 et 0015 sans les changer.

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture). GPX veut dire « GPS Exchange Format » (format standard
d'échange de traces GPS, écrit en XML, un langage de balises).

## Contexte

- La spec validée fait foi : critères C1 à C16, les 6 choix du pilotage, et
  la décision d'Émilien sur la question 1 : **un GPX importé n'est pas
  modifiable** dans cette phase.
- La maquette 40 complétée par le designer (`design/v1/40-mes-itineraires.html`)
  pose 8 points à trancher ici (§ 13).
- **Essai jetable de T1**, en version finale (release), iPhone 17 et
  émulateur Android (preuves hors dépôt :
  `vtt-nav-preuves/p06/t1-essai/LISEZMOI.md`) :
  - `expo-sqlite` 58.0.15, `expo-document-picker` 58.0.4 et `expo-sharing`
    58.0.21 marchent sur les deux plateformes. `PRAGMA user_version` se lit
    et se change ; `ALTER TABLE` dans une transaction marche ; les données
    restent après l'app tuée puis relancée ;
  - **piège Android** : le build release plante au lancement
    (`Cannot find native module 'ExpoSQLite'`) avec `expo-modules-core`
    58.0.23, la version fixée par `package-lock.json` (fichier de verrou des
    versions). Il marche avec 58.0.29 ;
  - le sélecteur de fichier renvoie `application/octet-stream` pour un
    `.gpx` : le type MIME (étiquette du type de fichier) ne sert à rien ;
  - `File.size` lu juste après `write()` vaut 0 ;
  - **C4 : non.** Les tuiles n'ont que des points de lieux nommés, sans
    contour de commune. « Le lieu le plus proche » ne donne la bonne commune
    que dans 68 % des cas.
- Ce que fait le code aujourd'hui (lu le 3 novembre 2026, commit `e2bad33`) :
  - le brouillon (`core/draft/draft.ts`) : `Draft = { points: DraftPoint[]; modes: LegMode[]; linked?: number[] }`,
    avec `DraftPoint = { id, lon, lat }` et `LegMode = 'path' | 'hand'` ;
  - un tronçon calculé donne un `RouteSuccess = { ok: true; shape: [lon, lat][]; distanceKm; durationS }`
    (`core/routing/routeResponse.ts`). Un tronçon à la main est une ligne
    droite, `handLeg` (`core/draft/legs.ts`) ;
  - `encodePolyline6` et `decodePolyline6` existent et sont testées ;
  - les infos se calculent tronçon par tronçon : `useLegResults`,
    `useLegInfos`, `summarizeInfo`, `summarizeDifficulty`,
    `useDifficultyTable`, tous dans `features/map/` ;
  - la clé de Query (TanStack Query, bibliothèque qui gère les lectures
    asynchrones et leur mémoire, le cache) d'un tronçon ne dépend que de la
    zone, du mode et des deux points ;
  - une seule zone est **en service** à la fois (`zoneService`,
    ADR 0018, § 4). Un écran qui lit une zone longtemps prend une prise
    (hold) avec `useZoneHold()` ;
  - le catalogue des zones est lu par `features/zones/useCatalogue.ts`,
    gardé en mémoire seulement : il n'est pas écrit sur le disque.

## Décision

### 1. La base de données

**Un fichier, une table.** Fichier `routes.db`, dans le dossier par défaut
d'`expo-sqlite` (documents de l'app : gardé, jamais vidé par le système).
Une seule connexion pour toute l'app, ouverte au premier besoin.

```sql
CREATE TABLE routes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  origin       TEXT    NOT NULL CHECK (origin IN ('created', 'gpx')),
  created_at   INTEGER NOT NULL,  -- ms depuis 1970 (UTC) : création ou import
  saved_at     INTEGER NOT NULL,  -- ms : dernier « Enregistrer » ou import ; ordre de la liste
  zone_id      TEXT,
  zone_version INTEGER,
  zone_name    TEXT,
  draft        TEXT,              -- créé : JSON du Draft
  legs         TEXT,              -- créé : JSON des tronçons
  track        TEXT,              -- GPX : polyligne encodée à 6 décimales
  elevations   TEXT,              -- GPX : JSON des altitudes du fichier
  preview      TEXT    NOT NULL,  -- polyligne encodée, 66 points au plus
  distance_km  REAL    NOT NULL,
  duration_s   REAL    NOT NULL,
  ascent_m     INTEGER,           -- NULL : jamais connu
  descent_m    INTEGER,           -- NULL : jamais connu
  figures_at   INTEGER,           -- ms : dernier calcul de D+ et D−
  CHECK ((origin = 'created' AND draft IS NOT NULL AND legs IS NOT NULL
          AND track IS NULL AND elevations IS NULL AND zone_id IS NOT NULL)
      OR (origin = 'gpx' AND track IS NOT NULL
          AND draft IS NULL AND legs IS NULL)),
  CHECK ((zone_id IS NULL) = (zone_version IS NULL)
     AND (zone_id IS NULL) = (zone_name IS NULL))
) STRICT;
```

- **`STRICT`** (mode de SQLite qui refuse une valeur du mauvais type) :
  une erreur de type casse un test au lieu de se glisser dans la base.
  Il demande SQLite 3.37 ou plus (contrôle 2).
- **`AUTOINCREMENT`** : un numéro n'est jamais réutilisé après une
  suppression. Les clés de Query d'un GPX contiennent son `id` (§ 5) : un
  nouveau GPX ne doit pas hériter du cache d'un ancien.
- **Dates en entiers** (millisecondes UTC, temps universel) : elles se
  trient et se comparent sans conversion. L'affichage se fait en heure
  locale.
- **Trois dates, chacune pour un usage** :
  - `created_at` : « créé le », « GPX importé le » ;
  - `saved_at` : l'ordre de la liste, et « modifié le » quand elle diffère
    de `created_at` (maquette 40). **Renommer ne la change pas** (§ 13,
    point 7) ;
  - `figures_at` : « Chiffres du dernier calcul, le … » (écran 7b).
- **Zone** : `zone_id`, `zone_version` et `zone_name` vont ensemble. Le nom
  est gardé pour dire « Zone Nancy supprimée » quand la zone n'est plus là.
  Un GPX hors zone a les trois à `NULL`.
- **Chiffres de la liste** (choix 6 du pilotage) : distance, durée, D+, D−.
  Ils sont écrits à l'enregistrement ou à l'import, puis à chaque ouverture
  de l'écran Infos (§ 5).
- **Aucun index** en plus de la clé primaire. La liste compte quelques
  dizaines de lignes ; SQLite les trie en moins d'1 ms. Un index se créera
  par une migration si une mesure le demande.
- **Pas de table par point ou par tronçon** : un itinéraire se lit et
  s'écrit toujours en entier. Une colonne JSON (format texte de données)
  évite des jointures et des dizaines d'insertions par enregistrement.
- **La liste ne lit pas les colonnes lourdes** (`draft`, `legs`, `track`,
  `elevations`) :
  `SELECT id, name, origin, created_at, saved_at, zone_id, zone_name, preview, distance_km, duration_s, ascent_m, descent_m, figures_at FROM routes ORDER BY saved_at DESC, id DESC`.

**Forme des colonnes JSON** (validée à la lecture, voir plus bas) :

| Colonne | Contenu |
|---|---|
| `draft` | exactement le type `Draft` : `{"points":[{"id":1,"lon":6.18,"lat":48.69},…],"modes":["path","hand"],"linked":[3]}` (`linked` absent si vide) |
| `legs` | une entrée par tronçon, dans l'ordre de `modes`. Tronçon calculé : `{"mode":"path","zoneVersion":5,"distanceKm":2.345,"durationS":612,"shape":"<polyligne6>"}`. Tronçon à la main : `{"mode":"hand"}` (la ligne droite se refait depuis les points) |
| `elevations` | GPX seulement : une altitude par point de `track`, en mètres arrondis au dixième, ou `null`. Colonne `NULL` si aucun point du fichier n'a d'altitude |

**Le tracé gardé** : polyligne encodée à 6 décimales (polyline : suite de
points écrite en texte compact, le format de Valhalla), avec les fonctions
existantes `encodePolyline6` et `decodePolyline6`.
- Précision : 1e-6 degré, soit 0,11 m au plus. C11 demande 1 m.
- Un aller-retour export puis import redonne **exactement** les mêmes
  points : le GPX est écrit à 6 décimales (§ 8).
- Taille : 4 à 8 octets par point, contre 20 à 25 en JSON. Un GPX de
  10 000 points fait environ 60 Ko.
- Rapide à lire : environ 10 000 points se décodent en quelques
  millisecondes.

**Lecture qui ne lève jamais d'erreur.** `rowToRoute` (`core/routes/`)
contrôle chaque ligne : JSON lisible, points en nombres finis, latitude
entre −90 et 90, longitude entre −180 et 180, `id` entiers positifs et
uniques, `modes` d'une case de moins que `points`, `legs` de la longueur
de `modes` et du même mode, polyligne d'au moins 2 points. Une ligne
fausse donne un itinéraire « illisible » : il reste dans la liste, on peut
le renommer et le supprimer, l'écran Infos le dit. Pas de plantage.

### 2. Numéro de version et montée de version

- Le numéro est `PRAGMA user_version` (un entier rangé dans l'en-tête du
  fichier SQLite). Base neuve : 0. **Cette phase livre la version 1.**
- Les migrations sont une liste ordonnée : `MIGRATIONS[i]` fait passer la
  base de la version `i` à la version `i + 1`. `MIGRATIONS[0]` crée la
  table du § 1. Une migration n'est jamais changée après sa livraison : on
  en ajoute une nouvelle.
- **À l'ouverture**, `migrate(db, MIGRATIONS)` :
  1. lit `user_version` (`v`) ;
  2. si `v` = nombre de migrations : rien ;
  3. si `v` < nombre de migrations : passe chaque migration de `v` à la
     fin, **une par transaction exclusive**
     (`withExclusiveTransactionAsync`). Chaque transaction contient les
     ordres SQL de la migration **et** `PRAGMA user_version = v + 1`. Un
     échec annule la transaction : la base reste à la version d'avant,
     entière ;
  4. si `v` > nombre de migrations (base écrite par une app plus récente,
     puis app plus ancienne réinstallée) : **aucune écriture**. La base
     est déclarée « trop récente » : la liste affiche un message (« Mettez
     à jour RutaPulse pour retrouver vos itinéraires », texte final : le
     designer), « Enregistrer » et « Importer » montrent le même message.
     Aucune donnée n'est touchée.
- Un changement de la forme des colonnes JSON est aussi une migration :
  elle réécrit les lignes, dans sa transaction.
- **Pourquoi `withExclusiveTransactionAsync`** : la doc d'`expo-sqlite`
  dit que `withTransactionAsync` n'est pas exclusive. Une autre requête
  pourrait entrer dans la transaction pendant une migration.

**Tests (C2)**, sur une vraie base SQLite en mémoire dans Jest, avec le
module `node:sqlite` de Node 24 (la version de la CI) :
- base neuve : version 1, table créée, et les contraintes `CHECK`
  refusent une ligne fausse (GPX sans `track`, itinéraire créé sans zone) ;
- ouverture deux fois : rien ne change ;
- **vraie montée** : une liste de test `[MIGRATIONS[0], ajout d'une colonne]`.
  Une ligne écrite en version 1 se relit intacte en version 2 ;
- migration qui échoue au milieu : version et tables inchangées ;
- base en version 99 : statut « trop récente », schéma et lignes
  inchangés.

### 3. Place du code (ADR 0011 et 0014)

| Dossier | Contenu |
|---|---|
| `core/gpx/` (nouveau) | `xmlScan.ts` : lecteur XML restreint (§ 9). `readGpx.ts` : `readGpx(text) → GpxResult`. `writeGpx.ts` : `writeGpx({ name, points }) → string`. `gpxFileName.ts`. Les fichiers d'exemple du testeur dans `core/gpx/fixtures/` |
| `core/routes/` (nouveau) | `sqlDb.ts` : l'interface `SqlDb` (exécuter, lire, transaction exclusive), sur le modèle de `ZoneOps`. `migrations.ts` : `MIGRATIONS`, `migrate`. `routeRepo.ts` : lire la liste, lire un itinéraire, insérer, remplacer, renommer, supprimer, mettre à jour les chiffres, rattacher une zone, compter par zone. `savedRoute.ts` : types, `rowToRoute`, `routeToRow`. `routeName.ts` : nom par défaut, nom unique, règles du nom. `track.ts` : tracé d'un itinéraire créé, longueur, éclaircissement, rectangle. `routeZone.ts` : état de la zone d'un itinéraire (§ 6). `reopen.ts` : brouillon rouvert et tronçons gardés (§ 4). `testing/nodeSqlDb.ts` : `SqlDb` sur `node:sqlite`, pour les tests |
| `core/routing/` | `buildPointHeightRequest`, `parsePointHeights`, `routingEngine.pointHeights` : une altitude par point, pour l'export (§ 8) |
| `core/zones/` | `zonesCovering(zones, lon, lat)` : les zones du catalogue dont le rectangle contient un point |
| `shared-data/routes/` (nouveau) | `routesDb.ts` : `SqlDb` sur `expo-sqlite`, ouverture unique et migration. `useRoutes.ts` : les hooks Query et leurs invalidations (§ 10). `exportRoute.ts` : écrire le fichier et ouvrir la feuille de partage (`expo-file-system`, `expo-sharing`) |
| `shared-data/routing/` | `computePointHeights(shape, signal?)`, aussi mince que `computeHeights` |
| `shared-data/zones/` | `useCatalogue.ts`, **déplacé** de `features/zones/` : la liste (import hors zone) et l'écran Infos (carte « hors zone ») le lisent aussi |
| `features/routes/` | l'onglet Itinéraires : liste, liste vide, ligne, import (`pickGpxFile.ts` avec `expo-document-picker`, `importGpx.ts`), feuille « GPX hors de vos zones » |
| `features/map/` | « Enregistrer » dans la création ; `DraftSession` rouvre un itinéraire gardé (§ 4) ; `SavedRouteInfoScreen` (Infos d'un itinéraire gardé) ; `RouteInfoView`, la partie affichée commune, sortie de `RouteInfoScreen` ; `useTrackInfos` (infos d'un GPX, § 5) |
| `features/zones/` | la phrase « N itinéraires utilisent cette zone » dans la boîte de suppression (§ 13, point 8) |
| `ui/` | `RenameSheet.tsx` (feuille « Renommer »), `openActionMenu.ts` (menu « ⋮ », § 13, point 4), `RoutePreview.tsx` (le tracé seul en SVG, dessin vectoriel : médaillon de la liste et arche sans zone) |
| `app/` | `route/[id].tsx`, fichier mince vers `SavedRouteInfoScreen` ; sa ligne dans `app/_layout.tsx` |

- **Les infos d'un itinéraire gardé restent dans `features/map/`.** Elles
  ont besoin du fond de carte, de `useLegInfos` et de
  `useDifficultyTable`, déjà dans ce dossier. La liste ouvre l'écran par
  son adresse (`router.push('/route/12')`) : `features/routes/` n'importe
  pas `features/map/`. Aucun déplacement de la carte n'est nécessaire.
- **Pourquoi la base est dans `shared-data/`** : la liste, la création
  (« Enregistrer »), l'écran Infos et l'écran Zones (compte par zone) la
  lisent. La logique (SQL, migrations, lecture des lignes) est dans
  `core/routes/`, testée sans téléphone, comme `core/zones/` avec
  `ZoneOps`.
- **`expo-document-picker`** ne sert qu'à l'import, dans la liste : il reste
  dans `features/routes/` (règle de l'ADR 0014).
- **`expo-sharing`** sert depuis la liste **et** depuis le menu « ⋮ » de
  l'écran Infos (maquette 40, écran 3) : il va dans
  `shared-data/routes/exportRoute.ts`.

### 4. Ce qu'on garde, et « Modifier » (C3, C7)

**Un itinéraire créé garde** : nom ; `draft` (points avec leurs `id`,
modes, `linked`) ; `legs` (pour chaque tronçon calculé : sa forme, sa
distance et sa durée du moteur, et **la version de zone qui l'a
calculée**) ; zone, version et nom de zone de l'enregistrement ; origine
`created` ; dates ; chiffres. Le trait de liaison n'est pas gardé : il se
redessine depuis les points et les formes.

**Un GPX importé garde** : nom ; `track` (tous les points du fichier, dans
l'ordre, § 7) ; `elevations` (altitudes du fichier, pour l'export
seulement) ; zone si elle est trouvée (§ 6) ; origine `gpx` ; dates ;
chiffres. Pas d'horodatage, pas de points d'intérêt (`wpt`), pas
d'extensions.

**« Enregistrer » dans la création** :
- actif quand le résumé est touchable : 2 points au moins, chiffres connus,
  aucune feuille d'erreur (même règle que l'ouverture d'Infos, ADR 0017,
  § 7). Donc chaque tronçon calculé a sa forme ;
- garde tout de suite, sans demander de nom (choix 1). D+ et D− sont pris
  s'ils sont prêts, sinon `NULL`, complétés à l'ouverture d'Infos qui suit ;
- **nouvel itinéraire** : `INSERT`, nom par défaut (§ 13, point 6) ;
- **itinéraire rouvert** : `UPDATE` de la même ligne (`draft`, `legs`,
  zone, `preview`, chiffres, `saved_at`). Le nom et `created_at` ne
  changent pas. « Enregistrer » remplace (C7) ;
- puis `router.push('/draft/infos')` : l'écran Infos de la session, avec
  le nom en titre (choix 2).

**« Modifier »** (C7) depuis l'écran Infos d'un itinéraire créé dont la
zone est en service :
1. `router.push({ pathname: '/draft', params: { routeId: '12' } })`.
2. `DraftSession` lit l'itinéraire (`useSavedRoute`), prend sa prise de
   zone, puis contrôle encore que la zone tenue a le même `id`. Sinon il
   ferme avec le message « zone absente ».
3. `reopenDraft(route)` (`core/routes/reopen.ts`) rend :
   - l'état de départ du Store :
     `{ draft: route.draft, past: [], nextMode: 'path', selected: null, nextId: plus grand id + 1 }`.
     L'historique est vide : « Annuler » ne remonte pas avant la version
     gardée ;
   - **les tronçons gardés** : pour chaque tronçon calculé, la clé
     `legKey(from, to)` (les coordonnées des deux points) vers sa forme,
     sa distance, sa durée et sa version de zone.
4. **La règle** : `useLegResults` reçoit les tronçons gardés. Un tronçon
   « par les chemins » dont les deux bouts ont exactement les coordonnées
   d'un tronçon gardé **prend la forme gardée, sans calcul**. Tout autre
   tronçon est calculé par le moteur, sur la zone tenue. Donc :
   - un tronçon qu'on ne touche pas garde son tracé, **même si la zone a
     été mise à jour entre-temps** (forme de la v3, zone en service v4) ;
   - déplacer un point recalcule ses deux tronçons, sur la v4 ;
   - « Annuler » qui ramène un point à sa place retrouve la forme gardée ;
   - passer un tronçon « à la main » puis revenir « par les chemins »
     retrouve aussi la forme gardée (mêmes bouts).
5. **La session sait ce qui est enregistré** : `routeId` et `savedDraft`
   (l'objet `Draft` du dernier enregistrement). Il y a des changements si
   `store.state.draft !== savedDraft`. Comparer les objets suffit :
   `reduceDraft` crée un nouvel objet à chaque action, et « Annuler » rend
   l'objet d'avant.
6. **Fermer** : sans changement, la croix ferme sans question. Avec des
   changements, `usePreventRemove` ouvre « Abandonner les changements ? »
   (textes du designer). « Abandonner » ferme : rien n'est écrit, la base
   n'est touchée que par « Enregistrer » (C7).
7. Après « Enregistrer » dans une session rouverte, `savedDraft` devient
   le brouillon enregistré. Les tronçons gardés ne changent pas ; les
   tronçons recalculés sont dans le cache de Query.

**Ce qui est écrit pour un tronçon** : forme gardée et sa version, ou
résultat du moteur et la version de la zone tenue. Un itinéraire peut donc
mêler des tronçons de la v3 et de la v4. C'est voulu (C7).

**Un GPX importé n'a pas « Modifier »** (question 1). Le bouton n'apparaît
pas. La phase 7 fera le geste « trace → itinéraire modifiable ».

### 5. Infos recalculées à l'ouverture (C6)

**Où** : `SavedRouteInfoScreen` (`features/map/`), adresse `/route/[id]`.
Il prend une prise de zone (`useZoneHold`), comme la création : une mise à
jour de zone ne passe pas sous un calcul en cours (ADR 0018, § 4).

**Quand on calcule** : seulement si la zone de l'itinéraire est utilisable
(§ 6). Sinon, aucun appel au moteur.

**Itinéraire créé** : les fonctions existantes, sans copie.
- Les états des tronçons viennent de la base : forme gardée pour un
  tronçon calculé, `handLeg` pour un tronçon à la main. Même chemin de code
  que les tronçons gardés de « Modifier » (§ 4).
- `useLegInfos(draft, zone, states, true)` lance `height` et
  `trace_attributes` sur ces formes, avec la zone en service ;
  `summarizeInfo`, `summarizeDifficulty` et `useDifficultyTable(zone)`
  font le reste. La difficulté vient de la table de la zone en service :
  un itinéraire gardé sous la v3 (sans table) a sa difficulté sous la v4
  (C6).
- **La clé d'un tronçon calculé gagne la version de la forme** :
  `['routing', kind, zone.id, zone.version, mode, from.lon, from.lat, to.lon, to.lat, shapeVersion]`.
  `shapeVersion` est la version de zone qui a calculé la forme : la
  version gardée pour un tronçon gardé, `zone.version` pour un tronçon
  neuf. Pour un tronçon à la main : `null`. Raison : sans elle, une forme
  gardée de la v3 et une forme neuve de la v4 entre les mêmes points
  auraient la même clé, et l'une prendrait les infos de l'autre. Le moteur
  donne toujours la même forme pour la même version et les mêmes points :
  la clé reste juste.
- Effet : l'écran Infos d'un itinéraire gardé et sa création rouverte
  partagent les mêmes clés. Rouvrir ne recalcule rien.

**GPX importé** : `useTrackInfos(route, zone)`, un petit hook à côté de
`useLegInfos`.
- Le tracé entier compte comme **un seul tronçon calculé** : un `LegInfo`
  (`mode: 'path'`) passé à `summarizeInfo` et `summarizeDifficulty`, sans
  changer ces fonctions.
- Forme envoyée au moteur : `thinTrack(track, 14 000)`. Si le tracé a plus
  de 14 000 points, on garde un point quand il est à plus de
  `longueur / 14 000` du dernier gardé, plus le dernier point. Raison :
  Valhalla refuse `trace_attributes` au-delà de 16 000 points
  (`service_limits.trace.max_shape`, réglage par défaut). Une sortie de
  4 h 30 enregistrée chaque seconde en a 16 000. Le tracé gardé, lui, ne
  change pas.
- Clés : `['routing', 'height' | 'terrain', zone.id, zone.version, 'track', route.id]`.
  Un GPX ne change jamais de tracé, et son `id` n'est jamais réutilisé
  (§ 1).
- Valhalla refuse aussi au-delà de 200 km (`max_distance`) : le terrain est
  alors « indisponible » (ADR 0017, § 8). Rien de plus à coder.

**Les chiffres de la liste** (choix 6) : quand le bloc des altitudes est
« prêt », et que D+ ou D− diffère de la base, `updateFigures(id, ascentM, descentM, now)`
écrit `ascent_m`, `descent_m` et `figures_at`. `saved_at` ne change pas :
l'itinéraire ne bouge pas dans la liste (maquette 40). Un bloc
« manquant » n'efface pas les chiffres gardés : ils restent vrais pour le
tracé. Distance et durée ne changent pas : elles viennent du tracé gardé.

**Zone sans table de difficulté** : `useDifficultyTable` rend déjà une
table vide, donc « Difficulté inconnue… » (ADR 0018, § 2). Rien de neuf.

**Rapidité (C13, 40 km en moins de 1 s)** : décoder les formes (moins de
10 ms), puis environ 3 appels natifs par tronçon, moins de 50 ms en tout
pour 42 km (ADR 0017). La table de difficulté : quelques millisecondes. Le
testeur mesure en T7.

### 6. Zone de l'itinéraire, zone absente (C8), GPX hors zone (C12)

**Zone d'un GPX à l'import.** La zone en service devient sa zone si son
rectangle contient **le point de départ** (proposition du designer). Sinon,
pas de zone (`NULL`). Seule la zone en service compte : c'est la seule que
le moteur peut ouvrir.

**À chaque ouverture**, un GPX sans zone dont le départ est dans la zone en
service la prend (`attachZone`). Cas typique : on importe hors zone, on
télécharge la zone, on rouvre le GPX : il a ses infos.

**État de la zone** : `routeZoneStatus(route, zoneInService, installed)`,
logique pure, rend l'un de ces cas. Il sert à la liste et à l'écran Infos.

| Cas | Condition | Liste (maquette 40) | Écran Infos | « Modifier » |
|---|---|---|---|---|
| `usable` | `route.zoneId` = id de la zone en service, et tout le tracé est dans son rectangle (ou itinéraire créé) | « Zone Nancy · créé le … » | carte, chiffres, infos recalculées | oui (créé) |
| `leaves` | GPX : départ dans la zone, une partie du tracé en sort | « Zone Nancy · GPX importé le … » | carte (le tracé dépasse les tuiles) ; D+, terrain et difficulté indisponibles : « ce tracé sort de la zone Nancy » (texte : designer) | — |
| `outside` | GPX sans zone | « Hors de vos zones » | tracé seul sur fond uni (`RoutePreview`), distance et durée, carte « hors zone » avec « Voir les zones » | — |
| `deleted` | `route.zoneId` n'est plus parmi les zones prêtes | « Zone Nancy supprimée » | écran 7b : tracé seul, chiffres gardés datés, « Voir les zones » | caché |
| `notInService` | zone prête, mais une autre est en service | comme `deleted`, autre phrase | comme `deleted`, autre phrase | caché |

- Un itinéraire créé garde sa zone même si un tronçon à la main sort du
  rectangle : `infoShape` rend déjà ses altitudes manquantes (ADR 0017,
  § 5).
- **`leaves` n'appelle pas le moteur** : la règle de l'ADR 0017, § 5 est
  « hors de la zone, pas d'infos ». Un D+ partiel serait trompeur
  (réponse 1 d'Émilien du 28 octobre).
- Dans les cas sans calcul, la distance et la durée gardées s'affichent
  toujours (ADR 0017, § 8). On peut renommer, exporter (sans altitudes
  pour un itinéraire créé, § 8) et supprimer (C8).
- `notInService` n'arrive qu'avec deux zones installées. Aujourd'hui, la
  seule zone publiée est Nancy. Voir la question ouverte 3.

**Proposer la zone (C12, décision de design 11).** À l'import d'un GPX sans
zone, la feuille « GPX hors de vos zones » cherche une zone du catalogue
qui contient le départ (`zonesCovering`) :
1. catalogue déjà en mémoire (onglet Zones ouvert pendant cette session) :
   on l'utilise ;
2. sinon, un essai de lecture (`fetchQuery` avec la fonction existante) ;
3. sans réseau ou en échec : la variante « Sans réseau, RutaPulse ne peut
   pas chercher la zone de ce tracé » (§ 13, point 3).
Une zone trouvée : « Ce tracé est dans la zone Metz… » et le bouton
« Télécharger Metz · taille », qui lance le téléchargement puis ouvre
l'onglet Zones (maquette 40). Aucune zone : « Ce tracé n'est dans aucune
zone de RutaPulse pour l'instant. »

### 7. Règles de l'import (C10, C13)

**Étapes**, dans `features/routes/importGpx.ts` :
1. `getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false })`.
   Annulé : rien. **Pas de filtre sur le type MIME ni sur l'extension** :
   le sélecteur dit `application/octet-stream`, et un fichier qui n'est
   pas un GPX sera « illisible » à l'étape 4.
2. **Taille, avant toute lecture** : `asset.size`, sinon `new File(uri).size`
   (fichier déjà présent, pas juste écrit). Plus de **20 000 000 octets**
   (20 Mo comme les affiche l'app Fichiers) : refus « trop gros », le
   fichier n'est pas lu. Taille 0 : refus « vide ».
3. `File.text()` (lecture en UTF-8, codage des caractères standard). Échec
   de lecture : « illisible ». Contrôle de secours : plus de 20 000 000
   caractères lus, refus « trop gros ».
4. `readGpx(text)` (`core/gpx/`, logique pure).
5. `buildImportedRoute(gpx, fileName, zoneInService, now)` (`core/routes/`) :
   nom, polyligne, altitudes, distance, durée, aperçu, zone.
6. `insertRoute`, invalidation de la liste, puis l'écran Infos du GPX
   (maquette 40 ; à confirmer par Émilien, question 5 du designer). S'il
   est hors zone, la feuille « GPX hors de vos zones » d'abord (§ 6).
7. La copie du fichier dans le cache est effacée, en réussite comme en
   échec.

**Ce que `readGpx` accepte** :
- une trace : tous les `trkpt` de tous les `trkseg` de tous les `trk`,
  **dans l'ordre du fichier**, collés bout à bout. Le saut entre deux
  segments devient une ligne droite, comptée dans la distance. Raison :
  le tracé gardé est une seule ligne ; un segment coupé est en général une
  perte du signal GPS pendant la sortie ;
- sinon une route : tous les `rtept` de tous les `rte`, dans l'ordre. Les
  points sont reliés en ligne droite, sans calcul ;
- un fichier avec `trk` **et** `rte` : la trace seule ;
- GPX 1.0 et 1.1. Les noms d'éléments se comparent sans leur préfixe
  d'espace de noms (`gpx:trkpt` = `trkpt`) ;
- `wpt`, `extensions`, `time` et tout élément inconnu sont ignorés.

**Un point** : attributs `lat` et `lon` décimaux
(`^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$`, sans exposant, comme `xsd:decimal`),
latitude entre −90 et 90, longitude entre −180 et 180. Un point faux est
sauté. `ele` décimal entre −1 000 et 10 000 m, sinon `null`. La regex
(expression régulière) est écrite sans ambiguïté, pour rester en temps
linéaire : la première forme, `(\d+\.?\d*|…)`, figeait l'app sur un
nombre piégé d'un million de chiffres (relecture de T2).
Coordonnées arrondies à 6 décimales (la précision gardée, § 1) ; deux
points de suite identiques après arrondi n'en font qu'un.

**Le nom** : `metadata/name` (1.1) ou `gpx/name` (1.0), sinon le premier
`trk/name`, sinon le premier `rte/name`, sinon le nom du fichier sans
`.gpx`. Espaces normalisés, coupé à 60 caractères (§ 11). Vide :
« Itinéraire du 3 nov. » (§ 13, point 6).

**Refus**, chacun avec sa phrase française (textes du designer, écran 6a) :

| Refus | Quand |
|---|---|
| `tooBig` | plus de 20 000 000 octets (étape 2 ou 3) |
| `empty` | 0 octet, ou rien d'autre que des espaces |
| `unreadable` | pas lisible en texte ; pas de balise racine `gpx` ; balises mal fermées ou mal imbriquées ; **un `<!DOCTYPE` ou un `<!ENTITY`** n'importe où |
| `noTrack` | moins de 2 points valables, en trace comme en route |

**Sécurité** :
- **jamais d'appel réseau** : `core/gpx/` ne peut importer ni `expo-*` ni
  `fetch` (règle ESLint de `core/`) ; le lecteur ne suit aucune adresse ;
- **jamais d'entité externe XML** (XXE, XML External Entity : une
  référence dans le fichier qui ferait lire une adresse ou un autre
  fichier) : toute déclaration de type de document (`DOCTYPE`) est
  refusée. Aucune entité ne peut donc être déclarée, ni externe, ni en
  cascade (l'attaque « milliard de rires »). Seules les 5 entités
  prédéfinies (`&amp;` `&lt;` `&gt;` `&quot;` `&apos;`) et les références
  numériques (`&#233;`, `&#xE9;`) sont décodées. Une autre `&nom;` reste
  écrite telle quelle ;
- un test prouve qu'un GPX avec `<!DOCTYPE … SYSTEM "http://…">` est
  refusé et que `fetch` (imité) n'est jamais appelé.

**Limites** : pas de nombre maximal de points, pas de simplification du
tracé gardé. La limite de 20 Mo borne le fichier à environ 150 000 points.
Seule la forme envoyée au moteur est éclaircie (§ 5).

**Distance et durée d'un GPX** :
- distance : `trackLengthM(track)`, la somme des distances entre points,
  **sur la sphère de Valhalla** (rayon 6 378 160 m, `kRadEarthMeters`).
  Raison : la distance d'un itinéraire créé vient du moteur ; sur ce rayon,
  son export réimporté donne la même distance (C11). Avec le rayon de
  `distanceMeters` (6 371 009 m), l'écart serait de 0,11 %, soit 45 m sur
  40 km ;
- durée : la distance à 10 km/h (`HAND_SPEED_KMH`), la règle d'un tracé
  sans calcul (ADR 0016, § 1), dans la zone comme hors zone (§ 13,
  point 5). Les heures du fichier ne servent pas : elles décrivent une
  sortie passée.

**Rapidité (C13, 10 000 points en moins de 3 s)** : environ 1,5 Mo de
texte. Lecture native du fichier, puis un seul passage du lecteur (§ 9),
encodage, aperçu, une insertion. Attendu : moins de 1 s sur les
simulateurs. Le contrôle 4 le mesure avant T6.

### 8. Export GPX (C9)

**Contenu exact** (GPX 1.1, ordre du schéma officiel) :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RutaPulse" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Boucle du Bois de la Côte</name>
  </metadata>
  <trk>
    <name>Boucle du Bois de la Côte</name>
    <trkseg>
      <trkpt lat="48.692100" lon="6.184400"><ele>212</ele></trkpt>
      <trkpt lat="48.692350" lon="6.184912"/>
    </trkseg>
  </trk>
</gpx>
```

- Un seul `trk`, un seul `trkseg`. Pas de `wpt`, pas de `time`, pas
  d'`extensions` : le fichier ne dépend que de l'itinéraire, donc les tests
  comparent un texte exact.
- `lat` et `lon` à 6 décimales (`toFixed(6)`). Une longitude de 180
  s'écrit −180 : le schéma veut −180 ≤ lon < 180.
- `<ele>` seulement quand l'altitude du point est connue, et entre
  −1 000 et 10 000 m. Un nombre fini, écrit sans exposant (un entier pour le modèle numérique, au dixième pour
  un GPX).
- Encodage UTF-8, sans BOM (marque d'ordre des octets au début du
  fichier). Fins de ligne `\n`.
- **Échappement** du nom : `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`,
  `"` → `&quot;`, `'` → `&apos;`. Les caractères interdits en XML 1.0
  (caractères de contrôle sauf tabulation et retours de ligne, U+FFFE,
  U+FFFF, moitiés de paires UTF-16 seules) sont retirés.

**Le tracé exporté** :
- GPX importé : `track` tel quel, et `elevations` du fichier.
- Itinéraire créé : `trackOfCreated(draft, legs)`. La suite des formes des
  tronçons calculés et des points des tronçons à la main. Là où un tronçon
  à la main touche un tronçon calculé, le tracé passe par le bout de la
  forme calculée (le point recalé), pas par le point posé. Ainsi **le trait
  de liaison n'est jamais dans le GPX** (choix 5), et le tracé reste
  continu. Deux points de suite identiques n'en font qu'un.
- Altitudes d'un itinéraire créé : si sa zone est utilisable (§ 6),
  `computePointHeights(track)`, une requête `height` **sans**
  `resample_distance` ni `range` : Valhalla rend une altitude par point
  (`height`, `null` sans donnée). Une seule demande dans la file du moteur.
  Zone absente, ou échec : pas d'`<ele>`. Raison : le profil des infos est
  rééchantillonné tous les 30 m et ne donne pas l'altitude de chaque point.

**Nom du fichier** : `gpxFileName(name)` : `/ \ : * ? " < > |` et les
caractères de contrôle remplacés par `-`, espaces normalisés, accents
gardés, puis `.gpx`. Vide : `itineraire.gpx`.

**Écriture et partage** (`shared-data/routes/exportRoute.ts`) :
1. vider puis recréer le dossier `Paths.cache/export/` (un seul fichier
   exporté à la fois ; le système peut vider le cache) ;
2. écrire le texte (`File.write`). **Ne pas relire `File.size`** : elle
   vaut 0 juste après l'écriture (essai T1) ;
3. `Sharing.shareAsync(uri, { mimeType: 'application/gpx+xml', UTI: 'com.topografix.gpx', dialogTitle: name })`.
   Échec d'écriture : « Export impossible » (designer).

**Validation (C9)** :
- Jest : sur un itinéraire d'exemple, `writeGpx` donne un texte égal à un
  fichier de référence `core/gpx/fixtures/export-reference.gpx`. Ce fichier
  a été validé une fois par `xmllint --noout --schema gpx.xsd` (référence
  externe, ADR 0011, § 5). Plus un test d'échappement (`&`, `<`, `"`,
  emoji, caractère de contrôle).
- T7 : les fichiers sortis des deux simulateurs passent
  `xmllint --noout --schema gpx.xsd`. Le schéma vient de
  `https://www.topografix.com/GPX/1/1/gpx.xsd` ; sa copie et son empreinte
  SHA-256 vont avec les preuves.

**Aller-retour (C11)** : un test Jest exporte puis réimporte. Les points
sont identiques (écart 0, permis 1 m). Les distances doivent différer de
moins de 10 m (voir la question ouverte 1).

### 9. Lecteur XML : analyseur maison restreint

**Décision** : pas de bibliothèque. Un petit lecteur dans
`core/gpx/xmlScan.ts`, environ 150 lignes, qui ne lit que ce dont un GPX a
besoin. L'écriture est aussi maison (un modèle de texte et l'échappement).

Ce qu'il fait, en un seul passage :
- avance de `<` en `<` avec `indexOf` (recherche native, rapide dans
  Hermes, le moteur JavaScript de React Native) ;
- saute `<?…?>`, `<!--…-->` ; lit `<![CDATA[…]]>` (bloc de texte brut)
  comme du texte ; **refuse `<!DOCTYPE` et `<!ENTITY`** ;
- lit les balises ouvrantes, fermantes et vides, et leurs attributs entre
  `"` ou `'` (une expression régulière, regex, par balise) ;
- tient une pile des balises ouvertes : une balise fermante qui ne
  correspond pas, une balise restée ouverte à la fin, ou plus de 64
  niveaux d'imbrication (`MAX_DEPTH`), rend le fichier « illisible » ;
- ne garde le texte que des éléments utiles (`name`, `ele`) ;
- `readGpx` est construit au-dessus, sans arbre en mémoire.

**Comparaison** (relevé du 3 novembre 2026 sur le registre npm) :

| | fast-xml-parser 5.12.0 | sax 1.6.1 | Maison (choisi) |
|---|---|---|---|
| Taille | 1,34 Mo décompressé, 6 dépendances | 62 Ko, aucune dépendance | environ 150 lignes |
| Maintenance | très active : 5.12.0 publiée le 3 nov. 2026 | active : 1.6.1 du 24 juillet 2026 | la nôtre |
| Licence | MIT | BlueOak-1.0.0 (permissive) | — |
| Entités XML | lit les entités du `DOCTYPE` : **4 avis de sécurité en 2026** sur ce point (CVE-2026-25896, -26278, -33036, -73569) ; il faut des réglages pour s'en protéger | n'interprète pas les déclarations d'entités, ne lit rien d'externe | `DOCTYPE` refusé : aucune entité possible |
| React Native | JavaScript pur | `require('stream')` dans un `try`, à faire accepter par Metro (l'outil qui assemble le code) ; utilise `Buffer` | rien à régler |
| Vitesse sur Hermes | non mesurée ; construit un objet pour tout le fichier | non mesurée ; lit caractère par caractère en JavaScript, lent sans compilation à la volée (JIT) | non mesurée ; recherches natives (`indexOf`, regex) : attendu le plus rapide |

**Pourquoi maison** : le besoin est petit (trois éléments, deux
attributs). Les cas piégés de C10 se testent de toute façon, quelle que
soit la bibliothèque. Refuser le `DOCTYPE` rend l'attaque XXE impossible
par construction, au lieu de dépendre d'un réglage. Aucune dépendance à
suivre.

**Le risque** : un lecteur maison peut mal lire une forme rare de XML. La
parade est dans les tests : les fichiers d'exemple du testeur (plusieurs
segments, route seule, sans altitude, extensions, préfixes d'espace de
noms, CDATA, commentaires, guillemets simples, BOM) et des fichiers réels
d'autres applications. **Repli** : si le lecteur s'avère fragile,
`readGpx` passe sur `sax` 1.6.1, même signature, un seul fichier change.

### 10. Clés de Query et invalidation

| Clé | Contenu | Réglages |
|---|---|---|
| `['routes', 'list']` | les lignes de la liste (§ 1) | `staleTime: Infinity`, `networkMode: 'always'`, `retry: false` |
| `['routes', 'detail', id]` | un itinéraire entier, lu par `rowToRoute` | mêmes réglages |
| `['routes', 'countByZone', zoneId]` | nombre d'itinéraires d'une zone (§ 13, point 8) | mêmes réglages |
| `['routing', …]` | calculs (§ 5) | ceux de l'ADR 0016, § 3 |

`staleTime: Infinity` : seule l'app écrit dans la base, et chaque écriture
invalide ce qu'elle change.

| Action | Après l'écriture |
|---|---|
| Enregistrer (nouveau), importer | invalider `['routes']` (liste et comptes) |
| Enregistrer (remplacer) | invalider `['routes']` (liste, détail, comptes) |
| Renommer | invalider `['routes', 'list']` et `['routes', 'detail', id]` |
| Supprimer | `removeQueries(['routes', 'detail', id])`, puis invalider `['routes']` |
| Chiffres mis à jour à l'ouverture | invalider `['routes', 'list']` seulement : l'écran Infos a déjà ses chiffres, il ne relit pas |
| Zone rattachée à l'ouverture | invalider `['routes']` |

Les écritures passent par `useRouteActions()` (`shared-data/routes/`).
Renommer et supprimer mettent la liste à jour aussitôt (C5) : relire 50
lignes légères prend quelques millisecondes.

### 11. Le nom (C4)

- **C4 : la date seule en v1**, la commune en V2 (essai T1 : 68 % de bonnes
  communes). Pour la V2 : une petite table des communes, avec contours,
  dans le paquet de zone (osmium, `admin_level=8`).
- Nom par défaut : « Itinéraire du 3 nov. », date locale du jour de
  l'enregistrement, mois abrégés de `fr.ts`, sans l'année. Il ne change
  plus ensuite, même après « Modifier ».
- Règles (`core/routes/routeName.ts`) : espaces de début et de fin
  retirés ; suites d'espaces et retours à la ligne remplacées par une
  espace ; caractères de contrôle retirés. Valide si non vide et de 60
  caractères au plus, **comptés en caractères affichés** (points de code
  Unicode, `[...nom].length`), pas en unités UTF-16 : un emoji compte 1.
- Pas de règle d'unicité pour un nom choisi : deux itinéraires peuvent
  porter le même nom.

### 12. Le correctif `expo-modules-core` et `app.json`

- **Monter `expo-modules-core` dans le fichier de verrou seulement** :
  `npm update expo-modules-core` (au début de T3). `expo` 58.0.16 demande
  `~58.0.23`, ce qui permet 58.0.29 : `package.json` ne change pas.
- **Ne pas l'ajouter en dépendance directe** : `expo-doctor` signale ce
  paquet comme « à ne pas installer directement ». Le module local
  `modules/valhalla-route` le reçoit par `expo`.
- **Preuve en T3** : `npm ls expo-modules-core` montre une seule copie, en
  58.0.29 ou plus ; build release Android lancé sans plantage, avec R8
  (l'outil qui réduit le code Android) ; même chose sur iOS.
- Ne pas toucher aux autres paquets que `npx expo install --check` signale
  (expo-router, react-native 0.88.1…) : hors du sujet de cette phase.
- **`app.json`** :
  - garder `"expo-sqlite"` dans `plugins`, sans option (ajouté par
    `expo install`, nécessaire avec la génération des dossiers natifs) ;
  - **ne pas garder `"expo-sharing"`** : son plugin sert à **recevoir** des
    fichiers (extension de partage), hors périmètre de cette phase. Envoyer
    un fichier n'en a pas besoin d'après la doc. Le contrôle 5 l'éprouve ;
  - `expo-document-picker` n'a pas besoin de plugin (seulement pour
    iCloud).
- Aucune permission ajoutée, ni à Android ni à iOS (essai T1).

### 13. Les 8 points du designer (maquette 40 complétée)

1. **D− gardé** avec la distance, le D+ et la durée : colonne `descent_m`
   (§ 1). La case D− de l'écran 7b montre le chiffre gardé, « — » s'il n'a
   jamais été connu. Coût : une colonne.
2. **GPX à cheval sur deux zones** : sa zone est la zone en service si elle
   contient le départ (proposition retenue). Ce qui sort de la zone suit
   l'ADR 0017 : pas d'infos partielles, cas `leaves` du § 6.
3. **Catalogue sans réseau** : non, il ne suffit pas toujours. Le
   catalogue n'est gardé qu'en mémoire : après un redémarrage de l'app
   sans réseau, il n'existe pas. On l'utilise s'il est en mémoire, sinon on
   essaie de le lire, sinon la **variante B** (« Sans réseau, RutaPulse ne
   peut pas chercher la zone »). Garder le catalogue sur le disque n'est
   pas justifié pour ce seul message.
4. **Menu « ⋮ » et appui long** : **pas de module nouveau**.
   `ui/openActionMenu.ts` ouvre :
   - sur iOS, `ActionSheetIOS.showActionSheetWithOptions` (feuille
     d'actions native, fournie par React Native) : « Renommer »,
     « Exporter en GPX », « Supprimer » en rouge, « Annuler » ;
   - sur Android, `Alert.alert` avec exactement 3 boutons (le maximum
     d'Android) et `cancelable: true` : on annule en touchant hors de la
     boîte ou par le retour.
   L'appui long sur la ligne (`onLongPress` de `Pressable`) ouvre le même
   menu. Ce sont les boîtes natives que l'app utilise déjà (zones,
   abandon). **Pas d'essai jetable** : aucune API nouvelle de plateforme.
   Le designer juge le rendu sur les captures de T8. Si la boîte Android ne
   convient pas, l'alternative est `@expo/ui` ~58.0.26 (menus natifs
   SwiftUI et Jetpack Compose, publiés par Expo pour le SDK 58), qui
   demanderait alors un essai jetable (voir Alternatives).
5. **Durée d'un GPX** : 10 km/h, comme un tracé à la main (ADR 0016). La
   même règle dans la zone et hors zone : la durée ne change pas quand on
   télécharge la zone.
6. **Deuxième itinéraire du même jour** : « Itinéraire du 3 nov. (2) »,
   puis « (3) »… `uniqueDefaultName(base, noms existants)` prend le plus
   petit numéro libre, à partir de 2. Seulement pour le nom par défaut ;
   les noms lus dans un GPX ne sont pas numérotés.
7. **Renommer ne change pas l'ordre** : la liste est triée sur `saved_at`
   (dernier « Enregistrer » ou import), que renommer ne touche pas.
   C'est une lecture du choix 3 du pilotage (« dernière modification ») :
   la modification du tracé, pas du nom. À confirmer par Émilien (question
   1 du designer).
8. **Prévenir à la suppression d'une zone** : oui, possible.
   `countRoutesByZone(zoneId)` : `SELECT COUNT(*) FROM routes WHERE zone_id = ?`.
   L'écran Zones le lit par `useRouteCountByZone` (`shared-data/routes/`)
   et ajoute la phrase du designer quand le compte n'est pas nul.

## Alternatives rejetées

**La base**
- **Une table des points et une table des tronçons** : forme « propre »,
  mais des jointures et des centaines d'insertions pour un itinéraire
  toujours lu en entier.
- **Garder aussi `track` pour un itinéraire créé** : une copie des formes
  des tronçons, qui pourrait diverger. `trackOfCreated` la refait en
  quelques millisecondes quand il le faut (export, aperçu).
- **Tracé en JSON** : 3 à 5 fois plus gros. **En binaire** (`BLOB` de
  nombres) : plus petit encore, mais illisible à l'œil et sans fonction
  existante. La polyligne a déjà ses fonctions testées.
- **Une colonne de date de modification changée par « Renommer »** : la
  ligne sauterait sous le doigt (designer).
- **Migrer en une seule transaction pour toutes les versions** : une
  coupure au milieu d'une longue suite referait tout. Une transaction par
  version laisse toujours une base à une version connue.
- **Ouvrir quand même une base trop récente** : les colonnes ont pu changer
  de sens ; écrire pourrait l'abîmer pour la version récente.
- **TanStack DB** : déjà écarté par l'ADR 0007.
- **Tests de la base avec une imitation d'`expo-sqlite`** : ils ne
  testeraient pas le SQL. `node:sqlite` exécute le vrai SQL dans Jest.

**« Modifier » et les infos**
- **Mettre les formes gardées dans le cache de Query sous la clé d'un
  tronçon neuf** : une forme de la v3 serait servie comme un calcul de la
  v4 (mélange interdit par l'ADR 0018, § 3).
- **Tout recalculer à la réouverture** : le tracé changerait tout seul,
  contraire à C7 et à l'ADR 0018, décision 5.
- **Infos figées à l'enregistrement** : la difficulté resterait inconnue
  pour les itinéraires faits avant la v4 (ADR 0018, question 1).
- **Écran Infos d'un itinéraire gardé dans la session de création** : un
  GPX ou un itinéraire sans zone ne peut pas ouvrir de création.
- **Déplacer la carte et les infos dans `ui/` et `shared-data/`** pour un
  écran dans `features/routes/` : gros déplacement sans besoin. L'adresse
  `/route/[id]` suffit pour aller de la liste aux infos.
- **D+ partiel pour un GPX qui sort de la zone** : chiffre trompeur
  (réponse d'Émilien du 28 octobre).
- **Durée d'un GPX à 16 km/h** (vitesse par défaut du VTT dans Valhalla) :
  plus proche du moteur sur le plat. Mais une règle de plus, différente de
  celle du tracé à la main déjà affichée dans l'app.

**Le GPX**
- **fast-xml-parser** et **sax** : voir le tableau du § 9.
- **@xmldom/xmldom 0.9.12** (lecteur DOM, MIT) : construit un arbre complet
  du document, lent et gourmand pour 150 000 points. Sert surtout avec
  `@tmcw/togeojson`, qui attend un DOM de navigateur.
- **Accepter un `DOCTYPE` en ignorant ses entités** : plus tolérant, mais
  la sécurité dépendrait d'un code de plus. Un GPX n'en a pas besoin.
- **Exporter un `trkseg` par tronçon** : le trait de liaison serait hors du
  tracé, mais un GPX en morceaux, et la distance réimportée dépendrait de
  la règle des segments.
- **Exporter les altitudes du profil (tous les 30 m)** : il faudrait
  interpoler sur chaque point, avec des distances calculées sur un autre
  rayon que Valhalla.
- **Simplifier le tracé gardé à l'import** : le tracé importé changerait,
  sans besoin mesuré.
- **Un plafond de points en plus des 20 Mo** : un refus de plus, que la
  spec ne prévoit pas (question ouverte 4).

**Le menu**
- **`@react-native-menu/menu` 2.0.0** (menus natifs, MIT) : dernière
  version le 10 septembre 2025, dépendance de plus, à éprouver.
- **`@expo/ui` ~58.0.26** : de vrais menus natifs, mais deux composants
  différents (SwiftUI sur iOS, Compose sur Android), un module natif de
  plus et un essai jetable. Gardé en réserve (§ 13, point 4).
- **Balayage pour supprimer** : retiré par le designer (gants, Android).

**Le plugin `expo-sharing`** : le garder « au cas où » ajoute une
extension de partage iOS que rien n'utilise.

## Conséquences

- Positif : une table, une migration, aucune bibliothèque XML. La logique
  (SQL, migrations, GPX, tracé, nom, état de la zone) est dans `core/`,
  testée sans téléphone, avec le vrai SQLite.
- Positif : l'écran Infos d'un itinéraire gardé réutilise `useLegInfos`,
  `summarizeInfo` et `summarizeDifficulty` sans les copier.
- Positif : un GPX importé hors zone gagne ses infos dès que sa zone est
  téléchargée, sans geste de plus.
- Négatif : la clé de Query des infos d'un tronçon change (une case de
  plus, `shapeVersion`) : les tests de `useLegInfos` qui écrivent la clé
  sont à adapter. Le développeur les liste (méthode de la phase 4).
- Négatif : `useCatalogue` change de dossier (`features/zones/` vers
  `shared-data/zones/`) : les imports de l'écran Zones changent.
- Négatif : un lecteur XML à nous, à maintenir. Le repli sur `sax` est
  prévu.
- Négatif : un itinéraire peut mêler des tronçons de deux versions de zone.
  C'est le sens de C7, mais il faut le savoir en lisant la base.
- Négatif : sur Android, le menu « ⋮ » est une boîte à 3 boutons, pas un
  menu déroulant, et « Supprimer » n'y est pas en rouge (le style
  `destructive` n'existe que sur iOS). La confirmation qui suit le dit
  clairement.
- À l'acceptation : l'ADR 0007 reçoit « schéma, clés et invalidations des
  itinéraires : ADR 0019 » ; l'ADR 0017 reçoit « clé des infos avec
  `shapeVersion` : ADR 0019 ».

## Contrôles avant de bâtir dessus

1. **Début de T3, Jest et `node:sqlite`** (quelques minutes) : un test qui
   ouvre `new DatabaseSync(':memory:')` dans la configuration Jest du
   projet (`jest-expo`), en local et dans la CI. Parade si `jest-expo`
   refuse le module : commentaire `@jest-environment node` en tête des
   tests de la base ; sinon `sql.js` (SQLite compilé en WebAssembly) en
   dépendance de développement.
2. **Début de T3, sur les deux simulateurs** : `SELECT sqlite_version()`
   dans `expo-sqlite` donne 3.37 ou plus, et la table `STRICT` se crée.
   Parade : retirer `STRICT`, garder les `CHECK`.
3. **T3** : montée d'`expo-modules-core` et build release Android (§ 12).
4. **Avant T6, en release, sur les deux simulateurs** (contrôle court) :
   `readGpx` sur un GPX de 10 000 points (avec altitudes, heures et
   extensions), puis sur un fichier de 20 Mo. Attendu : moins de 1 s pour
   10 000 points, pas de plantage pour 20 Mo. Si 10 000 points dépassent
   2 s : chemin rapide par regex pour `trkpt`, ou repli sur `sax`.
5. **T6** : la feuille de partage s'ouvre **sans** le plugin
   `expo-sharing`, en release, sur les deux simulateurs. Sinon, remettre
   la ligne, sans option.
6. **T4 ou T6, en release** : `trace_attributes` en `walk_or_snap` sur un
   vrai GPX enregistré (environ 10 000 points, un point par seconde),
   éclairci à 14 000 points au plus. Noter le temps et le résultat (terrain
   prêt ou indisponible). Rien n'est promis par C13 pour un GPX, mais un
   temps de plusieurs secondes serait à signaler au pilotage.
7. **T2, sur les réponses réelles gardées (R1 à R5)** : écart entre la
   distance du moteur et `trackLengthM` de la forme. Attendu : moins de
   10 m sur 40 km (question ouverte 1).

## Questions ouvertes

1. **C11, « la même distance, à 10 m près ».** La distance d'un itinéraire
   créé vient du moteur, sur sa sphère (rayon 6 378 160 m). Celle d'un GPX
   se mesure sur le tracé. Avec le rayon de `distanceMeters`, l'écart
   serait de 45 m sur 40 km. **Décision prise** : `trackLengthM` utilise le
   rayon de Valhalla. Il reste de petits écarts : arrondi des points,
   tronçons à la main mesurés sur l'autre rayon (0,11 % de leur longueur),
   passage par le point recalé (§ 8). **Recommandation** : garder C11 tel
   quel ; si le contrôle 7 montre plus de 10 m, comparer dans C11 la
   longueur du tracé avant et après l'aller-retour, ce qui teste vraiment
   l'export et l'import.
2. **Durée d'un GPX** : 10 km/h donne 4 h 13 pour 42 km, quand le moteur
   en aurait donné environ 2 h 40 (la maquette montre 2 h 40). Un même
   tracé exporté puis réimporté change donc de durée.
   **Recommandation** : 10 km/h en v1, comme le propose le designer (une
   seule règle pour un tracé sans calcul). Autre choix : 16 km/h, la
   vitesse par défaut du VTT dans Valhalla. À trancher par Émilien.
3. **Deux zones installées.** Un itinéraire d'une zone prête mais pas en
   service n'a pas d'infos, et l'app n'a pas de geste pour choisir la zone
   en service. **Recommandation** : l'accepter en v1 (une seule zone
   publiée), avec le cas `notInService` et sa phrase. Le revoir quand une
   deuxième zone sera publiée.
4. **Pas de plafond de points.** Un fichier de 20 Mo fait environ
   150 000 points. **Recommandation** : pas de refus de plus (la spec n'en
   prévoit pas) ; le contrôle 4 vérifie qu'un tel fichier ne plante pas.
   S'il plante, ajouter un refus « trop de points » à la spec.
5. **`DOCTYPE` refusé.** Un GPX rare qui en contient un sera « illisible ».
   **Recommandation** : l'accepter ; la sécurité vaut plus que ce cas
   jamais vu dans les fichiers GPX courants.
6. **Ordre de la liste** (§ 13, point 7) : le choix 3 dit « dernière
   modification ». **Recommandation** : comprendre « dernier enregistrement
   ou import », comme le designer.

## Réponses d'Émilien (3 novembre 2026)

ADR, maquette 40 et recommandations acceptés. Chaque réponse suit la
recommandation.

1. Renommer ne fait pas remonter l'itinéraire. Seuls « Enregistrer » et
   l'import changent l'ordre de la liste (question ouverte 6).
2. Deux itinéraires le même jour : « Itinéraire du 3 nov. (2) ».
3. Supprimer une zone utilisée prévient : « 2 itinéraires utilisent cette
   zone. Ils resteront, sans carte ni terrain. »
4. Pas de balayage : menu « ⋮ » et appui long, sur les deux plateformes.
5. Après un import réussi, l'écran Infos du GPX s'ouvre.
6. Durée d'un GPX importé : 10 km/h en v1 (question ouverte 2).
7. Un GPX avec un `DOCTYPE` est refusé comme illisible (question ouverte 5).
8. Un itinéraire d'une zone prête mais pas en service n'a pas d'infos en
   v1. À revoir quand une 2e zone sera publiée (question ouverte 3).
9. C11 : on compare la longueur du tracé avant et après l'aller-retour
   seulement si le contrôle montre un écart dû au moteur, preuve à
   l'appui (question ouverte 1).

## Sources (relevées le 3 novembre 2026)

- Essai T1 : `/Users/utilisateur/dev_ai/vtt-nav-preuves/p06/t1-essai/LISEZMOI.md`
  (hors dépôt) ; branche jetable `claude/p06-essai`, commit `5be81bc`.
- Maquette 40 complétée et sa note : `design/v1/40-mes-itineraires.html`.
- Code lu sur la branche de phase (`e2bad33`) : `mobile/src/core/draft/`,
  `core/routing/`, `core/route-info/`, `core/zones/`, `shared-data/`,
  `features/map/` (`DraftSession.tsx`, `RouteInfoScreen.tsx`,
  `useLegResults.ts`, `useLegInfos.ts`, `useDifficultyTable.ts`),
  `features/routes/`, `features/zones/`, `app/`, `package.json`,
  `app.json`.
- `expo-sqlite` (transactions, `user_version`, plugin) :
  https://docs.expo.dev/versions/latest/sdk/sqlite/
- `expo-document-picker` (options, `size` facultative, copie dans le cache) :
  https://docs.expo.dev/versions/latest/sdk/document-picker/
- `expo-sharing` (`shareAsync`, plugin pour recevoir) :
  https://docs.expo.dev/versions/latest/sdk/sharing/
- `@expo/ui` (SDK 58, ~58.0.26) : https://docs.expo.dev/versions/latest/sdk/ui/
- `expo` 58.0.16 dépend de `expo-modules-core` `~58.0.23` :
  https://registry.npmjs.org/expo/58.0.16 ; `expo-modules-core` 58.0.29
  (MIT) : https://registry.npmjs.org/expo-modules-core/58.0.29
- Node 24, `node:sqlite` (« Release candidate » depuis 24.15.0, sans
  option depuis 22.13.0) : https://nodejs.org/docs/latest-v24.x/api/sqlite.html
- fast-xml-parser 5.12.0 (MIT, 3 nov. 2026, 1,34 Mo, 6 dépendances) :
  https://registry.npmjs.org/fast-xml-parser/latest
- Avis de sécurité de fast-xml-parser en 2026 :
  https://osv.dev/vulnerability/GHSA-m7jm-9gc2-mpf2 (CVE-2026-25896),
  https://advisories.gitlab.com/npm/fast-xml-parser/CVE-2026-26278/,
  https://corgea.com/advisories/vulnerabilities/CVE-2026-33036,
  https://advisories.gitlab.com/npm/fast-xml-parser/GHSA-8r6m-32jq-jx6q/ (CVE-2026-73569)
- sax 1.6.1 (BlueOak-1.0.0, 24 juill. 2026, 62 Ko) :
  https://registry.npmjs.org/sax/latest ; code (entités, `require('stream')`) :
  https://github.com/isaacs/sax-js/blob/main/lib/sax.js
- @xmldom/xmldom 0.9.12 (MIT, 21 août 2026) :
  https://registry.npmjs.org/@xmldom/xmldom/latest
- @react-native-menu/menu 2.0.0 (MIT, 10 sept. 2025) :
  https://registry.npmjs.org/-/v1/search?text=%40react-native-menu%2Fmenu&size=2
- Schéma GPX 1.1 (espace de noms, `version` et `creator` obligatoires,
  ordre des éléments, bornes de latitude et longitude) :
  https://www.topografix.com/GPX/1/1/gpx.xsd
- Valhalla, rayon de la Terre (`kRadEarthMeters = 6378160.187`) :
  https://github.com/valhalla/valhalla/blob/master/valhalla/midgard/constants.h
- Valhalla, limites par défaut (`trace.max_shape` 16 000,
  `trace.max_distance` 200 000 m, `skadi.max_shape` 750 000) :
  https://github.com/valhalla/valhalla/blob/master/scripts/valhalla_build_config
- Valhalla, `height` sans rééchantillonnage (une altitude par point) :
  https://valhalla.github.io/valhalla/api/elevation/
- Valhalla, vitesse par défaut du VTT (16 km/h) :
  https://valhalla.github.io/valhalla/api/route/api-reference/
- React Native, `ActionSheetIOS` : https://reactnative.dev/docs/actionsheetios ;
  `Alert` (3 boutons au plus sur Android) : https://reactnative.dev/docs/alert
