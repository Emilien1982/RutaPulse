# ADR 0018 — Difficulté VTT et mise à jour des zones

- Statut : Proposé le 2026-11-02, à valider par Émilien
- Date : 2026-11-02 (phase 5b, tâche T1 de [p05b-difficulte-maj-zones](../phases/p05b-difficulte-maj-zones.md))
- Complète l'[ADR 0003](0003-paquets-de-zone.md) (un fichier de plus dans
  le paquet), l'[ADR 0013](0013-telechargement-zones.md) (mise à jour d'une
  zone, zone en service) et l'[ADR 0017](0017-infos-itineraire-calcul.md)
  (calcul de la difficulté). Précise l'[ADR 0005](0005-infos-itineraire.md)
  (pas de `sac_scale`) et l'[ADR 0015](0015-module-natif-calcul.md)
  (`setZone`). Suit les ADR 0011 et 0014 sans les changer.

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

### La spec et l'essai

- La spec validée fait foi : critères C1 à C15, choix 1 à 4 du pilotage,
  question 1 tranchée (garder les 2 dernières releases, ou versions
  publiées, de chaque zone sur GitHub).
- **Essai jetable T1** (C1 prouvé, voir Sources), en version finale
  (release), zone Nancy v3, Android en mode avion :
  - `trace_attributes` (fonction de Valhalla qui détaille les voies
    traversées) renvoie `edge.way_id`, l'identifiant de la voie OSM
    (OpenStreetMap, la carte libre), sans code natif nouveau ;
  - 1 564 arêtes sur 9 tronçons, toutes avec un `way_id` non nul ; les
    889 voies distinctes existent dans l'extrait OSM ; géométrie à 0,1 m
    près ;
  - listes `(way_id, length, use)` identiques sur iOS, Android et le Mac ;
  - coût non mesurable : 24 à 41 ms pour 42 km, avec ou sans `way_id` ;
  - une voie OSM est souvent coupée en plusieurs arêtes ;
  - 504 voies `mtb:scale` (difficulté VTT notée dans OSM) dans la zone ;
  - un `way_id` à 0 ou absent n'a jamais été vu.

### Ce que fait le code aujourd'hui (lu le 2 novembre 2026, commit 48bff9e)

