# ADR 0013 — Télécharger, contrôler et ranger les zones sur le téléphone

- Statut : Proposé le 2026-10-24, à valider par Émilien
- Date : 2026-10-24 (phase 2, tâche T1 de [p02-carte-hors-ligne](../phases/p02-carte-hors-ligne.md))
- Complète l'ADR 0003 (le paquet et le catalogue, vus depuis l'app) et
  l'ADR 0007 (rôle de TanStack Query et de TanStack Store pour les
  téléchargements). Suit l'ADR 0011 et l'[ADR 0014](0014-dossier-data.md)
  (dossier `src/data/`, proposé en même temps).

ADR veut dire « Architecture Decision Record » (fiche de décision
d'architecture).

## Contexte

### Ce que demande la phase 2

- C1 : lire le catalogue publié et afficher ses zones.
- C2 : télécharger une zone en montrant la progression, puis contrôler
  chaque fichier par son empreinte SHA-256 (somme de contrôle qui prouve
  qu'un fichier n'est pas abîmé).
- C3 : après une coupure (réseau perdu, app fermée), reprendre ou
  recommencer proprement, **sans jamais de zone à moitié prête**.
- C4 : « Wi-Fi seulement », activé par défaut. Sans Wi-Fi, la zone attend.
- C5 : supprimer une zone rend la place.
- C10 : sans zone, la carte propose d'en télécharger une.
- Maquette 41 (écran Zones) : une zone « Prête sans réseau » ; une zone
  « En attente du Wi-Fi · 40 Mo sur 95 », qui garde donc ce qui est déjà
  arrivé ; une croix pour annuler ; un menu « ⋮ » pour supprimer ; la place
  libre du téléphone ; l'interrupteur Wi-Fi **aussi** dans le bandeau de cet
  écran. Maquette 80 : le même interrupteur dans Réglages. Maquette 91 :
  l'état vide de la carte.

### Le catalogue réel (lu le 24 octobre 2026)

Une zone, Nancy, version 3 : 9 fichiers, 110 962 386 octets (111 Mo). Les
champs sont ceux de l'ADR 0003, § 4.

| `path` | Octets |
|---|---|
| `valhalla_tiles.tar` | 28 846 080 |
| `elevation/N48/N48E005.hgt` | 25 934 402 |
| `elevation/N48/N48E006.hgt` | 25 934 402 |
| `map.pmtiles` | 17 603 182 |
| `terrain.pmtiles` | 8 775 665 |
| `contours.pmtiles` | 3 809 985 |
| `trails.geojson` | 55 994 |
| `LICENCES.md` | 2 107 |
| `zone.json` | 569 |

Le plus gros fichier pèse 28,8 Mo. L'adresse `github.com` répond par une
redirection (code 302) vers `release-assets.githubusercontent.com`, avec
une adresse signée qui expire. Constaté le 24 octobre sur le catalogue.

### Ce qu'offre Expo SDK 58 (vérifié le 24 octobre 2026)

SDK (Software Development Kit) : l'ensemble des bibliothèques d'Expo d'une
même version. API (Application Programming Interface) : les fonctions
qu'une bibliothèque met à disposition.

| Besoin | API | Ce qu'elle fait vraiment |
|---|---|---|
| Télécharger | `expo-file-system` 58.0.10 : `createDownloadTask(url, destination, options)` | Progression (`onProgress` : octets écrits et total), annulation (`cancel()`), pause et reprise (`pauseAsync()`, `resumeAsync()`, `savable()`) |
| Reprendre un fichier à l'octet près | la même | **Seulement après une pause demandée par l'app.** J'ai lu le code natif : après une erreur réseau, iOS ne garde pas de quoi reprendre, et Android ne connaît la position qu'après `pause()`. Après un arrêt de l'app, la tâche n'est pas restaurée (doc) |
| Continuer en arrière-plan | option `sessionType` | iOS seulement, `'background'` par défaut. Android l'ignore |
| Ancienne API | `createDownloadResumable` | Dépréciée. Elle lève une erreur si on ne l'importe pas de `expo-file-system/legacy` |
| Empreinte d'un fichier | `File.digest('SHA-256')`, ajouté en 58.0.0 (10 septembre 2026) | Calcul natif. Le code iOS et Android lit le fichier par morceaux de 64 Kio : le fichier n'est jamais chargé en entier en mémoire. Fonction asynchrone, exécutée hors du fil JavaScript |
| Empreinte avec `expo-crypto` | `Crypto.digest(algorithme, données)` | Demande tout le contenu en mémoire. Pas de calcul par morceaux |
| Dossiers | `Paths.document`, `Paths.cache`, `Paths.bundle` | `document` est « à l'abri d'un effacement par le système » |
| Place | `Paths.availableDiskSpace`, `Directory.size`, `Directory.delete()` | Place libre, taille d'un dossier, effacement avec le contenu |
| Type de réseau | `expo-network` 58.0.4 : `getNetworkStateAsync()`, `addNetworkStateListener()`, `useNetworkState()` | `type` vaut `WIFI`, `CELLULAR`, `ETHERNET`, `VPN`, `NONE`, `UNKNOWN`… ; plus `isConnected` |

Deux pièges trouvés en lisant le code :
- **Android** : le client HTTP de React Native (OkHttp), que le
  téléchargement utilise, n'a **aucun délai d'attente** (timeout) :
  `connectTimeout` et `readTimeout` valent 0. Une connexion bloquée sans
  erreur peut donc attendre sans fin.
- **iOS** : Apple ne garantit pas que le chemin complet du dossier de l'app
  reste le même d'une mise à jour à l'autre. On ne garde donc jamais un
  chemin complet. On le recalcule depuis `Paths.document`.

Le code natif lu est celui de la branche `main` d'Expo, le 24 octobre.
L'essai E1 (plus bas) le confirme sur la version installée.

## Décision

### 1. Les dossiers sur le téléphone

Tout est rangé sous `Paths.document` :

```
<document>/
├── settings.json              réglages de l'app (§ 6)
├── glyphs/1/…                 glyphes de la carte, copiés depuis l'app (§ 2)
└── zones/
    └── nancy/                 un dossier par zone : l'id du catalogue
        └── v3/                un dossier par version
            ├── .plan.json     écrit dès la demande de téléchargement
            ├── map.pmtiles    les fichiers du paquet, chacun sous son path
            ├── elevation/N48/N48E005.hgt
            ├── …
            └── .ready.json    écrit en dernier : la zone est prête
```

Règles :
- Chaque fichier du paquet est rangé sous son `path` du catalogue, à
  partir du dossier de version. L'app refuse un `path` qui ne suit pas la
  règle de l'ADR 0003 (ni `..`, ni `/` au début).
- **Pas de dossier temporaire à part.** On télécharge directement dans le
  dossier de version. Tant que `.ready.json` n'existe pas, rien ne lit ce
  dossier : la carte ne lit que les zones prêtes.
- Les deux marqueurs commencent par un point. La règle des `path` (ADR 0003)
  impose un premier caractère lettre ou chiffre : un fichier du paquet ne
  peut jamais porter leur nom.
- Un dossier par version : une version plus récente se téléchargera à côté
  de celle en service, sans y toucher.
- `document` et pas `cache` : le système peut vider le cache quand la place
  manque. On perdrait la carte en pleine forêt.
- Les marqueurs ne contiennent que des chemins relatifs.

### 2. Les glyphes de la carte

Les glyphes sont les dessins des lettres que MapLibre utilise pour écrire
sur la carte (fichiers `.pbf`). Ils ne sont pas dans le paquet de zone
(`design/style-carte.md`).

- Ils sont **livrés dans l'app**, dans
  `mobile/assets/glyphs/<police>/<plage>.pbf` : Noto Sans Regular, Bold et
  Italic, licence OFL 1.1, comme dans l'essai 3. Seulement les plages
  utiles au français. Le développeur les choisit en T5 et les note.
- Metro (l'outil qui assemble le code et les fichiers de l'app) doit
  accepter l'extension `.pbf` (réglage `assetExts`).
- Au lancement, s'ils manquent, l'app les copie dans
  `<document>/glyphs/<n>/<police>/<plage>.pbf`, avec `expo-asset`
  (`Asset.fromModule(…).downloadAsync()`, puis copie du fichier obtenu). Un
  fichier `.ready` est écrit en dernier, comme pour les zones. `<n>` est un
  numéro écrit dans le code : il augmente quand le jeu de glyphes change,
  et l'ancien dossier est effacé.
- Le style lit `file://<document>/glyphs/<n>/{fontstack}/{range}.pbf` :
  des glyphes en fichiers locaux, comme dans l'essai 3.
- Pourquoi copier : MapLibre veut un dossier rangé par police et par
  plage. `expo-asset` donne des fichiers isolés, renommés, dans le cache.

### 3. Le déroulé d'un téléchargement

Une zone à la fois, un fichier à la fois, dans l'ordre du catalogue. Les
autres zones demandées attendent leur tour (file d'attente).

1. **Demande** (bouton « Télécharger ») : créer `zones/<id>/v<version>/` et
   y écrire `.plan.json`, qui recopie l'entrée de la zone dans le catalogue
   (§ 5). La demande est ainsi gardée, même si l'app est fermée. La reprise
   n'a plus besoin du catalogue.
2. **Place** : il faut `Paths.availableDiskSpace` ≥ octets qui restent à
   télécharger + 50 Mo. Sinon, état « Place insuffisante ». Ce contrôle est
   refait à chaque départ ou reprise.
3. **Pour chaque fichier** :
   1. S'il est déjà là, avec la bonne taille **et** la bonne empreinte : on
      le garde et on passe au suivant. C'est la reprise.
   2. Attendre que la règle du réseau le permette (§ 6).
   3. Créer les sous-dossiers (`elevation/N48/`), puis télécharger avec
      `createDownloadTask`, depuis l'adresse `url` du catalogue (toujours
      `github.com`, jamais l'adresse de redirection), avec
      `sessionType: 'foreground'`.
   4. Contrôler la taille, puis l'empreinte (§ 5).
4. **Tout est contrôlé** : écrire `.ready.json`, **en dernier**. Puis
   effacer `.plan.json` et les autres versions de la même zone.
5. Relire la liste des zones installées (§ 9) : les écrans se mettent à
   jour.

Progression affichée = octets des fichiers déjà contrôlés + octets écrits
du fichier en cours, sur `totalBytes`. Quand la zone attend, seuls les
fichiers contrôlés comptent : c'est le « 40 Mo sur 95 » de la maquette.

### 4. Les coupures : reprise fichier par fichier

On reprend **fichier par fichier**, pas à l'octet près. Un fichier coupé
recommence à zéro. Les fichiers déjà contrôlés sont gardés. Perte au pire :
un fichier, soit 28,8 Mo pour Nancy.

| Cas | Ce que fait l'app |
|---|---|
| « Wi-Fi seulement » et le Wi-Fi disparaît | Le fichier en cours est annulé (`cancel()`). État « En attente du Wi-Fi ». Le téléchargement repart seul quand le Wi-Fi revient (écoute d'`expo-network`) |
| Réseau perdu, ou erreur pendant un fichier | Un essai raté pour ce fichier. On attend que le réseau soit permis, puis 5 secondes, et on recommence ce fichier |
| Aucun octet reçu pendant 30 secondes | Un chien de garde (watchdog, minuterie qui surveille la progression) annule le fichier : un essai raté. Indispensable sur Android, sans délai d'attente |
| Taille ou empreinte fausse | Le fichier est effacé : un essai raté |
| 3 essais ratés de suite pour un même fichier | État « Échec », avec « Réessayer ». Les fichiers contrôlés restent |
| App en arrière-plan | Rien de prévu. Si le système suspend l'app, le fichier en cours échoue ou s'arrête ; il recommence au retour (cas « erreur ») |
| App fermée ou tuée | Au lancement suivant, l'app trouve le dossier avec `.plan.json` et sans `.ready.json`. Elle reprend seule ce téléchargement, sous la règle du réseau. La croix l'annule |

- Pourquoi reprendre seul au lancement : `.plan.json` dit déjà que
  l'utilisateur veut cette zone. Aucun état de plus à dessiner, et la croix
  reste là.
- Les durées et nombres (5 s, 30 s, 3 essais, 50 Mo) sont des valeurs de
  départ. On les ajuste après l'essai E1.

### 5. Empreintes et état « prête »

- Après chaque fichier : la taille (`File.size`) doit être égale à
  `bytes`, puis `File.digest('SHA-256')` doit être égale à `sha256`. La
  taille d'abord : c'est immédiat, et on ne calcule pas l'empreinte d'un
  fichier tronqué.
- Calcul natif, par morceaux de 64 Kio : jamais 28 Mo en mémoire, aucune
  bibliothèque en plus.
- **Une zone est prête si et seulement si
  `zones/<id>/v<version>/.ready.json` existe et se lit.** Il est écrit
  après le contrôle du dernier fichier. Si l'app s'arrête avant ou pendant
  cette écriture, la zone reste « non prête », jamais « à moitié prête ».
  Au lancement suivant, la reprise recontrôle les fichiers présents (§ 3,
  étape 3.1) et réécrit le marqueur.
- Une zone prête n'est plus recontrôlée : une release de zone n'est jamais
  modifiée (ADR 0003).
- Les deux marqueurs ont la même forme (format JSON propre à l'app) :

```json
{
  "localFormat": 1,
  "installedAt": "2026-10-24T10:12:31Z",
  "zone": { "id": "nancy", "name": "Nancy", "version": 3, "bbox": { "…": "…" },
            "osmDate": "2026-10-22T20:21:33Z", "totalBytes": 110962386,
            "files": [ { "path": "…", "bytes": 0, "sha256": "…", "url": "…" } ] }
}
```

- `zone` est l'entrée du catalogue, recopiée telle quelle. `installedAt`
  n'existe que dans `.ready.json`. `localFormat` augmente si ce format
  change.
- Grâce à `.ready.json`, l'app connaît **sans réseau** le nom, les limites,
  la date des données et la taille de chaque zone installée.

### 6. La règle « Wi-Fi seulement »

- Type de réseau : `expo-network`, avec `getNetworkStateAsync()` avant
  chaque fichier et `addNetworkStateListener()` pendant.
- La règle est une fonction pure de `core/` :

| Réglage | Réseau | Résultat |
|---|---|---|
| Wi-Fi seulement | `WIFI` ou `ETHERNET`, connecté | permis |
| Wi-Fi seulement | connecté, autre type (`CELLULAR`, `VPN`, `UNKNOWN`…) | attendre : « pas de Wi-Fi » |
| Tout réseau | connecté, quel que soit le type | permis |
| Les deux | `isConnected` faux, ou type `NONE` | attendre : « pas de réseau » |

- Le câble (`ETHERNET`) compte comme du Wi-Fi : il ne coûte rien sur le
  forfait. Un VPN (réseau privé virtuel) cache le vrai réseau : on attend.
  L'utilisateur peut couper la règle.
- Le catalogue (moins de 3 Ko) n'est pas soumis à la règle.
- Le réglage est rangé dans `<document>/settings.json` :
  `{ "wifiOnly": true }`. Fichier absent ou illisible : valeurs par défaut
  (`wifiOnly` vrai).
- Changer le réglage réveille tout de suite la file d'attente : une zone
  qui attendait le Wi-Fi part en 4G si on coupe la règle.

### 7. Annuler, supprimer, rendre la place

- **Annuler** (croix) : annule le fichier en cours, retire la zone de la
  file, efface `zones/<id>/v<version>/`.
- **Supprimer** (menu « ⋮ ») : efface `zones/<id>/` en entier, toutes
  versions. Un téléchargement en cours de cette zone est d'abord annulé.
- Preuve de C5 : `Directory.size` de `zones/` et `Paths.availableDiskSpace`,
  avant et après.
- « Sur le téléphone : 106 Mo » = somme des `totalBytes` des zones prêtes,
  lue dans les marqueurs. « 23,4 Go libres » = `Paths.availableDiskSpace`.
- Un dossier de version sans aucun marqueur lisible est un reste inutile :
  il est effacé au lancement.

### 8. La zone affichée par la carte

- En v1, la carte affiche une seule zone : **la zone prête installée le
  plus récemment** (le plus grand `installedAt`). Rien n'est enregistré en
  plus. Il n'y a donc pas de « zone active » qui pourrait viser une zone
  effacée.
- Aucune zone prête : l'état vide de la maquette 91 (C10). Son bouton ouvre
  l'onglet Zones.
- Les adresses du style viennent du dossier de la zone :
  `pmtiles://` + l'adresse `file://` de `zones/<id>/v<version>/map.pmtiles`.
  De même pour `terrain.pmtiles` et `contours.pmtiles`.
- Choisir la zone affichée parmi plusieurs : plus tard, quand le catalogue
  aura une deuxième zone.

### 9. TanStack Query, TanStack Store et rangement du code

Rôles. Cela précise l'ADR 0007, qui rangeait les téléchargements dans
Query.

| Donnée | Outil | Clé | Réglages |
|---|---|---|---|
| Catalogue | Query (`useQuery`) | `['catalogue']` | Mode réseau par défaut (`online`). Les 3 nouvelles tentatives par défaut couvrent le court moment où le catalogue est remplacé (ADR 0003) |
| Zones installées, lues dans les marqueurs | Query | `['zones', 'installed']` | `networkMode: 'always'`. Relue (invalidée) après une zone prête, une annulation, une suppression |
| Réglage « Wi-Fi seulement » | Query, plus une mutation (`useMutation`) qui écrit le fichier puis met la donnée à jour | `['settings']` | `networkMode: 'always'` |
| Téléchargements : état, progression, file d'attente | **TanStack Store** | `zoneDownloads` | — |

- Pourquoi le téléchargement n'est pas une mutation de Query : il dure des
  minutes, montre une progression, attend le Wi-Fi, reprend seul et doit
  pouvoir s'annuler. Une mutation n'a ni progression ni annulation. Le
  Store sert à « l'état vivant, utilisable hors des composants »
  (ADR 0007). Le téléchargeur tourne hors des écrans.
- Query est relié à l'état du réseau par `expo-network` (`onlineManager`,
  comme dans la doc de TanStack Query pour React Native). Sans cela, Query
  ne sait pas que le téléphone est hors ligne.

Rangement, selon l'ADR 0011 et le dossier `src/data/` de l'ADR 0014 :

| Endroit | Contenu | Testé par |
|---|---|---|
| `core/zones/catalogue.ts` | Types ; `parseCatalogue(json)` contrôle les champs de l'ADR 0003 § 4 (dont `path` et `sha256`), ignore un champ inconnu, refuse un `formatVersion` autre que 1 | Jest : faux catalogues, et une copie du vrai catalogue v3 (référence externe) |
| `core/zones/networkRule.ts` | La règle du § 6 | Jest : le tableau du § 6 |
| `core/zones/downloadZone.ts` | Le déroulé des §§ 3 à 5, sans aucune API du téléphone. Les opérations (télécharger, taille, empreinte, écrire, effacer, état du réseau, minuterie) lui sont passées en paramètre | Jest, avec de fausses opérations : fichier abîmé refusé et zone non prête (C2) ; coupure puis reprise (C3) ; attente du Wi-Fi (C4) ; chien de garde |
| `core/zones/zoneLayout.ts` | Chemins relatifs, noms et lecture des marqueurs | Jest |
| `core/zones/zoneRow.ts` | L'état de chaque ligne de l'écran Zones (à télécharger, en cours, en attente, échec, prête), à partir du catalogue, des zones installées et du Store | Jest |
| `core/zones/activeZone.ts` | Le choix du § 8 | Jest |
| `core/settings/settings.ts` | `parseSettings(json)` et valeurs par défaut | Jest |
| `data/zones/` | Les vraies opérations (`expo-file-system`) ; lecture des zones installées ; `useInstalledZones()` ; adresses des fichiers pour la carte | Jest avec une imitation (mock) d'`expo-file-system` pour la logique ; le reste par E1 et Maestro |
| `data/settings/` | Lecture et écriture de `settings.json` ; `useSettings()`, `useSetWifiOnly()` | Jest avec une imitation |
| `features/zones/zoneDownloader.ts` | Le téléchargeur : file d'attente, Store, écoute du réseau et du réglage ; il appelle `downloadZone` avec les vraies opérations | Maestro (C3, C4) |
| `features/zones/` (le reste) | `ZonesScreen`, `useCatalogue()`, et un composant sans affichage qui démarre le téléchargeur et reprend les téléchargements interrompus | Testing Library |
| `features/map/` | `MapScreen` : zones installées, zone affichée, copie des glyphes, état vide | Testing Library, Maestro |
| `features/settings/` | L'interrupteur, avec `useSettings()` | Testing Library |
| `src/app/_layout.tsx` | `QueryClientProvider`, puis le composant de démarrage du téléchargeur, au-dessus des onglets | — |

## Essais jetables, avant de bâtir

**E1 — Téléchargement et empreintes, au début de T3, avant le code du
téléchargeur.** Code jetable, jamais fusionné. Sur les deux simulateurs :

1. Télécharger les 9 fichiers de Nancy v3 avec `createDownloadTask` et
   `sessionType: 'foreground'`, depuis les adresses `github.com`. Mesurer :
   redirection suivie, durée, mémoire de l'app.
2. `File.digest('SHA-256')` : les 9 empreintes égales à celles du
   catalogue (référence externe). Durée pour 28,8 Mo et pour les 111 Mo.
   L'écran reste-t-il fluide pendant le calcul ?
3. Couper le réseau au milieu d'un gros fichier (Android :
   `adb shell svc wifi disable`). La promesse est-elle rejetée, et en
   combien de temps ? Sur Android, reste-t-elle bloquée sans fin ? Cela
   fixe la durée du chien de garde.
4. Une adresse fausse (réponse 404) : promesse rejetée, ou fichier écrit
   avec la page d'erreur ? Le contrôle de taille doit l'attraper dans les
   deux cas.
5. Tuer l'app pendant un fichier (`adb shell am force-stop`,
   `xcrun simctl terminate`). Que reste-t-il dans le dossier ?
6. `expo-network` : quel `type` sur l'émulateur Android, Wi-Fi coupé puis
   remis (`CELLULAR`, puis `WIFI` ?) ; et sur le simulateur iOS, qui
   partage le réseau du Mac (`WIFI`, `ETHERNET`, `UNKNOWN` ?). Si iOS ne dit
   jamais `WIFI` ni `ETHERNET`, l'app y attendrait toujours le Wi-Fi : le
   test de C4 se fera alors sur Android seulement, à noter.

Repli si 1 ou 3 échouent (blocage, plantage, fichier jamais terminé) :
l'ancienne API `createDownloadResumable`, encore livrée dans
`expo-file-system/legacy`. Arrêt et compte rendu avant d'aller plus loin.

**Contrôle au début de T5 (risque faible) :** les glyphes `.pbf` passent
par Metro et `expo-asset`, puis MapLibre les lit, y compris dans une
version « release » Android, où les noms de fichiers des ressources sont
transformés.

## Alternatives rejetées

- **Reprise à l'octet près** (`pauseAsync()` puis `savable()`) : elle ne
  marche qu'après une pause voulue, ni après une erreur, ni après un arrêt
  de l'app (code lu). Le gain est d'au plus 28,8 Mo, pour un état de
  reprise à enregistrer et des cas d'erreur en plus.
- **Téléchargement en arrière-plan sur iOS** (`sessionType: 'background'`,
  la valeur par défaut) : quand l'app est suspendue, le JavaScript ne tourne
  plus. Un fichier commencé en Wi-Fi continuerait en 4G malgré la règle. Il
  faut aussi gérer les tâches orphelines après un arrêt, et un accusé de
  réception (`acknowledgeBackgroundCompletionAsync`). Android n'a pas cette
  option. Pour 111 Mo en Wi-Fi, garder l'app ouverte quelques minutes
  suffit en v1.
- **`createDownloadResumable`** : dépréciée. Gardée comme repli de E1.
- **Dossier temporaire, puis déplacement dans `zones/`** : il faudrait
  prouver que le déplacement d'un dossier se fait d'un seul coup sur
  Android. Le marqueur écrit en dernier donne la même garantie, sans cette
  question.
- **État des téléchargements enregistré à part** (base SQLite, fichier
  d'état) : deux vérités qui peuvent diverger. Le disque suffit : marqueurs,
  fichiers et empreintes.
- **Empreinte en JavaScript**, avec une bibliothèque de calcul et une
  lecture par morceaux (`FileHandle`) : plus lent qu'un calcul natif, et une
  dépendance de plus. **`expo-crypto`** : demande tout le fichier en
  mémoire.
- **Zones dans `Paths.cache`** : le système peut l'effacer.
- **Glyphes dans le paquet de zone** : les trois polices ont les mêmes noms
  de fichiers (`0-255.pbf`…). Une release étant à plat, il faudrait changer
  la règle `path`/`url` de l'ADR 0003. Les glyphes seraient copiés dans
  chaque zone et chaque version, et le style de l'app dépendrait de la
  fabrique. **Glyphes dans les ressources natives** (dossier `assets`
  d'Android, « bundle » iOS) : il faudrait écrire un plugin de
  configuration, et l'adresse différerait selon la plateforme (`asset://`
  sur Android).
- **`@react-native-community/netinfo`** 12.0.1 (14 février 2026) :
  maintenu et utilisable, cité aussi par la doc de TanStack Query.
  `expo-network` suit le SDK (58.0.4) et suffit : une dépendance hors Expo
  en moins. NetInfo dit en plus si le Wi-Fi est payant : ce n'est pas un
  besoin connu.
- **Mutation de Query pour le téléchargement** : voir § 9.
- **Réglage dans SQLite** (`expo-sqlite/kv-store`) **ou AsyncStorage**
  (stockage clé-valeur simple) : une dépendance de plus pour un seul
  booléen. SQLite arrivera avec les itinéraires ; le réglage pourra y
  passer s'il y a une raison.
- **Téléchargements en parallèle** : progression et reprise plus
  compliquées, gain faible en Wi-Fi.
- **« Zone active » enregistrée dans les réglages** : elle pourrait viser
  une zone effacée. La règle du § 8 se déduit du disque.

## Conséquences

- Positif : une seule vérité, le disque. Toute la logique (déroulé, règle
  du réseau, reprise, choix de la zone) se teste sans téléphone.
- Positif : aucune dépendance hors Expo et TanStack. À installer :
  `expo-file-system`, `expo-network`, `expo-asset` (par `npx expo install`),
  `@tanstack/react-query` et `@tanstack/react-store` (ADR 0007).
- Négatif : une coupure fait perdre le fichier en cours (28,8 Mo au plus
  pour Nancy). Si une zone a un jour un fichier de plusieurs centaines de
  Mo, il faudra revoir la reprise à l'octet près.
- Négatif : l'app doit rester ouverte pendant le téléchargement. Durée pour
  Nancy en Wi-Fi : mesurée par E1.
- Négatif : avec un VPN, « Wi-Fi seulement » attend toujours.
- Négatif : un dossier `src/data/` de plus (ADR 0014), et ESLint à
  compléter en T3.
- **Mise à jour d'une zone** (par exemple v3 vers v4) : le rangement par
  version la permet, et l'étape 4 du § 3 efface l'ancienne version. Mais
  l'écran ne la propose pas en phase 2 : une zone prête reste affichée
  comme prête, même si le catalogue a plus récent.
- **Releases effacées sur GitHub** (point d'attention de la spec) : la
  reprise d'une version effacée échouera (404), puis « Échec ».
  L'utilisateur annule et retélécharge. À garder en tête quand on décidera
  combien de versions garder.
- **À décider en phase 3**, quand les itinéraires seront gardés : la
  sauvegarde du téléphone. Android et iOS sauvegardent par défaut les
  fichiers de l'app, `zones/` compris. Android ne sauvegarde plus rien
  d'une app qui dépasse 25 Mo : avec une zone de 111 Mo, les itinéraires ne
  seraient pas sauvegardés. Il faudra exclure `zones/` (règles
  `dataExtractionRules` sur Android ; marque « ne pas sauvegarder » sur
  iOS, à vérifier dans Expo). Sans effet en phase 2.
- Tests Maestro de C3 (T6), sur Android : `adb shell svc wifi disable`
  puis `enable` au milieu du téléchargement ; `adb shell am force-stop`
  puis relance.

## Sources (relevées le 24 octobre 2026)

- Catalogue publié (zone Nancy v3) :
  https://github.com/Emilien1982/RutaPulse/releases/download/catalogue/catalogue.json
- `expo-file-system`, doc du SDK 58 (`createDownloadTask`, `DownloadTask`,
  `File.digest`, `Paths`, `Directory`) :
  https://docs.expo.dev/versions/latest/sdk/filesystem/
- `expo-file-system`, versions (dernière : 58.0.10) :
  https://registry.npmjs.org/expo-file-system
- `expo-file-system`, journal des versions (`File.digest` en 58.0.0 du
  10 septembre 2026 ; `createDownloadTask` en 56.0.0) :
  https://github.com/expo/expo/blob/main/packages/expo-file-system/CHANGELOG.md
- Code natif du téléchargement et de l'empreinte :
  https://github.com/expo/expo/blob/main/packages/expo-file-system/ios/FileSystemDownloadTask.swift,
  https://github.com/expo/expo/blob/main/packages/expo-file-system/ios/FileSystemFile.swift,
  https://github.com/expo/expo/blob/main/packages/expo-file-system/android/src/main/java/expo/modules/filesystem/FileSystemDownloadTask.kt,
  https://github.com/expo/expo/blob/main/packages/expo-file-system/android/src/main/java/expo/modules/filesystem/FileSystemFile.kt
- Client HTTP Android de React Native sans délai d'attente :
  https://github.com/facebook/react-native/blob/main/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/modules/network/OkHttpClientProvider.kt
- Fonctions asynchrones des modules Expo, hors du fil JavaScript :
  https://docs.expo.dev/modules/module-api/
- `expo-crypto`, doc du SDK 58 : https://docs.expo.dev/versions/latest/sdk/crypto/
- `expo-network`, doc du SDK 58 : https://docs.expo.dev/versions/latest/sdk/network/ ;
  version 58.0.4 : https://registry.npmjs.org/expo-network/latest ;
  code iOS : https://github.com/expo/expo/blob/main/packages/expo-network/ios/NetworkModule.swift
- `@react-native-community/netinfo` 12.0.1 :
  https://registry.npmjs.org/@react-native-community/netinfo/latest
- `expo-asset`, doc du SDK 58 : https://docs.expo.dev/versions/latest/sdk/asset/
- TanStack Query et React Native (`onlineManager` avec `expo-network`) :
  https://tanstack.com/query/latest/docs/framework/react/react-native
- Sauvegarde automatique Android (limite de 25 Mo) :
  https://developer.android.com/identity/data/autobackup