- `downloadZone` efface les autres versions de la zone juste après avoir
  écrit `.ready.json` (`core/zones/downloadZone.ts`, l. 246 à 249 ; étape 4
  de l'ADR 0013, § 3). Pour une mise à jour, la v3 serait effacée pendant
  que le moteur et la carte la lisent.
- Trois endroits choisissent la zone, chacun de son côté, avec
  `pickActiveZone(installed)` : `MapScreen`, `DraftSession` et
  `useRoutingEngine`. Quand la liste des zones prêtes change, ils changent
  tous, chacun à son moment.
- `DraftSession` crée le Store (magasin d'état) de la création sous la clé
  `id-version`. Si la zone change pendant une création, le Store est
  recréé : **l'itinéraire est perdu** (contraire à C11).
- Le moteur de calcul est unique dans l'app (ADR 0015). Une création restée
  sur la v3 avec un moteur passé sur la v4 rangerait des résultats v4 sous
  des clés v3 : c'est le mélange interdit par C10.
- `parseCatalogue` (app) n'a aucune liste de fichiers permis. Il contrôle
  chaque `path`, taille, empreinte et adresse, et ignore les champs
  inconnus. `difficulty.json` suit la règle des `path`.
- Côté fabrique, `zone_entry` et les tests du catalogue fabriquent des
  paquets sans table. Le workflow relit et valide le catalogue publié
  (`load_catalogue`), qui contient aujourd'hui Nancy v3, sans table.

### Le volume à prévoir (taginfo, statistiques d'OSM, 1er novembre 2026)

- Voies avec `mtb:scale` : 72 359 en France, 27 953 en Suisse (environ
  0,7 voie par km²). Une zone de 1° de côté dans les Alpes (environ
  8 000 km²) en aurait donc environ 5 500. On prévoit 15 000 au plus.
- Valeurs en France : `1` (24 958), `0` (23 827), `2` (12 890), `3`
  (5 809), `4`, `5`, `6`, puis les valeurs à signe (`0+` 783, `1+` 424,
  `2+` 197, `1-` 109…). Les valeurs hors règle (`1; 0`, `1 ST`, `s1`,
  `fixme`…) font environ 0,1 % des voies.
- Le wiki d'OSM : niveaux de 0 à 6 ; `+` ou `-` affinent un niveau sans
  en changer.

## Décision

### 1. La table des difficultés (complète l'ADR 0003)

**Le fichier : `difficulty.json`**, rangé sous `difficulty.json`, à la
racine du dossier de version. JSON (format texte de données) compact, sur
une ligne :

```json
{"formatVersion":1,"waysByLevel":[[4126539,23077417],[340171810,340172445],[340171837,371765201],[],[],[],[]]}
```

- `waysByLevel` : **exactement 7 listes**. L'indice est le niveau : 0 pour
  S0, jusqu'à 6 pour S6.
- Chaque liste contient des identifiants de voie OSM (entiers de 1 ou
  plus), triés, sans doublon. Une voie n'est que dans une liste.
- Taille : environ 10 octets par voie. Nancy (504 voies) : environ 5 Ko.
  Zone riche (15 000 voies) : environ 170 Ko.
- Une zone sans voie notée a 7 listes vides. **Un paquet neuf a toujours
  ce fichier.**
- `formatVersion` suit la règle de l'ADR 0003, § 3. L'app lit la
  version 1. Toute autre valeur veut dire « pas de table » : tout est
  « inconnue », sans erreur.
- **Pas de schéma JSON.** Comme `zone.json`, le fichier est produit et lu
  par notre code, et vérifié par les tests (ADR 0003, § 8).

**Quelles voies.** Toutes les voies (`w`) qui portent `mtb:scale` dans
`work/<id>/zone.osm.pbf`. C'est l'extrait découpé que Valhalla lit pour
fabriquer ses tuiles.
- Tout `way_id` que le moteur peut renvoyer vient de ce fichier.
- Pas l'extrait régional, que lisent les circuits balisés : il ajouterait
  des milliers de voies hors de la zone.
- Pas de tri « routable ou non » : il faudrait refaire la règle du Lua
  (script de fabrication des tuiles) de Valhalla, pour gagner quelques
  octets. Une voie jamais renvoyée par le moteur ne gêne pas.

**Lecture de `mtb:scale`** (`parse_level`) :
1. enlever les espaces au début et à la fin ;
2. la valeur doit suivre `^[0-6][+-]?$` ;
3. le niveau est le chiffre : `1+` donne S1, `2-` donne S2, `6+` donne S6.

Toute autre valeur (`7`, `-1`, `1;2`, `1 ST`, `s1`, vide…) est écartée :
la voie n'entre pas dans la table, elle sera « inconnue ».

**Journal de fabrication** (en français). Exemple, chiffres inventés :

```
504 voies avec mtb:scale : S0 120, S1 250, S2 100, S3 25, S4 5, S5 0, S6 0 ; 4 écartées
  valeurs écartées : « 1;2 » ×3, « s1 » ×1
```

**Fabrication.** `osmium tags-filter -R` (sans les nœuds) sur
`zone.osm.pbf` avec `w/mtb:scale`, puis `osmium cat -f opl`. OPL est le
format texte d'osmium. La suite est en Python pur, testable sans osmium,
comme `trails.py`, dont elle réutilise la lecture des étiquettes OPL.

**Ce qui change dans le paquet et le catalogue :**

| Endroit | Changement |
|---|---|
| Release de la zone | un fichier de plus, `difficulty.json` |
| `SHA256SUMS` | une ligne de plus, sans code nouveau : `write_sums` prend tous les fichiers du dossier |
| `catalogue.json` | une entrée de plus dans `files`, avec `path` = `difficulty.json`. `totalBytes` l'inclut. Aucun champ nouveau, schéma inchangé, `formatVersion` reste 1 |
| Fichiers obligatoires du catalogue (`REQUIRED_FILES`) | **inchangés**. L'entrée v3 du catalogue publié reste valide, et le workflow la relit avant de la remplacer |
| `zone.json` | inchangé. Les comptes sont dans le journal |
| `LICENCES.md` | inchangé : la table vient d'OSM, déjà cité (licence ODbL) |

- La garantie qu'une nouvelle version contient la table vient de `build`,
  qui l'écrit toujours (testé), et du contrôle de la release par le
  pilotage (C4).

**Une app de la phase 5 face au nouveau catalogue (C3).** Elle télécharge
un fichier de plus (5 Ko), le contrôle, et ne s'en sert pas. Une zone v3
déjà installée reste « Prête » : la phase 5 ne propose pas de mise à
jour. Preuve : un test Jest de `parseCatalogue` sur une copie du vrai
catalogue v4, publiée en T3 (référence externe).

### 2. Le calcul de la difficulté (complète l'ADR 0017)

**La demande.** `buildTraceRequest` demande un attribut de plus :
`["edge.use", "edge.density", "edge.length", "edge.way_id"]`. La même
réponse sert au terrain et à la difficulté.

**La réponse.** `TerrainEdge` gagne `wayId?: number`.
- Présent seulement si Valhalla donne un entier sûr (safe integer, entier
  que JavaScript représente exactement) de 1 ou plus.
- Absent, 0, négatif, décimal ou texte : pas de `wayId`, donc « inconnue ».
- Champ facultatif : les tests existants qui écrivent des `TerrainEdge`
  ne changent pas.

**La table dans l'app :**

| Quoi | Où |
|---|---|
| `DIFFICULTY_FILE = 'difficulty.json'` ; `hasDifficultyTable(zone)`, vrai si `zone.files` contient ce `path` | `core/zones/zoneLayout.ts` |
| `parseDifficultyTable(text: string \| null): DifficultyTable`, une `ReadonlyMap<number, Level>` (`Level` de 0 à 6). Ne lève jamais d'erreur. Texte absent, JSON illisible, `formatVersion` différent de 1, nombre de listes différent de 7, identifiant invalide ou en double : **table vide** | `core/route-info/difficulty.ts` |
| `useDifficultyTable(zone)`, une requête TanStack Query | `features/map/useDifficultyTable.ts` |

- **Clé** : `['zones', 'difficulty', zone.id, zone.version]`.
- **Lecture** : si `hasDifficultyTable(zone)` est faux, table vide **sans
  lire le disque** (C8). Sinon `createZoneOps().readText(...)` sur le
  fichier de cette version, puis `parseDifficultyTable`. Une erreur de
  lecture donne une table vide, jamais une erreur affichée.
- **Réglages** : `staleTime: Infinity`, `gcTime: Infinity` (une table par
  version, 170 Ko au plus), `retry: false`, `networkMode: 'always'`.
- **Quand** : à la première ouverture de l'écran Infos, le seul qui
  l'affiche. Ensuite elle reste en mémoire (cache) tant que l'app vit.
  Coût attendu pour Nancy : quelques millisecondes. C12 le mesure.
- **Pourquoi `features/map/`** : un seul écran s'en sert (règle de
  l'ADR 0014, comme `useLegInfos`). Elle descendra dans
  `shared-data/zones/` quand « Mes itinéraires » (phase 6) l'utilisera
  aussi.

**Le calcul :** `summarizeDifficulty(legs, table)` dans
`core/route-info/difficulty.ts`. `summarizeInfo` ne change pas.

```ts
type DifficultyPart = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 'unknown';
type DifficultyShare = { part: DifficultyPart; km: number; percent: number };
type DifficultyInfo = { shares: DifficultyShare[] }; // display order, km > 0 only
function summarizeDifficulty(legs: LegInfo[], table: DifficultyTable | undefined): Block<DifficultyInfo>;
```

- Chaque arête d'un tronçon calculé prend le niveau de sa voie
  (`table.get(wayId)`). Sans `wayId`, ou voie absente de la table :
  « inconnue ».
- **Un tronçon à la main compte tout entier « inconnue »**, pour sa
  longueur à vol d'oiseau (choix 2).
- **Base** : la même que le terrain (ADR 0017, § 3) : somme des
  `edge.length` des tronçons calculés, plus la longueur des tronçons à la
  main. Les parts font 100 %.
- **Arrondi** : `roundShares` de `terrain.ts`, la même méthode du plus fort
  reste (largest remainder : chaque part prend sa partie entière, puis les
  points qui manquent vont aux plus grands restes). Huit parts, dans cet
  ordre : S0, S1… S6, inconnue. À égalité de reste, la première de la
  liste gagne.
- **États**, comme l'ADR 0017, § 8 :
  - en attente : la table, ou le terrain d'un tronçon, n'est pas encore là ;
  - manquante : le terrain est manquant (même réponse de Valhalla) ;
  - prête sinon. Une table vide donne « prête », tout « inconnue » (C8).
- **Ordre d'affichage (C7)** : les niveaux connus de longueur non nulle,
  du plus long au plus court (à égalité, le niveau le plus bas d'abord),
  puis « inconnue » si sa longueur n'est pas nulle. Le tri se fait sur les
  longueurs exactes, pas sur les pourcentages arrondis.
- **« moins de 1 % »** : une part de longueur non nulle dont le
  pourcentage arrondi vaut 0.
- **Aucune longueur connue** : une seule phrase, « Difficulté inconnue, la
  carte la donne rarement. »
- **Terrain manquant** : la ligne dit « Difficulté indisponible », sur le
  modèle de « Terrain indisponible ». Texte exact : le designer.
- Les textes sont dans `fr.ts`, lus par `t()`. La forme de la ligne est
  celle de la maquette 20.

**Comparaison au Mac (C6)**, même méthode que l'ADR 0017, § 9 :
- **Itinéraires** : R1 à R5, plus un 6e choisi sur des voies notées de la
  v4. Partir de M1 ou M2 de l'essai, et revérifier ses voies avec osmium
  sur l'extrait de la v4 : les identifiants ont pu changer.
- **Banc** (programme de mesure) jetable sur les deux simulateurs, avec le
  vrai code de `core/` et `shared-data/` et la zone v4. Il écrit les
  réponses brutes de `trace_attributes`, les longueurs à la main et les
  parts calculées en TypeScript.
- **Script du Mac** (`python3 -I`, rejouable, rangé avec les preuves de
  T6), avec **le même fichier** `difficulty.json`, téléchargé de la release
  v4, empreinte contrôlée :
  1. même méthode : il refait en Python la lecture de la table,
     l'attribution, la base, l'arrondi et l'ordre, sur les réponses de
     l'app. Écart permis : 1 point (attendu : 0) ;
  2. même moteur : il rejoue les requêtes sur Valhalla 3.9.1 en Docker
     (programme livré dans un conteneur isolé), avec les tuiles v4, puis
     refait le calcul. Écart permis : 1 point.
- **La table elle-même** est contrôlée à part (C2) : comptage par niveau
  avec une commande osmium indépendante sur `zone.osm.pbf`, comparé au
  journal et au fichier.

### 3. Mettre à jour une zone (complète l'ADR 0013)

**Savoir qu'il y a plus récent.** Une zone a une mise à jour disponible
quand le catalogue a, pour son `id`, une `version` plus grande que la plus
grande version présente sur le téléphone (prête ou en cours de
téléchargement).
- Calcul pur, dans `core/zones/zoneRow.ts`.
- Sans catalogue (hors ligne) : rien n'est signalé.
- Catalogue plus ancien que le téléphone (release retirée) : rien. Jamais
  de retour en arrière.

**Téléchargement : exactement l'ADR 0013, §§ 3 à 6**, dans
`zones/<id>/v<nouvelle>/` : `.plan.json`, fichiers contrôlés un par un,
`.ready.json` en dernier. Même file d'attente, même règle « Wi-Fi
seulement », même chien de garde, mêmes essais. Lancé seulement par
« Mettre à jour » (décision de design 10).
- **Place** : même règle (reste à télécharger + 50 Mo). La version en
  service ne compte pas comme place libérable : elle reste jusqu'au
  passage.
- **Annuler** (croix) : efface `zones/<id>/v<nouvelle>/` seulement.
  `cancelZone` le fait déjà : il efface la version de l'entrée en cours.
- **Coupure, app fermée** : comme un premier téléchargement. Au lancement,
  le dossier avec `.plan.json` et sans `.ready.json` reprend seul ; la
  croix l'annule.
- **Échec, place insuffisante** : la version en service reste en service.
- **Aucun état nouveau sur le disque.** « Mise à jour en cours » veut
  dire : un `.plan.json` dans une version plus grande que la version prête
  de la même zone. Le disque reste la seule vérité (ADR 0013).
- **Étape 4 de l'ADR 0013, § 3, changée** : le téléchargement n'efface
  plus les autres versions après `.ready.json`. L'effacement suit le
  passage (§ 4 ci-dessous).
- **Choix de la zone (ADR 0013, § 8), précisé** : pour chaque `id`, seule
  compte la plus grande version prête. Parmi ces zones, la carte prend
  toujours la plus récemment installée.
- **Un `.plan.json` d'une version plus petite** que la version prête de la
  même zone est un reste. Il est effacé au lancement, pas repris. Cas rare
  (catalogue changé pendant une coupure).

**Jamais de mélange, jamais de zone à moitié prête (C10) :**
- Une version est prête si et seulement si son `.ready.json` existe et se
  lit (ADR 0013, § 5) : inchangé.
- Chaque lecteur (moteur, carte, table) reçoit **un seul objet `Zone`**
  (`id` et `version`) et en tire tous ses chemins (`pathsOf`,
  `zoneFileUri`, `filePath`). Aucun chemin ne mélange deux versions.
- Toutes les clés de Query des calculs contiennent `zone.version`
  (ADR 0016 et 0017) : un résultat de la v3 n'est jamais relu pour la v4.

### 4. Le passage à la nouvelle version (C11, risque 3)

**La zone en service.** Une seule zone est en service à la fois. C'est
celle que lisent le moteur, la carte, la création et l'écran Infos. Un
petit objet en mémoire la tient, `zoneService` :
- il reçoit la liste des zones prêtes à chaque lecture du disque ;
- **sans prise** (hold), il passe aussitôt à la zone choisie par la règle
  du § 3 ;
- **une prise fige la zone en service** : tant qu'il en reste au moins
  une, elle ne change pas. À la dernière prise rendue, il applique la
  dernière liste reçue ;
- il prévient ses abonnés **tout de suite** (de façon synchrone), dans
  l'ordre où ils se sont abonnés.

**Qui prend une prise.** `DraftSession`, à l'ouverture du plein écran de
création. Il la rend à la fermeture.
- La création et l'écran Infos lisent **la zone de la prise**, plus la
  liste du disque.
- Le suivi (phase 8) prendra aussi une prise.
- Un compteur, pas un booléen : en développement, le mode strict de React
  (StrictMode, qui monte deux fois les composants) prend, rend, puis
  reprend.

**Ce qui se passe, cas par cas :**

| Moment | Moteur | Carte (onglet) | Création ouverte | v3 sur le disque |
|---|---|---|---|---|
| v4 prête, aucune création ouverte | ferme v3, ouvre v4 (file du moteur) | se redessine sur v4 (clé `id-version`) | — | effacée après la réouverture du moteur |
| v4 prête, création ouverte (choix 3) | reste sur v3 | reste sur v3 | continue sur v3 : calculs et infos de la v3 | gardée |
| La création se ferme | passe à v4 | passe à v4 | — | effacée après la réouverture du moteur |
| App tuée entre `.ready.json` v4 et l'effacement de v3 | au lancement, la règle choisit v4 | v4 | — | effacée après l'ouverture du moteur |
| App tuée pendant le téléchargement de v4 | v3 | v3 | — | gardée ; v4 reprend seule |

**Ordre du passage**, dans un seul pas de JavaScript (aucun `await` entre
les deux) :
1. `zoneService` change la zone en service ;
2. son abonné du moteur appelle `routingEngine.setZone(v4)`, qui met
   « fermer v3, ouvrir v4 » dans la file du moteur.

Tout calcul demandé ensuite passe après, dans la file : il tourne sur la
v4. Un calcul déjà dans la file finit sur la v3 (ADR 0015, § 4) : il
appartient à une clé v3, il est donc juste.

**Effacer l'ancienne version quand plus rien ne la lit :**
- `routingEngine.setZone` rend désormais une promesse. Elle est tenue
  quand la file du moteur a passé ce point : ancienne version fermée,
  nouvelle ouverte (ou en échec). Elle n'est jamais rejetée.
- Ensuite, `removeOldVersions` efface, pour chaque zone, les versions
  **prêtes** plus petites que la plus grande version prête, **sauf la
  zone en service**. Il relit la zone en service juste avant d'effacer.
  Une version en cours de téléchargement n'est jamais touchée.
- Puis la liste des zones installées est relue (écran Zones).
- Pourquoi c'est sûr :
  - seuls le moteur, la carte et la création lisent une zone, et
    seulement la zone en service ;
  - quand l'effacement part, le moteur a fermé la v3 ;
  - la carte de l'onglet s'est redessinée sur la v4 : il s'est écoulé au
    moins le temps d'ouvrir le moteur (55 ms sur iOS, environ 1 s sur
    Android) ;
  - aucune création ne tient la v3, sinon la v3 serait encore en service.
- **Le doute qui reste** : une lecture de MapLibre déjà partie sur un
  fichier de la v3. Sur iOS et Android (systèmes de type Unix), effacer un
  fichier ouvert ne coupe pas une lecture en cours : le contenu disparaît
  quand le dernier lecteur le ferme (norme POSIX, `unlink`). Une nouvelle
  ouverture échoue, mais la vue v3 n'existe plus. Le contrôle 1 l'éprouve.
- **Parade** si le contrôle 1 montre un plantage : effacer les anciennes
  versions seulement au lancement suivant, avant toute ouverture. Coût :
  la place reste prise jusque-là.

**Choix 3 du pilotage gardé.** Je n'ai rien trouvé de plus simple qui soit
sûr (voir Alternatives). La prise n'ajoute aucun état sur le disque, et la
création n'a qu'à prendre et rendre.

**Écran Zones.** La création est en plein écran, sans onglets : l'écran
Zones n'est pas visible pendant qu'une prise retarde le passage. Pas besoin
de l'état « Mise à jour prête : elle s'appliquera… » que la note du
designer voulait éviter. L'écran montre la plus grande version prête de
chaque zone. « Sur le téléphone » compte cette version seulement.

### 5. Découpage du code

Règles d'import de l'ADR 0015 inchangées. Aucun code natif, aucune
dépendance nouvelle.

**T2 — la fabrique (`zones/`, ADR 0012)**

| Fichier | Contenu |
|---|---|
| `zonefactory/difficulty.py` (nouveau) | `parse_level(value) -> int \| None` ; `table_from_opl(text) -> (ways_by_level, rejected)`, avec `rejected` un `Counter` des valeurs écartées ; `write_table(path, ways_by_level)` ; `report_lines(...)` ; `extract_difficulty(zone_pbf, out, work) -> list[str]` (osmium, puis Python) |
| `zonefactory/trails.py` | réutiliser la lecture des étiquettes OPL (`_parse_tags`), sans changer son comportement |
| `zonefactory/build.py` | une étape « Difficulté VTT (mtb:scale) » après le calcul d'itinéraire, sur `work / "zone.osm.pbf"` ; `difficulty.json` rejoint les fichiers de `out` |
| `zonefactory/catalogue.py`, `schemas/` | inchangés |
| `tests/test_difficulty.py` (nouveau) | voir « Tests attendus » |
| `zones/LISEZMOI.md` | une ligne sur le nouveau fichier |

**T4 — la mise à jour dans l'app**

| Fichier | Contenu |
|---|---|
| `core/zones/zoneService.ts` (nouveau) | `createZoneService()` : `update(installed)`, `hold()` qui rend `{ zone, release }`, `current()`, `subscribe(listener)`. Logique pure |
| `core/zones/activeZone.ts` | `pickActiveZone` : plus grande version prête par `id`, puis la plus récemment installée |
| `core/zones/installedZones.ts` | `oldVersions(...)` et `removeOldVersions(ops, service)` ; `scanZones` traite comme un reste le `.plan.json` d'une version plus petite que la version prête |
| `core/zones/downloadZone.ts` | l'étape 4 n'efface plus les autres versions |
| `core/zones/zoneRow.ts` | la carte d'une zone prête porte une partie « mise à jour » : aucune, disponible (avec la zone du catalogue), ou l'état du téléchargement de la nouvelle version |
| `core/routing/routingEngine.ts` | `setZone` rend `Promise<void>` |
| `shared-data/zones/zoneInService.ts` (nouveau) | l'instance unique de `zoneService` ; `useZoneInService()` (avec `useSyncExternalStore` de React) ; `useZoneHold()` : prise prise dans un `useEffect`, rendue au démontage ; renvoie la zone tenue, `undefined` avant |
| `shared-data/routing/useRoutingEngine.ts` | passe chaque liste lue sur le disque à `zoneService.update` ; s'abonne au service : `setZone(zone)`, puis `removeOldVersions`, puis relecture des zones installées |
| `features/map/MapScreen.tsx` | lit `useZoneInService()` au lieu de `pickActiveZone(installed)` |
| `features/map/DraftSession.tsx` | lit `useZoneHold()` ; écran vide tant que la prise n'est pas prise. La clé `id-version` reste : elle ne change plus pendant une création |
| `features/zones/` | `ZoneCard`, `ZonesView` : la partie « mise à jour » de la maquette 41. « Mettre à jour » appelle `request(zone du catalogue)` ; croix et « Réessayer » existent déjà |
| `core/i18n/fr.ts` | les textes de la note de la maquette 41 |

**T5 — la difficulté dans l'app**

| Fichier | Contenu |
|---|---|
| `core/routing/infoRequest.ts` | `edge.way_id` dans les attributs |
| `core/routing/infoResponse.ts` | `wayId?` dans `TerrainEdge` |
| `core/zones/zoneLayout.ts` | `DIFFICULTY_FILE`, `hasDifficultyTable` |
| `core/route-info/difficulty.ts` (nouveau) | `parseDifficultyTable`, `summarizeDifficulty` et ses fonctions (longueurs, parts, ordre) |
| `features/map/useDifficultyTable.ts` (nouveau) | la requête du § 2 |
| `features/map/RouteInfoScreen.tsx` | la ligne « Difficulté » de la maquette 20 |
| `core/i18n/fr.ts` | les textes |

### 6. Tests attendus

**T2 (pytest, sans réseau ni Docker)**
- `parse_level` : `0`, `1+`, `2-`, `6+`, ` 3 ` acceptés ; `7`, `-1`,
  `1;2`, `1 ST`, `s1`, `fixme`, vide refusés. Valeurs relevées sur taginfo
  France (référence externe).
- `table_from_opl`, sur un texte OPL écrit dans le test : bonnes listes,
  triées, sans doublon ; une voie sans `mtb:scale` est ignorée ; les
  valeurs écartées sont comptées, valeur par valeur.
- Fichier écrit : `formatVersion` 1 et 7 listes. Zone sans voie notée :
  7 listes vides, fichier non vide.
- Catalogue : un paquet avec `difficulty.json` donne une entrée valide qui
  le contient. Un paquet sans reste valide.
- **C2, à la main** : Nancy fabriquée sur le Mac. Les comptes du journal
  sont égaux à ceux d'une commande osmium indépendante.

**T4 (Jest et Testing Library)**
- `zoneService` : sans prise, passage immédiat et abonné prévenu tout de
  suite ; avec une prise, aucun passage ; prise rendue, passage avec la
  dernière liste ; deux prises, une seule rendue, rien ; prise, rendue,
  reprise (mode strict).
- `pickActiveZone` : v3 et v4 prêtes donnent v4, même si l'heure
  d'installation de la v3 est plus récente (horloge changée).
- `oldVersions` : v3 et v4 prêtes, service v4 : la v3 ; service v3
  (tenu) : rien ; v5 en cours de téléchargement : jamais.
- `downloadZone` : après `.ready.json` de la v4, la v3 est toujours là.
- `routingEngine` : la promesse de `setZone` est tenue après l'ouverture ;
  un calcul demandé après `setZone(v4)` part sur la v4 ; un calcul déjà
  dans la file finit sur la v3.
- `zoneRow` : disponible, en cours, en attente du Wi-Fi, échec, place
  insuffisante, finie ; rien hors ligne ; jamais de retour en arrière.
- Écran Zones : chaque état de la maquette 41, ses textes, « Mettre à
  jour », la croix, « Réessayer ».
- `DraftSession` : une v4 prête pendant la création ne change ni la zone
  ni les points ; à la fermeture, la carte passe sur la v4.
- **Test existant à adapter** : `core/zones/downloadZone.test.ts`, l. 58
  (« la v2 est effacée par le téléchargement »). La règle change. Le
  développeur le liste dans son compte rendu, comme en phase 4
  (`docs/phases/preuves/p04/t8-tests-adaptes.md`).

**T5 (Jest et Testing Library)**
- `buildTraceRequest` : les 4 attributs.
- `parseTraceResponse` : `way_id` présent donne `wayId` ; absent, 0,
  négatif, décimal ou texte : pas de `wayId`.
- `parseDifficultyTable` : table valide ; texte absent, JSON faux,
  `formatVersion` 2, 6 listes, identifiant en double : table vide.
- `summarizeDifficulty` : tout inconnu ; mélange ; tronçon à la main ; voie
  absente de la table ; somme de 100 ; « moins de 1 % » ; ordre par
  longueur et égalité ; en attente ; terrain manquant.
- Cas réels : M1 et M2 (réponses de l'essai T1, voies S1 et S2) avec un
  extrait de table. Valeur attendue donnée par le script du Mac
  (référence externe, ADR 0011, § 5).
- C3 : `parseCatalogue` sur le catalogue v4 publié.
- C8 : zone sans `difficulty.json` : aucune lecture du disque,
  « Difficulté inconnue… ».
- `RouteInfoScreen` : la ligne et ses textes.

## Contrôles avant de bâtir dessus

1. **Début de T4, sur les deux simulateurs, en release, avec la vraie v4
   publiée en T3.** Contrôle jetable :
   - a) carte de l'onglet visible sur la v3, on la fait bouger ; passage à
     la v4, puis effacement de la v3 dans l'ordre du § 4. Attendu : pas de
     plantage, carte redessinée, un calcul juste après réussit ;
   - b) pire cas, pour connaître la marge : effacer la v3 pendant que le
     moteur est encore ouvert dessus et qu'un calcul tourne. Résultat noté,
     quel qu'il soit. L'ordre du § 4 évite ce cas ;
   - c) si a) plante : parade du § 4 (effacement au lancement suivant), et
     compte rendu au pilotage avant d'aller plus loin.
2. **T5 : rien de neuf à éprouver.** C1 est prouvé. Les identifiants de la
   v4 sont vérifiés pendant C6.
3. **T2, avant la fabrication complète** (quelques secondes) : `osmium
   tags-filter` sur le `zone.osm.pbf` de Nancy encore présent dans
   `zones/work/`. Le nombre de voies doit être proche des 504 de l'essai.

## Alternatives rejetées

**La table**
- **CSV** (une ligne `way_id,niveau`) : aussi petit, mais un analyseur à
  écrire à la main dans l'app. `JSON.parse` est natif et rapide.
- **Binaire** (entiers triés, recherche par dichotomie) : deux fois plus
  petit. Utile à partir de centaines de milliers de voies ; ici 170 Ko au
  plus. Plus fragile à lire (ordre des octets), illisible à l'œil.
- **Objet `{ "identifiant": niveau }`** : environ 40 % plus gros, clés en
  texte.
- **Base SQLite dans le paquet** : une base pour quelques milliers de
  lignes, et `expo-sqlite` n'est pas encore installé.
- **Table dans `zone.json`** : mêle la description de la zone et des
  données.
- **Seulement les voies routables** ; **voies de l'extrait régional** :
  voir § 1.
- **Garder `mtb:scale` dans les tuiles de Valhalla** : version modifiée du
  moteur (ADR 0005).
- **`difficulty.json` obligatoire dans le catalogue** : l'entrée v3 publiée
  deviendrait invalide, et le workflow s'arrêterait en relisant le
  catalogue. Les tests existants de la fabrique casseraient aussi.

**Le calcul**
- **Note globale unique** : choix 1 du pilotage ; la maquette 20 montre
  les parts.
- **Parts sur la distance du moteur** : 99 % sur R4 (ADR 0017).
- **Une 2e requête `trace_attributes` pour la difficulté** : même forme,
  même moteur, deux fois le coût.
- **Table chargée au démarrage de l'app** : lue pour rien si l'on n'ouvre
  jamais Infos.
- **Difficulté dans `summarizeInfo`** : changerait le type de tous ses
  résultats, donc des tests existants. Une fonction à part suffit.

**La mise à jour et le passage**
- **Passer tout de suite, même pendant une création, et la recalculer sur
  la v4** : il faudrait détacher le Store de la version ; tous les
  tronçons seraient recalculés sous les doigts de l'utilisateur ; la carte
  rechargerait son style ; un tronçon juste pourrait échouer. Plus de code
  et de cas à tester, pour un effet surprenant.
- **Passer seulement au prochain lancement de l'app** : le plus simple.
  Mais iOS garde une app en arrière-plan des jours ; l'écran Zones devrait
  expliquer « prête, s'appliquera plus tard » ; C13 demanderait de
  relancer l'app.
- **Retarder l'écriture de `.ready.json` tant qu'une création est
  ouverte** : mêle le téléchargeur et les écrans. Une création qui s'ouvre
  entre l'écriture et la relecture du disque verrait l'ancienne liste. Une
  app tuée dans cet état recalcule 111 Mo d'empreintes au lancement.
- **Effacer l'ancienne version tout de suite après `.ready.json`** (règle
  actuelle) : le moteur et la carte la lisent encore.
- **Effacer seulement au lancement suivant** : sûr, mais la place reste
  prise des jours. Gardé comme parade (contrôle 1).
- **Compter les lecteurs dans le moteur et dans la carte** : MapLibre ne
  dit pas quand il a fini de lire un fichier. La prise, au niveau des
  écrans, suffit.
- **Copier depuis l'ancienne version les fichiers identiques** (même
  `path` et même empreinte : les 2 fichiers d'altitude, 52 Mo sur 111) :
  vrai gain, mais une opération et des cas en plus, sans besoin exprimé.
  Possible plus tard.
- **Un fichier d'état de la mise à jour** : deux vérités qui peuvent
  diverger (ADR 0013).
- **Mise à jour automatique, vérification en arrière-plan** : hors
  périmètre (décision de design 10).

## Conséquences

- Positif : un fichier de 5 Ko de plus par zone ; aucun champ nouveau ;
  aucune version de format changée. Une app de la phase 5 continue de
  marcher.
- Positif : la difficulté ne coûte aucun appel de plus au moteur.
- Positif : aucun état nouveau sur le disque pour la mise à jour. Tout
  passe par le téléchargeur et les marqueurs de l'ADR 0013.
- Positif : la zone en service est décidée à un seul endroit, au lieu de
  trois.
- Négatif : un module de plus (`zoneService`) et une règle à connaître :
  un écran qui lit une zone longtemps (création, suivi) prend une prise.
- Négatif : pendant le passage, deux versions sont sur le disque (2 × 111
  Mo pour Nancy). C'était déjà nécessaire pour télécharger.
- Négatif : une création ouverte longtemps retarde le passage, sans effet
  visible.
- Négatif : un test existant change de sens (`downloadZone.test.ts`).
- Sections datées ajoutées le 2026-11-02 aux ADR 0003, 0005, 0013, 0015
  et 0017. Elles renvoient ici et suivent son statut.

## Questions pour Émilien

1. **Question 5 du designer : un itinéraire créé sur l'ancienne carte,
   ses infos (dont la difficulté) sont-elles recalculées après le passage
   à la nouvelle ?**
   - En phase 5b, elle ne se pose que pour une création ouverte au moment
     du passage. Elle finit sur la v3 (choix 3), avec les infos de la v3 :
     difficulté « inconnue », car la v3 n'a pas de table. Un itinéraire
     n'est pas encore gardé : il disparaît à la fermeture.
   - Elle se posera vraiment en phase 6, avec « Mes itinéraires ».
   - **Recommandation** : le tracé gardé ne change jamais tout seul (pas de
     nouveau calcul de la route). Ses infos (D+, terrain, difficulté) sont
     recalculées à partir de ce tracé, sur la zone en service, quand on
     les ouvre. Raisons : la difficulté arrive avec la v4 ;
     `trace_attributes` en `walk_or_snap` accepte n'importe quel tracé ;
     coût mesuré sous 50 ms pour 42 km. Le détail (tracé hors de la zone,
     zone supprimée) ira dans l'ADR de la phase 6.
   - Autre choix : figer les infos calculées à la création. Plus simple à
     afficher, mais la difficulté resterait « inconnue » pour toujours sur
     les itinéraires faits avant la v4.

Pour le designer (pas une question pour Émilien) : le texte de la ligne
quand le terrain manque (« Difficulté indisponible » proposé).

## Sources (relevées le 2 novembre 2026)

- Essai T1 : `/Users/utilisateur/dev_ai/vtt-nav-preuves/p05b/t1-essai/LISEZMOI.md`
  (hors dépôt) ; branche jetable `claude/p05b-essai-wayid`, commit 7c3f839.
- Code lu sur `main` (48bff9e) : `zones/zonefactory/` (`build.py`,
  `catalogue.py`, `checksums.py`, `verify.py`, `trails.py`),
  `zones/schemas/catalogue.schema.json`, `mobile/src/core/zones/`,
  `mobile/src/core/routing/`, `mobile/src/core/route-info/`,
  `mobile/src/shared-data/`, `mobile/src/features/zones/`,
  `mobile/src/features/map/` (`DraftSession.tsx`, `MapScreen.tsx`,
  `useLegInfos.ts`).
- Maquette 41 et sa note : `design/v1/41-zones.html` (proposée, en attente
  de validation).
- Valhalla, `trace_attributes` et `edge.way_id` :
  https://valhalla.github.io/valhalla/api/map-matching/api-reference/
- OSM, `mtb:scale` (niveaux 0 à 6, `+` et `-`) :
  https://wiki.openstreetmap.org/wiki/Key:mtb:scale
- taginfo, `mtb:scale` en France (72 359 voies au 1er novembre 2026) :
  https://taginfo.geofabrik.de/europe/france/api/4/key/stats?key=mtb:scale ;
  ses valeurs :
  https://taginfo.geofabrik.de/europe/france/api/4/key/values?key=mtb:scale&filter=ways&sortname=count&sortorder=desc ;
  en Suisse (27 953 voies) :
  https://taginfo.geofabrik.de/europe/switzerland/api/4/key/stats?key=mtb:scale
- osmium `tags-filter` : https://docs.osmcode.org/osmium/latest/osmium-tags-filter.html
- POSIX, `unlink` (contenu gardé tant qu'un lecteur a le fichier ouvert) :
  https://pubs.opengroup.org/onlinepubs/9799919799/functions/unlink.html
- React, `useSyncExternalStore` :
  https://react.dev/reference/react/useSyncExternalStore
